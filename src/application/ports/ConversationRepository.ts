import type { Conversation } from '@/domain/message/Conversation'
import type { Message } from '@/domain/message/Message'
import type { MessageId } from '@/domain/message/MessageId'
import type { PeerId } from '@/domain/peer/PeerId'
import type { DomainError } from '@/domain/shared/DomainError'
import type { Result } from '@/domain/shared/Result'
import type { Unsubscribe } from './MessageTransport'

/**
 * 대화를 보관하는 무언가.
 *
 * 메시지는 기기에 남아야 한다. 비행기에서 내린 뒤에도 다시 볼 수 있어야
 * 하고, 아이폰 앱을 다시 깔아도 살아남아야 한다.
 */
export interface ConversationRepository {
  /** 앱을 켤 때 대화 상태를 되살린다 */
  load(me: PeerId): Promise<Result<Conversation, DomainError>>

  /**
   * 메시지를 저장한다.
   *
   * 이미 있는 식별자면 `duplicate` 로 실패한다. 이 판단의 최종 보루는
   * 저장소다. Conversation 이 먼저 거르지만 잊어버린 것이 있을 수 있다.
   */
  save(message: Message): Promise<Result<void, DomainError>>

  /** 여러 건을 한 번에. 되돌리기에서 쓴다 */
  saveMany(messages: readonly Message[]): Promise<Result<SaveManyOutcome, DomainError>>

  /** 상태만 고친다 */
  updateDelivery(message: Message): Promise<Result<void, DomainError>>

  findById(id: MessageId): Promise<Result<Message | null, DomainError>>

  /** 그 사람의 그 순번 메시지. 놓친 것을 다시 보낼 때 쓴다 */
  findBySeq(author: PeerId, seq: number): Promise<Result<Message | null, DomainError>>

  /**
   * 화면에 보여줄 만큼만 꺼낸다.
   *
   * 몇 번째부터 몇 개가 아니라 **마지막으로 본 지점 앞으로** 꺼낸다.
   * 메시지가 쌓여도 늘 같은 속도여야 하기 때문이다.
   */
  loadPage(options: PageOptions): Promise<Result<Message[], DomainError>>

  /** 연결이 돌아왔을 때 내보낼 것들. 순번 순서대로 준다 */
  findWaitingToSend(): Promise<Result<Message[], DomainError>>

  /** 전부 몇 건인가. 내보내기에서 진행률을 보여줄 때 쓴다 */
  count(): Promise<Result<number, DomainError>>

  /**
   * 전부 훑는다. 한 번에 다 읽지 않고 흘려가며 준다.
   * 만 건을 내보낼 때 메모리가 터지지 않게 하려는 것이다.
   */
  streamAll(batchSize: number): AsyncIterable<Message[]>

  /** 메시지가 들어오거나 바뀌면 알려준다 */
  onChange(handler: () => void): Unsubscribe
}

export interface PageOptions {
  /** 이 지점 앞의 것을 꺼낸다. 없으면 가장 최근부터 */
  readonly before?: { readonly orderedAt: number; readonly id: MessageId }
  readonly limit: number
}

export interface SaveManyOutcome {
  readonly inserted: number
  /** 이미 있어서 건너뛴 개수 */
  readonly skipped: number
}
