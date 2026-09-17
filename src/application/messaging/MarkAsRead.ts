import type { Conversation } from '@/domain/message/Conversation'
import type { Message } from '@/domain/message/Message'
import type { PeerId } from '@/domain/peer/PeerId'
import type { Clock } from '@/domain/shared/Clock'
import type { DomainError } from '@/domain/shared/DomainError'
import type { IdGenerator } from '@/domain/shared/IdGenerator'
import { ok, type Result } from '@/domain/shared/Result'
import type { ConversationRepository } from '../ports/ConversationRepository'
import { PROTOCOL_VERSION } from '../ports/Envelope'
import type { MessageTransport } from '../ports/MessageTransport'

/**
 * 메시지를 읽었다.
 *
 * 화면에 실제로 보이고 앱이 앞에 있을 때만 부른다.
 *
 * **여러 건을 묶어 한 번에 보낸다.** 스크롤 한 번에 수십 건이 읽히는데
 * 건마다 보내면 좁은 길이 막힌다.
 *
 * 읽음 신호가 못 갔다고 다시 보내지 않는다. 중요도가 낮고 다음 신호가
 * 덮어쓰기 때문이다.
 */
export class MarkAsRead {
  constructor(
    private readonly repository: ConversationRepository,
    private readonly transport: MessageTransport,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: MarkAsReadInput): Promise<Result<MarkAsReadOutput, DomainError>> {
    // 내가 쓴 것과 이미 읽은 것은 뺀다
    const unread = input.messages.filter(
      message => !message.isMine(input.me) && message.delivery === 'delivered',
    )

    if (unread.length === 0) {
      return ok({ conversation: input.conversation, readCount: 0 })
    }

    const readIds: string[] = []
    for (const message of unread) {
      const marked = message.markRead()
      if (!marked.ok) continue

      const updated = await this.repository.updateDelivery(marked.value)
      if (!updated.ok) return updated

      readIds.push(message.id)
    }

    const conversation = input.conversation.markRead(readIds.length)
    if (!conversation.ok) return conversation

    if (readIds.length > 0) {
      await this.transport.send({
        v: PROTOCOL_VERSION,
        t: 'read',
        id: this.ids.next(),
        seq: 0,
        ts: this.clock.epochMillis(),
        p: { messageIds: readIds },
      })
    }

    return ok({ conversation: conversation.value, readCount: readIds.length })
  }
}

export interface MarkAsReadInput {
  readonly me: PeerId
  readonly messages: readonly Message[]
  readonly conversation: Conversation
}

export interface MarkAsReadOutput {
  readonly conversation: Conversation
  readonly readCount: number
}
