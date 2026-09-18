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
 * 브라우저 안에 담아두는 저장소.
 *
 * 실제 앱은 SQLite 를 쓴다. 여기서는 그럴 수 없으니 같은 약속만 지키는
 * 것을 만든다. **위층은 이게 무엇인지 모른다.**
 *
 * 창을 닫으면 사라진다. 데모라서 그걸로 충분하다.
 */
export class MemoryRepository implements ConversationRepository {
  private readonly messages = new Map<string, Message>()
  private readonly listeners = new Set<() => void>()

  async load(me: PeerId): Promise<Result<Conversation, DomainError>> {
    let conversation = Conversation.start(me)

    for (const message of this.sorted()) {
      conversation = conversation.accept(message).conversation
    }

    return ok(conversation)
  }

  async save(message: Message): Promise<Result<void, DomainError>> {
    if (this.messages.has(message.id)) {
      return err(domainError('duplicate', '이미 있는 메시지다', 'id'))
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
      if (this.messages.has(message.id)) {
        skipped += 1
        continue
      }
      this.messages.set(message.id, message)
      inserted += 1
    }

    this.notify()
    return ok({ inserted, skipped })
  }

  async updateDelivery(message: Message): Promise<Result<void, DomainError>> {
    if (!this.messages.has(message.id)) {
      return err(domainError('not-found', '그런 메시지가 없다', 'id'))
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
    const all = this.sorted()

    if (options.before === undefined) {
      return ok(all.slice(Math.max(0, all.length - options.limit)))
    }

    const at = all.findIndex(m => m.id === options.before?.id)
    if (at < 0) return ok([])

    return ok(all.slice(Math.max(0, at - options.limit), at))
  }

  async findWaitingToSend(): Promise<Result<Message[], DomainError>> {
    return ok(this.sorted().filter(message => message.isWaitingToSend()))
  }

  async count(): Promise<Result<number, DomainError>> {
    return ok(this.messages.size)
  }

  async *streamAll(batchSize: number): AsyncIterable<Message[]> {
    const all = this.sorted()
    for (let at = 0; at < all.length; at += batchSize) {
      yield all.slice(at, at + batchSize)
    }
  }

  onChange(handler: () => void): Unsubscribe {
    this.listeners.add(handler)
    return () => this.listeners.delete(handler)
  }

  /**
   * 줄 세우기.
   *
   * **받은 시각을 기준으로 삼는다.** 두 폰의 시계가 다를 수 있어서,
   * 보낸 시각으로 세우면 순서가 뒤엉킨다.
   */
  private sorted(): Message[] {
    return [...this.messages.values()].sort((a, b) => {
      const gap = a.orderedAt().getTime() - b.orderedAt().getTime()
      return gap !== 0 ? gap : a.id.localeCompare(b.id)
    })
  }

  private notify(): void {
    for (const listener of this.listeners) listener()
  }
}
