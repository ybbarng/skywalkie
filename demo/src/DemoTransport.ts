import type { Envelope } from '@/application/ports/Envelope'
import type { MessageTransport, Unsubscribe } from '@/application/ports/MessageTransport'
import { ConnectionState } from '@/domain/connection/ConnectionState'
import { LinkQuality } from '@/domain/connection/LinkQuality'
import { type DomainError, domainError } from '@/domain/shared/DomainError'
import { err, ok, type Result } from '@/domain/shared/Result'
import {
  decodeEnvelope,
  encodeEnvelope,
} from '@/infrastructure/transport/protocol/EnvelopeSchema'
import { encodeFrame } from '@/infrastructure/transport/protocol/FrameCodec'
import { FrameDecoder } from '@/infrastructure/transport/protocol/FrameDecoder'
import type { Side, VirtualNetwork } from './network'

/**
 * 가상 망 위에서 도는 진짜 전송 계층.
 *
 * **봉투를 글로 바꾸고 길이를 붙이고 다시 읽는 것은 전부 `src/` 의
 * 진짜 코드다.** 여기서 하는 일은 그 바이트를 가상 선에 얹는 것뿐이다.
 *
 * 실제 앱의 `TcpMessageTransport` 와 같은 자리에 들어간다. 그래서
 * 위층은 이게 가짜인 줄 모른다.
 */
export class DemoTransport implements MessageTransport {
  readonly kind = 'wifi' as const

  private state = ConnectionState.idle()
  private readonly decoder = new FrameDecoder()
  private readonly receivers = new Set<(envelope: Envelope) => void>()
  private readonly watchers = new Set<(state: ConnectionState) => void>()

  /** 실제로 선을 탄 바이트. 화면에 얼마나 오갔는지 보여준다 */
  bytesOut = 0
  bytesIn = 0
  /** 형식 검사에 걸려 버린 것. 여기 쌓이면 무언가 어긋난 것이다 */
  rejected = 0

  constructor(
    private readonly side: Side,
    private readonly net: VirtualNetwork,
  ) {
    net.listen(side, {
      side,
      onBytes: bytes => this.onBytes(bytes),
      onClosed: () => this.onClosed(),
    })
  }

  /**
   * 이어본다.
   *
   * 붙는 쪽은 먼저 **찾는다.** 여는 쪽은 기다리기만 한다.
   * (docs/04-transport-spec.md 2.1)
   */
  async connect(): Promise<Result<void, DomainError>> {
    this.moveTo(this.state.startSearching())

    if (this.side === 'guest') {
      const found = this.net.discover()
      if (!found.found) {
        return err(domainError('not-found', '상대를 못 찾았어요', 'discovery'))
      }

      if (!this.net.connect()) {
        return err(domainError('not-found', '붙지 못했어요', 'connect'))
      }
    } else {
      // 여는 쪽은 자리를 깔고 기다린다
      if (!this.net.hotspotOn) {
        return err(domainError('not-found', '핫스팟이 꺼져 있어요', 'hotspot'))
      }
    }

    if (!this.net.isLinked()) {
      return err(domainError('not-found', '아직 안 이어졌어요', 'connect'))
    }

    this.moveTo(this.state.startHandshake('wifi'))
    this.moveTo(this.state.establish())
    return ok(undefined)
  }

  /**
   * 상대가 붙어왔다. 여는 쪽이 쓴다.
   *
   * **선이 진짜로 이어진 뒤에만 받는다.** 예전에는 묻지도 않고
   * 이어진 것으로 쳤다. 그래서 상대가 못 붙었는데도 여는 쪽 화면만
   * "연결됨" 이 되는 일이 있었다.
   */
  acceptIncoming(): void {
    if (!this.net.isLinked()) return
    if (this.state.isUsable()) return
    this.moveTo(this.state.startSearching())
    this.moveTo(this.state.startHandshake('wifi'))
    this.moveTo(this.state.establish())
  }

  async disconnect(): Promise<void> {
    this.net.unlink('사람이 끊음')
    this.moveTo(this.state.stop())
  }

  async send(envelope: Envelope): Promise<Result<void, DomainError>> {
    const encoded = encodeEnvelope(envelope)
    if (!encoded.ok) return encoded

    const framed = encodeFrame(encoded.value)
    if (!framed.ok) return framed

    if (!this.net.send(this.side, framed.value)) {
      return err(domainError('not-found', '끊겨 있어요', 'transport'))
    }

    this.bytesOut += framed.value.byteLength
    this.net.note(this.side, `${envelope.t} 보냄 · ${framed.value.byteLength}B`, 'send')
    return ok(undefined)
  }

  onReceive(handler: (envelope: Envelope) => void): Unsubscribe {
    this.receivers.add(handler)
    return () => this.receivers.delete(handler)
  }

  onStateChange(handler: (state: ConnectionState) => void): Unsubscribe {
    this.watchers.add(handler)
    return () => this.watchers.delete(handler)
  }

  currentState(): ConnectionState {
    return this.state
  }

  quality(): LinkQuality {
    return LinkQuality.unknown('wifi')
  }

  /** 신호가 끊겼다. 사람이 끊은 것과 다르다 */
  lose(): void {
    this.moveTo(this.state.lose())
  }

  private onBytes(bytes: Uint8Array): void {
    this.bytesIn += bytes.byteLength

    const frames = this.decoder.push(bytes)
    if (!frames.ok) {
      // 이 연결은 더 믿을 수 없다
      this.net.unlink('바이트가 망가졌어요')
      return
    }

    for (const payload of frames.value.payloads) {
      const outcome = decodeEnvelope(payload)

      if (outcome.kind !== 'ok') {
        // **모르는 봉투가 와도 끊지 않는다.** 상대가 다른 버전일 수 있다.
        this.rejected += 1
        this.net.note(this.side, `모르는 봉투를 버렸어요 (${outcome.kind})`, 'warn')
        continue
      }

      this.net.note(this.side, `${outcome.envelope.t} 받음`, 'recv')
      for (const handler of this.receivers) handler(outcome.envelope)
    }
  }

  private onClosed(): void {
    this.moveTo(this.state.lose())
  }

  private moveTo(next: Result<ConnectionState, DomainError> | ConnectionState): void {
    const value = 'ok' in next ? (next.ok ? next.value : null) : next
    if (value === null) return

    this.state = value
    for (const watcher of this.watchers) watcher(value)
  }
}
