import type { Envelope } from '@/application/ports/Envelope'
import type { MessageTransport, Unsubscribe } from '@/application/ports/MessageTransport'
import { SerialQueue } from '@/application/shared/SerialQueue'
import { ConnectionState } from '@/domain/connection/ConnectionState'
import type { LinkKind } from '@/domain/connection/LinkKind'
import { LinkQuality, shouldSwitch } from '@/domain/connection/LinkQuality'
import { type DomainError, domainError } from '@/domain/shared/DomainError'
import { err, ok, type Result } from '@/domain/shared/Result'

/**
 * 여러 길을 하나처럼 보이게 한다.
 *
 * 이것도 `MessageTransport` 약속을 지키므로 **위층은 이게 여러 길을 묶은
 * 것인지 모른다.** 나중에 길을 하나 더 붙여도 조립하는 곳 한 줄만 고친다.
 *
 * ```ts
 * new CompositeTransport([
 *   new TcpMessageTransport(role),   // 먼저
 *   new BleMessageTransport(),       // 안 되면 이것
 * ])
 * ```
 *
 * **갈아탈 때 지키는 순서가 이 파일의 핵심이다.**
 *
 *   1. 새 길을 연다           (옛 길은 아직 살아 있다)
 *   2. 보낼 것을 새 길로 돌린다
 *   3. 그제서야 옛 길을 놓는다
 *
 * 순서를 어기면 갈아타는 순간의 메시지가 사라진다.
 * (docs/04-transport-spec.md 6장)
 */
export class CompositeTransport implements MessageTransport {
  private active: MessageTransport | null = null
  private state = ConnectionState.idle()

  private readonly receiveHandlers = new Set<(envelope: Envelope) => void>()
  private readonly stateHandlers = new Set<(state: ConnectionState) => void>()
  private readonly subscriptions = new Map<MessageTransport, Unsubscribe[]>()

  /** 갈아타는 동안 쌓아두는 것들 */
  private readonly outbox: Envelope[] = []

  /** 연결을 건드리는 일은 한 줄에 세운다. 갈아타기가 겹치면 양쪽을 다 놓친다 */
  private readonly queue = new SerialQueue()

  constructor(private readonly candidates: readonly MessageTransport[]) {
    if (candidates.length === 0) {
      throw new Error('길이 하나도 없이 만들 수 없다')
    }
  }

  /** 지금 쓰는 길. 아직 안 붙었으면 첫 후보의 종류를 말한다 */
  get kind(): LinkKind {
    return this.active?.kind ?? this.candidates[0]?.kind ?? 'wifi'
  }

  async connect(): Promise<Result<void, DomainError>> {
    return this.queue.run(async () => {
      const searching = this.state.startSearching()
      if (searching.ok) this.setState(searching.value)

      // 우선순위대로 시도한다. 하나 되면 멈춘다.
      for (const candidate of this.candidates) {
        const opened = await candidate.connect()
        if (!opened.ok) continue

        this.adopt(candidate)
        await this.drainOutbox()
        return ok(undefined)
      }

      return err(domainError('not-found', '열 수 있는 길이 없다', 'transport'))
    })
  }

  async disconnect(): Promise<void> {
    await this.queue.run(async () => {
      for (const candidate of this.candidates) {
        this.unsubscribe(candidate)
        await candidate.disconnect()
      }

      this.active = null
      const stopped = this.state.stop()
      if (stopped.ok) this.setState(stopped.value)
    })
  }

  async send(envelope: Envelope): Promise<Result<void, DomainError>> {
    const active = this.active

    if (active === null || !this.state.isUsable()) {
      // 갈아타는 중이거나 아직 안 붙었다. 잃어버리지 않고 쌓아둔다.
      this.outbox.push(envelope)
      return err(domainError('not-found', '연결이 없어 대기 줄에 넣었다', 'transport'))
    }

    return active.send(envelope)
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
    return this.active?.quality() ?? LinkQuality.unknown(this.kind)
  }

