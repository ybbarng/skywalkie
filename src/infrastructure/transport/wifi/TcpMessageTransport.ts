import TcpSocket from 'react-native-tcp-socket'
import type { Envelope } from '@/application/ports/Envelope'
import type { MessageTransport, Unsubscribe } from '@/application/ports/MessageTransport'
import { ConnectionState } from '@/domain/connection/ConnectionState'
import type { LinkKind } from '@/domain/connection/LinkKind'
import { LinkQuality } from '@/domain/connection/LinkQuality'
import { type DomainError, domainError } from '@/domain/shared/DomainError'
import { err, ok, type Result } from '@/domain/shared/Result'
import { decodeEnvelope, encodeEnvelope } from '../protocol/EnvelopeSchema'
import { encodeFrame, HEARTBEAT } from '../protocol/FrameCodec'
import { FrameDecoder } from '../protocol/FrameDecoder'
import type { ConnectionRole } from './DiscoveryPlan'
import { ports } from './DiscoveryPlan'

/**
 * Wi-Fi 위에서 메시지를 나른다.
 *
 * 핫스팟을 연 쪽(안드로이드)이 **받는 쪽**, 붙는 쪽(아이폰)이 **거는 쪽**이다.
 * 역할을 주소로 정하니 둘 다 동시에 걸거나 둘 다 기다리는 일이 없다.
 *
 * 여기는 진짜 소켓을 다루는 곳이라 컴퓨터에서 시험할 수 없다. 그래서
 * **판단이 필요한 것은 전부 바깥으로 뺐다.** 주소 계산은 `NetworkAddress`,
 * 찾는 순서는 `DiscoveryPlan`, 바이트 자르기는 `FrameDecoder`,
 * 형식 검사는 `EnvelopeSchema` 가 한다. 여기 남은 건 배선뿐이다.
 */

/** 이 시간마다 살아있다는 신호를 보낸다 */
const HEARTBEAT_INTERVAL_MS = 5000

/** 이 시간 동안 아무것도 안 오면 끊긴 것으로 본다 */
const SILENCE_TIMEOUT_MS = 15_000

type Socket = ReturnType<typeof TcpSocket.createConnection>
type Server = ReturnType<typeof TcpSocket.createServer>

export class TcpMessageTransport implements MessageTransport {
  readonly kind: LinkKind = 'wifi'

  private socket: Socket | null = null
  private server: Server | null = null
  private state = ConnectionState.idle()
  private quality_ = LinkQuality.unknown('wifi')

  private readonly decoder = new FrameDecoder()
  private readonly receiveHandlers = new Set<(envelope: Envelope) => void>()
  private readonly stateHandlers = new Set<(state: ConnectionState) => void>()

  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private silenceTimer: ReturnType<typeof setTimeout> | null = null
  private lastHeardAt = 0

  constructor(
    private readonly role: ConnectionRole,
    private readonly options: TransportOptions = {},
  ) {}

  async connect(): Promise<Result<void, DomainError>> {
    const searching = this.state.startSearching()
    if (searching.ok) this.setState(searching.value)

    return this.role === 'host' ? this.listen() : this.dial()
  }

  async disconnect(): Promise<void> {
    this.stopTimers()
    this.decoder.reset()

    // 여러 번 불러도 안전해야 한다. 앱을 닫을 때와 갈아탈 때 겹쳐서 불린다.
    this.socket?.destroy()
    this.socket = null
    this.server?.close()
    this.server = null

    const stopped = this.state.stop()
    if (stopped.ok) this.setState(stopped.value)
  }

  async send(envelope: Envelope): Promise<Result<void, DomainError>> {
    if (this.socket === null || !this.state.isUsable()) {
      return err(domainError('not-found', '연결이 없다', 'transport'))
    }

    const encoded = encodeEnvelope(envelope)
    if (!encoded.ok) return encoded

    const frame = encodeFrame(encoded.value)
    if (!frame.ok) return frame

    try {
      this.socket.write(Buffer.from(frame.value))
      return ok(undefined)
    } catch (cause) {
      // 소켓이 이미 죽었다. 예외를 위층으로 올리지 않는다.
      return err(
        domainError(
          'not-found',
          `보내지 못했다: ${cause instanceof Error ? cause.message : cause}`,
          'transport',
        ),
      )
    }
  }

  onReceive(handler: (envelope: Envelope) => void): Unsubscribe {
    this.receiveHandlers.add(handler)
    return () => this.receiveHandlers.delete(handler)
  }

  onStateChange(handler: (state: ConnectionState) => void): Unsubscribe {
    this.stateHandlers.add(handler)
    return () => this.stateHandlers.delete(handler)
  }

  currentState(): ConnectionState {
    return this.state
  }

  quality(): LinkQuality {
    return this.quality_
  }

  // --- 받는 쪽 (핫스팟을 연 안드로이드) ---

  private async listen(): Promise<Result<void, DomainError>> {
    return new Promise(resolve => {
      try {
        this.server = TcpSocket.createServer(socket => {
          // 상대가 붙었다. 하나만 받는다 — 쓰는 사람이 둘뿐이다.
          if (this.socket !== null) {
            socket.destroy()
            return
          }
          this.attach(socket)
        })

        this.server.on('error', () => {
          this.loseConnection()
        })

        this.server.listen({ port: ports.message, host: '0.0.0.0' }, () => {
          resolve(ok(undefined))
        })
      } catch (cause) {
        resolve(
          err(
            domainError(
              'invalid-value',
              `받을 준비를 못 했다: ${cause instanceof Error ? cause.message : cause}`,
              'transport',
            ),
          ),
        )
      }
    })
  }

