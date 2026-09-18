import TcpSocket from 'react-native-tcp-socket'
import { type DomainError, domainError } from '@/domain/shared/DomainError'
import { err, ok, type Result } from '@/domain/shared/Result'
import { ports } from '../wifi/DiscoveryPlan'
import { chatPage } from './client/page'
import {
  formatResponse,
  type HttpRequest,
  html,
  json,
  notFound,
  parseRequest,
  readText,
} from './httpProtocol'

/**
 * 안드로이드가 띄우는 작은 웹 서버.
 *
 * **아이폰 앱이 만료돼도 대화할 수 있다.** 설치 없이 사파리로
 * `http://192.168.43.1:51705` 에 들어온다.
 *
 * 유료 개발자 계정이 없어 아이폰 앱이 7일마다 죽는다. 여행이 그보다
 * 길거나 앱이 어떤 이유로든 안 열리면, 이게 남는 유일한 길이다.
 *
 * ## 여기서 앱이 죽으면 안 된다
 *
 * 서버는 **덤이다.** 안 열려도 앱은 그대로 돌아야 한다. 그래서 모든
 * 것을 감싸고, 실패하면 "못 열었다"고만 답한다.
 *
 * (docs/04-transport-spec.md 5장 · T21)
 */

export interface WebMessage {
  readonly id: string
  readonly text: string
  readonly mine: boolean
  readonly at: number
  readonly kind?: 'system'
}

export interface LocalHttpServerHandlers {
  /** 웹에서 글을 보냈다 */
  onSend: (text: string) => Promise<void>
  /** 이 시각 뒤의 말들을 달라 */
  since: (at: number) => WebMessage[]
  /** 상대 이름. 화면 맨 위에 뜬다 */
  peerName: () => string
}

/** 새 말이 없으면 이만큼 붙들고 기다린다 */
const HOLD_MS = 25_000

/** 붙들고 있는 동안 이 간격으로 들여다본다 */
const LOOK_EVERY_MS = 400

export class LocalHttpServer {
  // biome-ignore lint/suspicious/noExplicitAny: 소켓 모듈 타입이다
  private server: any = null
  private readonly waiting = new Set<() => void>()

  constructor(private readonly handlers: LocalHttpServerHandlers) {}

  async start(): Promise<Result<void, DomainError>> {
    if (this.server !== null) return ok(undefined)

    try {
      this.server = TcpSocket.createServer(socket => {
        this.handleSocket(socket)
      })

      this.server.on('error', () => {
        // 번호를 이미 누가 쓰고 있다. 웹 채팅만 안 되고 앱은 그대로다.
      })

      this.server.listen({ port: ports.web, host: '0.0.0.0' })
      return ok(undefined)
    } catch (cause) {
      this.server = null
      const detail = cause instanceof Error ? cause.message : String(cause)
      return err(domainError('invalid-value', `웹 채팅을 못 열었다: ${detail}`, 'web'))
    }
  }

  async stop(): Promise<void> {
    for (const wake of this.waiting) wake()
    this.waiting.clear()

    try {
      this.server?.close?.()
    } catch {
      // 이미 닫혔다
    }
    this.server = null
  }

  isRunning(): boolean {
    return this.server !== null
  }

  /** 새 말이 생겼다. 붙들고 있던 요청들을 깨운다 */
  notify(): void {
    for (const wake of this.waiting) wake()
    this.waiting.clear()
  }

  // biome-ignore lint/suspicious/noExplicitAny: 소켓 모듈 타입이다
  private handleSocket(socket: any): void {
    let buffer = ''

    socket.on('data', (chunk: unknown) => {
      void (async () => {
        try {
          buffer += String(chunk)

          // 한 번에 여러 요청이 붙어 올 수 있다
          for (;;) {
            const request = parseRequest(buffer)
            if (request === null) return

            // 읽은 만큼 버린다
            const end = buffer.indexOf('\r\n\r\n') + 4
            buffer = buffer.slice(end + request.body.length)

            const response = await this.route(request)
            socket.write(formatResponse(response))
          }
        } catch {
          // 이 연결 하나가 잘못됐다. 끊고 넘어간다.
          try {
            socket.destroy()
          } catch {
            // 이미 끊겼다
          }
        }
      })()
    })

    socket.on('error', () => {
      // 사파리가 뒤로 갔다. 흔한 일이다.
    })
  }

  private async route(request: HttpRequest) {
    if (request.path === '/' || request.path === '/index.html') {
      return html(chatPage(this.handlers.peerName()))
    }

    if (request.path === '/messages') {
      return json({ messages: await this.waitForMessages(request) })
    }

    if (request.path === '/send' && request.method === 'POST') {
      const text = readText(request.body)
      if (text !== null) await this.handlers.onSend(text)
      return json({ ok: true })
    }

    return notFound()
  }

  /**
   * 새 말이 있으면 바로, 없으면 붙들고 기다린다.
   *
   * **쉬지 않고 물어보게 두면 폰이 뜨거워진다.** 붙들고 있다가 새 말이
   * 생기면 그때 답한다. 아무 일도 없으면 조금 뒤 빈손으로 답하고,
   * 사파리가 다시 건다. 그래야 끊긴 것을 알아챌 수 있다.
   */
  private async waitForMessages(request: HttpRequest): Promise<WebMessage[]> {
    const since = Number(request.query.since ?? 0)
    const at = Number.isFinite(since) ? since : 0

    const ready = this.handlers.since(at)
    if (ready.length > 0) return ready

    await new Promise<void>(resolve => {
      let deadline: ReturnType<typeof setTimeout> | null = null
      let look: ReturnType<typeof setInterval> | null = null

      const finish = () => {
        if (deadline !== null) clearTimeout(deadline)
        if (look !== null) clearInterval(look)
        deadline = null
        look = null

        this.waiting.delete(finish)
        resolve()
      }

      this.waiting.add(finish)
      deadline = setTimeout(finish, HOLD_MS)

      // 알림을 놓쳤을 때를 대비해 가끔 직접 들여다본다.
      // 놓치면 사파리가 25초를 기다리는데, 그동안 말이 안 뜬다.
      look = setInterval(() => {
        if (this.handlers.since(at).length > 0) finish()
      }, LOOK_EVERY_MS)
    })

    return this.handlers.since(at)
  }
}