  /**
   * 더 좋은 길이 있는지 보고, 있으면 옮긴다.
   *
   * 점수가 충분히 높아야 옮긴다. 안 그러면 두 길 사이를 계속 오간다.
   */
  async considerSwitching(): Promise<Result<SwitchOutcome, DomainError>> {
    return this.queue.run(async () => {
      const current = this.active
      if (current === null) return ok({ switched: false, reason: 'no-active' } as const)

      const better = this.findBetter(current)
      if (better === null)
        return ok({ switched: false, reason: 'current-is-best' } as const)

      const switching = this.state.startSwitching(better.kind)
      if (!switching.ok) return switching
      this.setState(switching.value)

      // 1. 새 길을 먼저 연다. 옛 길은 아직 살아 있다.
      const opened = await better.connect()
      if (!opened.ok) {
        const back = this.state.abandonSwitch()
        if (back.ok) this.setState(back.value)
        return ok({ switched: false, reason: 'new-link-failed' } as const)
      }

      // 2. 보낼 것을 새 길로 돌린다.
      const previous = current
      this.adopt(better)

      // 3. 그제서야 옛 길을 놓는다.
      this.unsubscribe(previous)
      await previous.disconnect()

      await this.drainOutbox()

      return ok({ switched: true, from: previous.kind, to: better.kind } as const)
    })
  }

  private findBetter(current: MessageTransport): MessageTransport | null {
    for (const candidate of this.candidates) {
      if (candidate === current) continue
      if (shouldSwitch(current.quality(), candidate.quality())) return candidate
    }
    return null
  }

  private adopt(next: MessageTransport): void {
    this.active = next

    const unsubscribes: Unsubscribe[] = [
      next.onReceive(envelope => {
        for (const handler of this.receiveHandlers) handler(envelope)
      }),
      next.onStateChange(state => {
        // 갈아타는 중에는 아래쪽 상태를 그대로 따르지 않는다.
        // 옛 길이 끊기는 것은 우리가 일부러 한 일이다.
        if (this.state.phase === 'switching') return

        if (!state.isUsable() && this.state.isUsable()) {
          const lost = this.state.lose()
          if (lost.ok) this.setState(lost.value)
          return
        }

        if (state.isSettled() && !this.state.isSettled()) {
          const established = this.toConnected(next.kind)
          if (established.ok) this.setState(established.value)
        }
      }),
    ]

    this.subscriptions.set(next, unsubscribes)

    const established = this.toConnected(next.kind)
    if (established.ok) this.setState(established.value)
  }

  private toConnected(kind: LinkKind): Result<ConnectionState, DomainError> {
    if (this.state.phase === 'switching') return this.state.establish()

    if (this.state.phase === 'searching') {
      const handshaking = this.state.startHandshake(kind)
      if (!handshaking.ok) return handshaking
      return handshaking.value.establish()
    }

    if (this.state.phase === 'handshaking') return this.state.establish()

    return ok(ConnectionState.connected(kind))
  }

  private unsubscribe(transport: MessageTransport): void {
    for (const stop of this.subscriptions.get(transport) ?? []) stop()
    this.subscriptions.delete(transport)
  }

  private setState(next: ConnectionState): void {
    this.state = next
    for (const handler of this.stateHandlers) handler(next)
  }

  /** 쌓아둔 것을 내보낸다. 순서 그대로 하나씩 */
  private async drainOutbox(): Promise<void> {
    while (this.outbox.length > 0) {
      const next = this.outbox[0]
      if (next === undefined) break

      const sent = await this.active?.send(next)
      if (sent === undefined || !sent.ok) break

      this.outbox.shift()
    }
  }

  /** 아직 못 보낸 것이 몇 개인가. 화면에 표시할 때 쓴다 */
  pendingCount(): number {
    return this.outbox.length
  }
}

export type SwitchOutcome =
  | { readonly switched: true; readonly from: LinkKind; readonly to: LinkKind }
  | {
      readonly switched: false
      readonly reason: 'no-active' | 'current-is-best' | 'new-link-failed'
    }
