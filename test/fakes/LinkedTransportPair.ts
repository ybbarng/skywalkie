import type { Envelope } from '@/application/ports/Envelope'
import type { MessageTransport, Unsubscribe } from '@/application/ports/MessageTransport'
import { ConnectionState } from '@/domain/connection/ConnectionState'
import type { LinkKind } from '@/domain/connection/LinkKind'
import { LinkQuality } from '@/domain/connection/LinkQuality'
import { type DomainError, domainError } from '@/domain/shared/DomainError'
import { err, ok, type Result } from '@/domain/shared/Result'

/**
 * 두 기기를 이어붙인 가짜 연결.
 *
 * **이 프로젝트에서 가장 값진 테스트 도구다.** 한쪽에 넣은 것이 다른 쪽으로
 * 나오게 해서, 진짜 Wi-Fi 없이 두 기기가 대화하는 전 과정을 돌린다.
 *
 * 나쁜 연결을 일부러 만들 수도 있다.
 *
 * ```ts
 * const [android, iphone] = linkedTransportPair({
 *   latencyMs: 50,
 *   dropRate: 0.1,   // 10%를 잃어버린다
 *   reorder: true,   // 순서가 뒤바뀐다
 * })
 * ```
 *
 * (docs/09-testing.md 5장)
 */
export function linkedTransportPair(
  options: LinkOptions = {},
): [LinkedTransport, LinkedTransport] {
  const random = seededRandom(options.seed ?? 20260917)
  const left = new LinkedTransport(options.kind ?? 'wifi', options, random, 'left')
  const right = new LinkedTransport(options.kind ?? 'wifi', options, random, 'right')

  left.pairWith(right)
  right.pairWith(left)

  return [left, right]
}

export class LinkedTransport implements MessageTransport {
  /** 이쪽에서 보낸 것들 */
  readonly sent: Envelope[] = []
  /** 일부러 잃어버린 것들 */
  readonly dropped: Envelope[] = []

  private peer: LinkedTransport | null = null
  private state: ConnectionState
  private linkQuality: LinkQuality
  private readonly receiveHandlers = new Set<(envelope: Envelope) => void>()
  private readonly stateHandlers = new Set<(state: ConnectionState) => void>()

  /** 늦게 배달할 것들. 순서를 뒤바꿀 때 쓴다 */
  private readonly delayed: Envelope[] = []

  /** 귀를 막았는가. 보내는 쪽은 잘 갔다고 여긴다 */
  private deaf = false

  constructor(
    readonly kind: LinkKind,
    private readonly options: LinkOptions,
    private readonly random: () => number,
    private readonly side: 'left' | 'right',
  ) {
    this.state = ConnectionState.connected(kind)
    this.linkQuality = LinkQuality.unknown(kind)
  }

  pairWith(peer: LinkedTransport): void {
    this.peer = peer
  }

  async connect(): Promise<Result<void, DomainError>> {
    this.setState(ConnectionState.connected(this.kind))
    return ok(undefined)
  }

  async disconnect(): Promise<void> {
    const stopped = this.state.stop()
    if (stopped.ok) this.setState(stopped.value)
  }

  async send(envelope: Envelope): Promise<Result<void, DomainError>> {
    if (!this.state.isUsable()) {
      return err(domainError('not-found', '연결이 없다', 'transport'))
    }

    if (this.peer === null) {
      return err(domainError('not-found', '상대가 없다', 'transport'))
    }

    this.sent.push(envelope)

    // 일부러 잃어버린다
    const dropRate = this.options.dropRate ?? 0
    if (dropRate > 0 && this.random() < dropRate) {
      this.dropped.push(envelope)
      return ok(undefined)
    }

    // 순서를 뒤바꾼다. 한 개를 붙들었다가 다음 것 뒤에 흘려보낸다.
    if (
      this.options.reorder === true &&
      this.delayed.length === 0 &&
      this.random() < 0.5
    ) {
      this.delayed.push(envelope)
      return ok(undefined)
    }

    await this.deliver(envelope)

    const held = this.delayed.shift()
    if (held !== undefined) await this.deliver(held)

    return ok(undefined)
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
    return this.linkQuality
  }

  // --- 테스트에서 조종하는 것들 ---

  /** 연결이 끊긴 것처럼 만든다. 양쪽 다 끊는다 */
  cut(): void {
    this.loseLocally()
    this.peer?.loseLocally()
  }

  /**
   * 귀만 막는다. 보내는 쪽은 잘 갔다고 여긴다.
   *
   * **실제로 메시지가 사라지는 경로가 이 모양이다.** 한쪽이 앱을 닫거나
   * 화면이 꺼져 못 받는 동안 상대는 아무 문제를 못 느낀다.
   */
  deafen(): void {
    this.deaf = true
  }

  /** 다시 듣기 시작한다 */
  listen(): void {
    this.deaf = false
  }

  /** 다시 붙인다 */
  restore(): void {
    this.setState(ConnectionState.connected(this.kind))
    this.peer?.setState(ConnectionState.connected(this.kind))
  }

  /** 붙들고 있던 것을 전부 흘려보낸다 */
  async flushDelayed(): Promise<void> {
    while (this.delayed.length > 0) {
      const held = this.delayed.shift()
      if (held !== undefined) await this.deliver(held)
    }
  }

  setQuality(quality: LinkQuality): void {
    this.linkQuality = quality
  }

  sentOfType<T extends Envelope['t']>(type: T): Array<Extract<Envelope, { t: T }>> {
    return this.sent.filter((e): e is Extract<Envelope, { t: T }> => e.t === type)
  }

  describeSide(): string {
    return this.side
  }

  private async deliver(envelope: Envelope): Promise<void> {
    const latency = this.options.latencyMs ?? 0
    if (latency > 0) await sleep(latency)

    this.peer?.receive(envelope)
  }

  private receive(envelope: Envelope): void {
    if (!this.state.isUsable()) return
    // 귀를 막았으면 조용히 버린다. 보내는 쪽은 모른다.
    if (this.deaf) return
    for (const handler of this.receiveHandlers) handler(envelope)
  }

  private loseLocally(): void {
    const lost = this.state.lose()
    if (lost.ok) this.setState(lost.value)
  }

  private setState(next: ConnectionState): void {
    this.state = next
    for (const handler of this.stateHandlers) handler(next)
  }
}

export interface LinkOptions {
  readonly kind?: LinkKind
  /** 배달에 걸리는 시간 */
  readonly latencyMs?: number
  /** 0에서 1 사이. 이 비율만큼 잃어버린다 */
  readonly dropRate?: number
  /** 순서를 뒤바꿀지 */
  readonly reorder?: boolean
  /** 씨앗을 고정하면 실패해도 같은 순서로 재현된다 */
  readonly seed?: number
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function seededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}
