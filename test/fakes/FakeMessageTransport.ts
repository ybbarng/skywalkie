import type { Envelope } from '@/application/ports/Envelope'
import type { MessageTransport, Unsubscribe } from '@/application/ports/MessageTransport'
import { ConnectionState } from '@/domain/connection/ConnectionState'
import type { LinkKind } from '@/domain/connection/LinkKind'
import { LinkQuality } from '@/domain/connection/LinkQuality'
import { type DomainError, domainError } from '@/domain/shared/DomainError'
import { err, ok, type Result } from '@/domain/shared/Result'

/**
 * 보낸 것을 기록하는 가짜 연결.
 *
 * 실패를 일부러 만들 수 있어서 "연결이 끊긴 채로 보냈을 때" 같은 상황을
 * 진짜 Wi-Fi 없이 시험할 수 있다.
 */
export class FakeMessageTransport implements MessageTransport {
  readonly sent: Envelope[] = []

  private state: ConnectionState
  private linkQuality: LinkQuality
  private readonly receiveHandlers = new Set<(envelope: Envelope) => void>()
  private readonly stateHandlers = new Set<(state: ConnectionState) => void>()

  /** 앞으로 몇 번을 실패시킬까. -1 이면 계속 실패 */
  failCount = 0

  constructor(readonly kind: LinkKind = 'wifi') {
    this.state = ConnectionState.connected(kind)
    this.linkQuality = LinkQuality.unknown(kind)
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
    if (this.failCount !== 0) {
      if (this.failCount > 0) this.failCount -= 1
      return err(domainError('not-found', '보내지 못했다', 'transport'))
    }

    if (!this.state.isUsable()) {
      return err(domainError('not-found', '연결이 없다', 'transport'))
    }

    this.sent.push(envelope)
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

  /** 상대가 봉투를 보낸 것처럼 만든다 */
  deliver(envelope: Envelope): void {
    for (const handler of this.receiveHandlers) handler(envelope)
  }

  /** 연결이 끊긴 것처럼 만든다 */
  loseConnection(): void {
    const lost = this.state.lose()
    if (lost.ok) this.setState(lost.value)
  }

  setQuality(quality: LinkQuality): void {
    this.linkQuality = quality
  }

  /** 보낸 것 중 이 종류만 골라 본다 */
  sentOfType<T extends Envelope['t']>(type: T): Array<Extract<Envelope, { t: T }>> {
    return this.sent.filter((e): e is Extract<Envelope, { t: T }> => e.t === type)
  }

  private setState(next: ConnectionState): void {
    this.state = next
    for (const handler of this.stateHandlers) handler(next)
  }
}
