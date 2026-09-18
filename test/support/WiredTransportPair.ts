import { Rng } from '@test/support/random'
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

/**
 * 두 기기를 **진짜 바이트로** 이어붙인다.
 *
 * `LinkedTransportPair` 는 봉투를 그대로 넘긴다. 절차를 보는 데는
 * 맞지만 **형식 검사와 바이트 자르기를 건너뛴다.** 새 내용 종류를
 * 더할 때 거기서 걸리면 못 잡는다.
 *
 * 여기는 실제 앱과 같은 길을 간다.
 *
 * ```
 * 봉투 → 글 → 길이 붙이기 → (사설망) → 길이 읽기 → 글 → 봉투
 * ```
 *
 * 사설망이 험한 것도 흉내 낸다.
 *
 *   · 한 번에 다 안 온다 (조각조각)
 *   · 여러 개가 붙어 온다
 *   · 끊겼다 붙는다
 *
 * (docs/09-testing.md 3장)
 */

export interface WiredOptions {
  /** 바이트를 몇 조각으로 쪼개 보낼까. 1 이면 통째로 */
  readonly splitInto?: number
  /** 여러 봉투를 붙여 한 번에 보낼까 */
  readonly coalesce?: boolean
  readonly seed?: number
}

export function wiredTransportPair(
  options: WiredOptions = {},
): [WiredTransport, WiredTransport] {
  const rng = new Rng(options.seed ?? 20260918)
  const left = new WiredTransport(options, rng)
  const right = new WiredTransport(options, rng)

  left.pairWith(right)
  right.pairWith(left)

  return [left, right]
}

export class WiredTransport implements MessageTransport {
  readonly kind = 'wifi' as const

  /** 실제로 선을 탄 바이트 수. 사진이 얼마나 무거운지 볼 때 쓴다 */
  bytesSent = 0
  /** 보낸 봉투들 */
  readonly sent: Envelope[] = []
  /** 형식 검사에 걸려 버려진 것들. **여기 쌓이면 무언가 어긋난 것이다** */
  readonly rejected: string[] = []

  private peer: WiredTransport | null = null
  private state = ConnectionState.idle()
  private connected = false

  private readonly decoder = new FrameDecoder()
  private readonly receivers = new Set<(envelope: Envelope) => void>()
  private readonly watchers = new Set<(state: ConnectionState) => void>()

  /** 끊긴 동안 오려던 것들. 다시 붙어도 되살리지 않는다 */
  private droppedWhileDown = 0

  /**
   * 귀를 막는다. 오는 것을 조용히 버린다.
   *
   * **보내는 쪽은 잘 갔다고 믿는 상황을 만든다.** 아이폰이 앱을 닫아
   * 소켓만 살아 있고 처리를 못 하는 경우가 실제로 있다. 이때는
   * 쌓아뒀다 보내는 것으로는 못 되찾고, 인사할 때 서로 순번을
   * 맞춰봐야만 알아챈다.
   */
  private deaf = false

  deafen(): void {
    this.deaf = true
  }

  listen(): void {
    this.deaf = false
  }

  constructor(
    private readonly options: WiredOptions,
    private readonly rng: Rng,
  ) {}

  pairWith(other: WiredTransport): void {
    this.peer = other
  }

  async connect(): Promise<Result<void, DomainError>> {
    this.connected = true

    const searching = this.state.startSearching()
    if (searching.ok) this.moveTo(searching.value)

    const handshaking = this.state.startHandshake('wifi')
    if (handshaking.ok) this.moveTo(handshaking.value)

    const established = this.state.establish()
    if (established.ok) this.moveTo(established.value)

    return ok(undefined)
  }

  async disconnect(): Promise<void> {
    this.connected = false
    const stopped = this.state.stop()
    if (stopped.ok) this.moveTo(stopped.value)
  }

  /** 신호가 끊겼다. 사람이 끊은 것과 다르다 */
  loseSignal(): void {
    this.connected = false
    const lost = this.state.lose()
    if (lost.ok) this.moveTo(lost.value)
  }

  async send(envelope: Envelope): Promise<Result<void, DomainError>> {
    if (!this.connected || this.peer === null || !this.peer.connected) {
      this.droppedWhileDown += 1
      return err(domainError('not-found', '끊겨 있다', 'transport'))
    }

    const encoded = encodeEnvelope(envelope)
    if (!encoded.ok) return encoded

    const framed = encodeFrame(encoded.value)
    if (!framed.ok) return framed

    this.sent.push(envelope)
    this.bytesSent += framed.value.byteLength

    this.peer.receiveBytes(framed.value)
    return ok(undefined)
  }

  /**
   * 바이트가 들어온다.
   *
   * **한 번에 다 오지 않는다.** 실제 소켓이 그렇다. 조각조각 넣어서
   * 이어 붙이는 쪽이 제대로 도는지 본다.
   */
  private receiveBytes(bytes: Uint8Array): void {
    // 귀를 막았다. 보내는 쪽은 잘 갔다고 믿는다.
    if (this.deaf) return

    const pieces = this.split(bytes)

    for (const piece of pieces) {
      const frames = this.decoder.push(piece)

      // **연결을 끊어야 하는 오류다.** 실제 앱도 여기서 끊는다.
      if (!frames.ok) {
        this.loseSignal()
        return
      }

      for (const payload of frames.value.payloads) {
        const outcome = decodeEnvelope(payload)

        if (outcome.kind !== 'ok') {
          // 모르는 봉투는 조용히 넘긴다. 하지만 **시험에서는 센다.**
          // 여기 쌓이면 형식 검사에 안 적어둔 것이 있다는 뜻이다.
          this.rejected.push(payload)
          continue
        }

        for (const handler of this.receivers) handler(outcome.envelope)
      }
    }
  }

  /** 바이트를 몇 조각으로 쪼갠다 */
  private split(bytes: Uint8Array): Uint8Array[] {
    const into = this.options.splitInto ?? 1
    if (into <= 1 || bytes.byteLength <= 1) return [bytes]

    const pieces: Uint8Array[] = []
    let at = 0

    while (at < bytes.byteLength) {
      const left = bytes.byteLength - at
      const size = Math.max(1, this.rng.between(1, Math.ceil(left / 1)))
      const take = Math.min(size, left, Math.ceil(bytes.byteLength / into) || 1)

      pieces.push(bytes.subarray(at, at + take))
      at += take
    }

    return pieces
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

  /** 끊긴 동안 못 보낸 것이 몇 개인가 */
  lostWhileDown(): number {
    return this.droppedWhileDown
  }

  sentOfType<T extends Envelope['t']>(type: T): Array<Extract<Envelope, { t: T }>> {
    return this.sent.filter(
      (envelope): envelope is Extract<Envelope, { t: T }> => envelope.t === type,
    )
  }

  private moveTo(next: ConnectionState): void {
    this.state = next
    for (const watcher of this.watchers) watcher(next)
  }
}