  // --- 거는 쪽 (붙는 아이폰) ---

  private async dial(): Promise<Result<void, DomainError>> {
    const host = this.options.peerAddress
    if (host === undefined) {
      return err(domainError('not-found', '걸 주소를 모른다', 'transport'))
    }

    const handshaking = this.state.startHandshake('wifi')
    if (handshaking.ok) this.setState(handshaking.value)

    return new Promise(resolve => {
      let settled = false

      try {
        const socket = TcpSocket.createConnection(
          {
            port: ports.message,
            host,
            connectTimeout: this.options.connectTimeoutMs ?? 5000,
            // Wi-Fi 로만 나간다. 셀룰러가 켜져 있으면 그쪽으로 새어
            // 사설망 주소에 닿지 못한다.
            interface: 'wifi',
          },
          () => {
            if (settled) return
            settled = true
            this.attach(socket)
            resolve(ok(undefined))
          },
        )

        socket.on('error', () => {
          if (settled) return
          settled = true
          resolve(err(domainError('not-found', '연결하지 못했다', 'transport')))
        })
      } catch (cause) {
        if (!settled) {
          settled = true
          resolve(
            err(
              domainError(
                'not-found',
                `연결하지 못했다: ${cause instanceof Error ? cause.message : cause}`,
                'transport',
              ),
            ),
          )
        }
      }
    })
  }

  // --- 붙은 뒤 ---

  private attach(socket: Socket): void {
    this.socket = socket
    this.decoder.reset()
    this.markHeard()

    socket.on('data', data => {
      this.markHeard()
      this.feed(data)
    })

    socket.on('error', () => this.loseConnection())
    socket.on('close', () => this.loseConnection())

    const established = this.state.isSettled()
      ? ok(this.state)
      : this.state.phase === 'connected'
        ? ok(this.state)
        : this.toConnected()
    if (established.ok) this.setState(established.value)

    this.startTimers()
  }

  private toConnected(): Result<ConnectionState, DomainError> {
    // 받는 쪽은 찾기 단계에서 바로 붙는다. 인사 단계를 거쳐야 한다.
    if (this.state.phase === 'searching') {
      const handshaking = this.state.startHandshake('wifi')
      if (!handshaking.ok) return handshaking
      return handshaking.value.establish()
    }
    return this.state.establish()
  }

  private feed(data: string | Buffer): void {
    const bytes =
      typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data)

    const decoded = this.decoder.push(bytes)
    if (!decoded.ok) {
      // 말도 안 되는 길이 값이 왔다. 이 연결은 더 믿을 수 없다.
      this.loseConnection()
      return
    }

    for (const payload of decoded.value.payloads) {
      const outcome = decodeEnvelope(payload)

      // 모르는 종류나 망가진 것이 와도 연결을 끊지 않는다.
      // 상대가 다른 버전일 수 있다. (docs/04-transport-spec.md 3장)
      if (outcome.kind !== 'ok') {
        this.options.onDiscarded?.(outcome)
        continue
      }

      for (const handler of this.receiveHandlers) handler(outcome.envelope)
    }
  }

  // --- 살아있는지 확인하기 ---

  private startTimers(): void {
    this.stopTimers()

    this.heartbeatTimer = setInterval(() => {
      try {
        this.socket?.write(Buffer.from(HEARTBEAT))
      } catch {
        this.loseConnection()
      }
    }, HEARTBEAT_INTERVAL_MS)

    this.silenceTimer = setInterval(() => {
      const silentFor = Date.now() - this.lastHeardAt
      if (silentFor > SILENCE_TIMEOUT_MS) this.loseConnection()
    }, HEARTBEAT_INTERVAL_MS)
  }

  private stopTimers(): void {
    if (this.heartbeatTimer !== null) clearInterval(this.heartbeatTimer)
    if (this.silenceTimer !== null) clearInterval(this.silenceTimer)
    this.heartbeatTimer = null
    this.silenceTimer = null
  }

  private markHeard(): void {
    this.lastHeardAt = Date.now()
  }

  private loseConnection(): void {
    if (!this.state.isUsable() && this.state.phase !== 'handshaking') return

    this.stopTimers()
    this.socket?.destroy()
    this.socket = null
    this.decoder.reset()

    const lost = this.state.lose()
    if (lost.ok) this.setState(lost.value)
  }

  private setState(next: ConnectionState): void {
    this.state = next
    for (const handler of this.stateHandlers) handler(next)
  }
}

export interface TransportOptions {
  /** 거는 쪽일 때 걸 주소 */
  readonly peerAddress?: string
  readonly connectTimeoutMs?: number
  /** 버린 봉투를 기록하고 싶을 때 */
  onDiscarded?(outcome: { kind: 'unknown' | 'invalid' }): void
}

export const transportTiming = {
  heartbeatMs: HEARTBEAT_INTERVAL_MS,
  silenceTimeoutMs: SILENCE_TIMEOUT_MS,
} as const
