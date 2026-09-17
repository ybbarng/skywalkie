import type { LinkKind } from '@/domain/connection/LinkKind'
import { deliveryStates } from '@/domain/message/DeliveryState'
import { Message } from '@/domain/message/Message'
import type { MessageContent } from '@/domain/message/MessageContent'
import { messageId } from '@/domain/message/MessageId'
import { peerId } from '@/domain/peer/PeerId'
import { type DomainError, domainError } from '@/domain/shared/DomainError'
import { err, ok, type Result } from '@/domain/shared/Result'
import type { MessageRow } from '../schema'

/**
 * 도메인 객체와 표의 한 줄 사이를 옮긴다.
 *
 * **읽을 때도 검사한다.** 저장할 때 올바랐다고 해서 읽을 때도 올바르다는
 * 보장이 없다. 되돌리기로 들어온 파일이 손상됐을 수 있고, 예전 버전이
 * 만든 값이 섞여 있을 수 있다.
 */
export const MessageMapper = {
  toRow(message: Message, linkKind: LinkKind | null = null): MessageRow {
    return {
      id: message.id,
      author_id: message.author,
      content_kind: message.content.kind,
      content_body: JSON.stringify(message.content),
      sent_at: message.sentAt.getTime(),
      received_at: message.receivedAt?.getTime() ?? null,
      seq: message.seq,
      delivery: message.delivery,
      link_kind: linkKind,
    }
  },

  toDomain(row: MessageRow): Result<Message, DomainError> {
    const id = messageId(row.id)
    if (!id.ok) return id

    const author = peerId(row.author_id)
    if (!author.ok) return author

    const content = parseContent(row.content_body, row.content_kind)
    if (!content.ok) return content

    const delivery = deliveryStates.find(state => state === row.delivery)
    if (delivery === undefined) {
      return err(
        domainError('invalid-value', `모르는 전달 상태다: ${row.delivery}`, 'delivery'),
      )
    }

    return Message.compose({
      id: id.value,
      author: author.value,
      content: content.value,
      sentAt: new Date(row.sent_at),
      receivedAt: row.received_at === null ? null : new Date(row.received_at),
      seq: row.seq,
      delivery,
    })
  },
}

function parseContent(body: string, kind: string): Result<MessageContent, DomainError> {
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    // 저장소가 망가졌거나 손으로 고친 파일이 들어왔다
    return err(domainError('invalid-value', '메시지 내용을 읽지 못했다', 'content'))
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return err(domainError('invalid-value', '메시지 내용이 올바르지 않다', 'content'))
  }

  const content = parsed as { kind?: unknown }
  if (content.kind !== kind) {
    // 표의 종류 항목과 내용이 어긋났다. 둘 중 하나가 손상된 것이다.
    return err(domainError('invalid-value', '메시지 종류가 내용과 어긋난다', 'content'))
  }

  return ok(parsed as MessageContent)
}
