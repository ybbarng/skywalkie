import type { Conversation } from '@/domain/message/Conversation'
import { Message } from '@/domain/message/Message'
import type { MessageContent } from '@/domain/message/MessageContent'
import { messageId } from '@/domain/message/MessageId'
import type { PeerId } from '@/domain/peer/PeerId'
import type { Clock } from '@/domain/shared/Clock'
import { type DomainError, domainError } from '@/domain/shared/DomainError'
import type { IdGenerator } from '@/domain/shared/IdGenerator'
import { err, ok, type Result } from '@/domain/shared/Result'
import type { ConversationRepository } from '../ports/ConversationRepository'
import { PROTOCOL_VERSION } from '../ports/Envelope'
import type { MessageTransport } from '../ports/MessageTransport'

/**
 * 메시지를 보낸다.
 *
 * **순서가 이 파일의 전부다.**
 *
 *   1. 메시지를 만든다
 *   2. 저장한다        ← 보내기 전에
 *   3. 보낸다
 *   4. 결과에 따라 상태를 고친다
 *
 * 반대로 하면 전송 도중 앱이 죽었을 때 메시지가 사라진다. 먼저 저장하면
 * 최악의 경우에도 "보내려던 것"이 남고, 앱을 다시 켤 때 자동으로 나간다.
 *
 * 전송에 실패해도 실패로 두지 않고 대기 줄에 둔다. 연결이 끊기는 건
 * 이 앱에서 예외가 아니라 늘 있는 일이다.
 * (docs/05-messaging-spec.md 3장)
 */
export class SendMessage {
  constructor(
    private readonly transport: MessageTransport,
    private readonly repository: ConversationRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(
    input: SendMessageInput,
  ): Promise<Result<SendMessageOutput, DomainError>> {
    const built = this.buildMessage(input)
    if (!built.ok) return built
    const { message, conversation } = built.value

    // 2. 먼저 저장한다. 전송에 실패해도, 앱이 죽어도 남는다.
    const saved = await this.repository.save(message)
    if (!saved.ok) return saved

    // 3. 보낸다
    const sending = message.markSending()
    if (!sending.ok) return sending

    const delivered = await this.transport.send({
      v: PROTOCOL_VERSION,
      t: 'message',
      id: this.ids.next(),
      seq: message.seq,
      ts: this.clock.epochMillis(),
      p: {
        messageId: message.id,
        author: message.author,
        content: message.content,
        sentAt: message.sentAt.getTime(),
        messageSeq: message.seq,
      },
    })

    // 4. 결과를 반영한다.
    //    전송에 실패해도 '실패'로 두지 않는다. 연결이 끊기는 건 이 앱에서
    //    예외가 아니라 늘 있는 일이라, 대기 줄에 두고 자동으로 내보낸다.
    const next = delivered.ok ? ok(sending.value) : message.markPending()
    const finalMessage = next.ok ? next.value : message
    const updated = await this.repository.updateDelivery(finalMessage)
    if (!updated.ok) return updated

    return ok({
      message: finalMessage,
      conversation,
      sentNow: delivered.ok,
    })
  }

  private buildMessage(
    input: SendMessageInput,
  ): Result<{ message: Message; conversation: Conversation }, DomainError> {
    const id = messageId(this.ids.next())
    if (!id.ok) {
      return err(domainError('invalid-value', '메시지 식별자를 만들지 못했다', 'id'))
    }

    const { seq, conversation } = input.conversation.takeOutgoingSeq()

    const message = Message.draft({
      id: id.value,
      author: input.author,
      content: input.content,
      seq,
      now: this.clock.now(),
    })
    if (!message.ok) return message

    return ok({ message: message.value, conversation })
  }
}

export interface SendMessageInput {
  readonly author: PeerId
  readonly content: MessageContent
  readonly conversation: Conversation
}

export interface SendMessageOutput {
  readonly message: Message
  readonly conversation: Conversation
  /** 지금 바로 나갔는지. false 면 대기 줄에 들어갔다 */
  readonly sentNow: boolean
}
