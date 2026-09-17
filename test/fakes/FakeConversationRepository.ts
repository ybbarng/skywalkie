import type {
  ConversationRepository,
  PageOptions,
  SaveManyOutcome,
} from '@/application/ports/ConversationRepository'
import type { Unsubscribe } from '@/application/ports/MessageTransport'
import { Conversation } from '@/domain/message/Conversation'
import type { Message } from '@/domain/message/Message'
import type { MessageId } from '@/domain/message/MessageId'
import type { PeerId } from '@/domain/peer/PeerId'
import { type DomainError, domainError } from '@/domain/shared/DomainError'
import { err, ok, type Result } from '@/domain/shared/Result'

/**
 * 메모리에만 담는 저장소.
 *
 * 실제 저장소와 **같은 규칙**을 지킨다. 특히 같은 식별자를 두 번 넣으면
 * 거절한다. 실제는 데이터베이스 기본 키가 막고 여기서는 손으로 막는데,
 * 이게 다르면 테스트가 통과해도 실제에서 깨진다.
 */
export class FakeConversationRepository implements ConversationRepository {
  private readonly messages = new Map<MessageId, Message>()
  private readonly listeners = new Set<() => void>()

  /**
   * 일부러 실패시킬 것들.
   *
   * 저장소가 고장났을 때 앱이 어떻게 되는지 시험하려고 둔다.
   * 기기 저장 공간이 꽉 차면 실제로 이런 일이 생긴다.
   */
  failNextSave: DomainError | null = null
  failNextUpdate: DomainError | null = null
  failNextLoad: DomainError | null = null
  failNextFindWaiting: DomainError | null = null

  /** 몇 번 저장을 시도했나 */
  saveAttempts = 0

  async load(me: PeerId): Promise<Result<Conversation, DomainError>> {
    const failure = this.takeFailure('failNextLoad')
    if (failure !== null) return err(failure)

    let conversation = Conversation.start(me)

    // 실제 저장소도 저장된 메시지로부터 대화 상태를 되살린다.
    // 특히 내 순번을 이어가는 게 중요하다.
    for (const message of this.sortedMessages()) {
      conversation = conversation.accept(message).conversation
    }

    return ok(conversation)
  }

  async save(message: Message): Promise<Result<void, DomainError>> {
    this.saveAttempts += 1

    const failure = this.takeFailure('failNextSave')
    if (failure !== null) return err(failure)

    if (this.messages.has(message.id)) {
      return err(domainError('duplicate', '이미 있는 메시지다', 'id'))
    }

    for (const existing of this.messages.values()) {
      if (existing.author === message.author && existing.seq === message.seq) {
        return err(domainError('duplicate', '이미 있는 순번이다', 'seq'))
      }
    }

    this.messages.set(message.id, message)
    this.notify()
    return ok(undefined)
  }

  async saveMany(
    messages: readonly Message[],
  ): Promise<Result<SaveManyOutcome, DomainError>> {
    let inserted = 0
    let skipped = 0

    for (const message of messages) {
      const result = await this.save(message)
      if (result.ok) inserted += 1
      else if (result.error.code === 'duplicate') skipped += 1
      else return result
    }

    return ok({ inserted, skipped })
  }

  async updateDelivery(message: Message): Promise<Result<void, DomainError>> {
    const failure = this.takeFailure('failNextUpdate')
    if (failure !== null) return err(failure)

    if (!this.messages.has(message.id)) {
      return err(domainError('not-found', '없는 메시지다', 'id'))
    }
    this.messages.set(message.id, message)
    this.notify()
    return ok(undefined)
  }

  async findById(id: MessageId): Promise<Result<Message | null, DomainError>> {
    return ok(this.messages.get(id) ?? null)
  }

  async findBySeq(
    author: PeerId,
    seq: number,
  ): Promise<Result<Message | null, DomainError>> {
    for (const message of this.messages.values()) {
      if (message.author === author && message.seq === seq) return ok(message)
    }
    return ok(null)
  }

  async loadPage(options: PageOptions): Promise<Result<Message[], DomainError>> {
    // 실제와 같이 최신부터 꺼낸다
    const all = this.sortedMessages().reverse()
    const before = options.before

    if (before === undefined) {
      return ok(all.slice(0, options.limit).reverse())
    }

    // 실제 저장소의 SQL 과 같은 기준으로 자른다.
    // 시각이 같으면 식별자로 순서를 가른다.
    const start = all.findIndex(
      message =>
        message.orderedAt().getTime() < before.orderedAt ||
        (message.orderedAt().getTime() === before.orderedAt && message.id < before.id),
    )

    if (start === -1) return ok([])

    return ok(all.slice(start, start + options.limit).reverse())
  }

  async findWaitingToSend(): Promise<Result<Message[], DomainError>> {
    const failure = this.takeFailure('failNextFindWaiting')
    if (failure !== null) return err(failure)

    // 순번 순서대로 준다. 순서가 뒤바뀌면 대화가 이상해진다.
    const waiting = [...this.messages.values()]
      .filter(message => message.isWaitingToSend())
      .sort((a, b) => a.seq - b.seq)

    return ok(waiting)
  }

  async count(): Promise<Result<number, DomainError>> {
    return ok(this.messages.size)
  }

  async *streamAll(batchSize: number): AsyncIterable<Message[]> {
    const all = this.sortedMessages()
    for (let i = 0; i < all.length; i += batchSize) {
      yield all.slice(i, i + batchSize)
    }
  }

  onChange(handler: () => void): Unsubscribe {
    this.listeners.add(handler)
    return () => this.listeners.delete(handler)
  }

  /** 테스트에서 들여다볼 때 */
  all(): Message[] {
    return this.sortedMessages()
  }

  /** 한 번 쓰고 없앤다. 실패가 계속 이어지면 다음 테스트에 새어 나간다 */
  private takeFailure(
    key: 'failNextSave' | 'failNextUpdate' | 'failNextLoad' | 'failNextFindWaiting',
  ): DomainError | null {
    const error = this[key]
    if (error === null) return null
    this[key] = null
    return error
  }

  private sortedMessages(): Message[] {
    return [...this.messages.values()].sort((a, b) => {
      const diff = a.orderedAt().getTime() - b.orderedAt().getTime()
      return diff !== 0 ? diff : a.id < b.id ? -1 : 1
    })
  }

  private notify(): void {
    for (const listener of this.listeners) listener()
  }
}
