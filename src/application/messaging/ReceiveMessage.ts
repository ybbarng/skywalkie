import type { Conversation } from '@/domain/message/Conversation'
import { Message } from '@/domain/message/Message'
import { messageId } from '@/domain/message/MessageId'
import { peerId } from '@/domain/peer/PeerId'
import type { Clock } from '@/domain/shared/Clock'
import type { DomainError } from '@/domain/shared/DomainError'
import type { IdGenerator } from '@/domain/shared/IdGenerator'
import { ok, type Result } from '@/domain/shared/Result'
import type { ConversationRepository } from '../ports/ConversationRepository'
import { type MessagePayload, PROTOCOL_VERSION } from '../ports/Envelope'
import type { MessageTransport } from '../ports/MessageTransport'

/**
 * 상대에게서 메시지를 받았다.
 *
 * 이미 있는 것이면 **조용히 버리고 받았다는 답만 다시 보낸다.**
 * 같은 메시지가 두 번 오는 건 흔한 일이다. 답이 유실됐거나
 * 길을 갈아탔을 때 그렇게 된다. 오류로 다루면 화면이 시끄러워진다.
 */
export class ReceiveMessage {
  constructor(
    private readonly repository: ConversationRepository,
    private readonly transport: MessageTransport,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(
    input: ReceiveMessageInput,
  ): Promise<Result<ReceiveMessageOutput, DomainError>> {
    const built = this.rebuild(input.payload)
    if (!built.ok) return built
    const message = built.value

    const accepted = input.conversation.accept(message)

    if (!accepted.accepted) {
      // 이미 본 메시지. 상대가 답을 못 받았을 뿐이니 답만 다시 보낸다.
      await this.sendAck(message.id)
      return ok({
        conversation: input.conversation,
        message,
        isNew: false,
      })
    }

    const saved = await this.repository.save(message)
    if (!saved.ok) {
      // 저장소가 중복이라고 하면 Conversation 이 잊어버린 것이다.
      // 이것도 정상이라 답을 보내고 넘어간다.
      if (saved.error.code === 'duplicate') {
        await this.sendAck(message.id)
        return ok({ conversation: input.conversation, message, isNew: false })
      }
      return saved
    }

    await this.sendAck(message.id)

    return ok({
      conversation: accepted.conversation,
      message,
      isNew: true,
    })
  }

  private rebuild(payload: MessagePayload): Result<Message, DomainError> {
    const id = messageId(payload.messageId)
    if (!id.ok) return id

    const author = peerId(payload.author)
    if (!author.ok) return author

    return Message.received({
      id: id.value,
      author: author.value,
      content: payload.content,
      seq: payload.messageSeq,
      sentAt: new Date(payload.sentAt),
      now: this.clock.now(),
    })
  }

  private async sendAck(id: string): Promise<void> {
    // 답이 못 가도 큰일이 아니다. 상대가 다시 보내면 또 답한다.
    await this.transport.send({
      v: PROTOCOL_VERSION,
      t: 'ack',
      id: this.ids.next(),
      seq: 0,
      ts: this.clock.epochMillis(),
      p: { messageId: id },
    })
  }
}

export interface ReceiveMessageInput {
  readonly payload: MessagePayload
  readonly conversation: Conversation
}

export interface ReceiveMessageOutput {
  readonly conversation: Conversation
  readonly message: Message
  /** 처음 보는 메시지인지. false 면 이미 있어서 버렸다 */
  readonly isNew: boolean
}
