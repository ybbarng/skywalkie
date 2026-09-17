import type { Conversation } from '@/domain/message/Conversation'
import type { Message } from '@/domain/message/Message'
import type { MessageId } from '@/domain/message/MessageId'
import type { PeerId } from '@/domain/peer/PeerId'
import type { DomainError } from '@/domain/shared/DomainError'
import { ok, type Result } from '@/domain/shared/Result'
import type { ConversationRepository } from '../ports/ConversationRepository'

/** 한 번에 꺼내는 메시지 개수 */
export const PAGE_SIZE = 50

/**
 * 대화를 되살리고 화면에 보여줄 만큼 꺼낸다.
 *
 * 메시지가 만 건이 되어도 첫 화면이 늦게 뜨면 안 된다. 그래서 전부
 * 읽지 않고 최근 것부터 한 쪽씩 꺼낸다.
 */
export class LoadConversation {
  constructor(private readonly repository: ConversationRepository) {}

  /** 앱을 켤 때 */
  async initial(me: PeerId): Promise<Result<LoadedPage, DomainError>> {
    const conversation = await this.repository.load(me)
    if (!conversation.ok) return conversation

    const page = await this.repository.loadPage({ limit: PAGE_SIZE })
    if (!page.ok) return page

    return ok({
      conversation: conversation.value,
      messages: page.value,
      hasMore: page.value.length === PAGE_SIZE,
    })
  }

  /** 위로 올려서 옛 메시지를 더 볼 때 */
  async older(
    oldest: Message,
  ): Promise<Result<{ messages: Message[]; hasMore: boolean }, DomainError>> {
    const page = await this.repository.loadPage({
      before: { orderedAt: oldest.orderedAt().getTime(), id: oldest.id },
      limit: PAGE_SIZE,
    })
    if (!page.ok) return page

    return ok({ messages: page.value, hasMore: page.value.length === PAGE_SIZE })
  }
}

export interface LoadedPage {
  readonly conversation: Conversation
  /** 최신이 마지막에 오도록 정렬되어 있다 */
  readonly messages: readonly Message[]
  readonly hasMore: boolean
}

export type { MessageId }
