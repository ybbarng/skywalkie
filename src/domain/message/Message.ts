import type { PeerId } from '../peer/PeerId'
import { type DomainError, domainError } from '../shared/DomainError'
import { err, flatMap, map, ok, type Result } from '../shared/Result'
import {
  type DeliveryState,
  hasReachedPeer,
  isWaitingToSend,
  transition,
} from './DeliveryState'
import type { MessageContent } from './MessageContent'
import type { MessageId } from './MessageId'

/**
 * 한 사람이 특정 시각에 상대에게 보낸 한 덩어리의 내용.
 *
 * 한 번 보내면 내용은 바뀌지 않는다. 바뀌는 건 어디까지 갔는지뿐이다.
 * 그래서 상태를 고칠 때 이 객체를 고치지 않고 새 객체를 만든다.
 *
 * 생성자를 감춘 이유: 검사를 통과하지 못한 Message 가 존재하지 못하게
 * 하기 위해서다. 화면이든 통신이든 저장소든, 손에 든 Message 는
 * 언제나 올바른 값이다. (docs/03-architecture.md domain 규칙)
 */
export class Message {
  private constructor(
    readonly id: MessageId,
    readonly author: PeerId,
    readonly content: MessageContent,
    /** 보낸 기기의 시각 */
    readonly sentAt: Date,
    /** 받은 기기의 시각. 내가 보낸 것이면 없다 */
    readonly receivedAt: Date | null,
    /** 보낸 사람 기준 순번 */
    readonly seq: number,
    readonly delivery: DeliveryState,
  ) {}

  static compose(input: ComposeInput): Result<Message, DomainError> {
    const seqCheck = validateSeq(input.seq)
    if (!seqCheck.ok) return seqCheck

    if (!isValidDate(input.sentAt)) {
      return err(domainError('invalid-value', '보낸 시각이 올바르지 않다', 'sentAt'))
    }

    if (input.receivedAt !== null && !isValidDate(input.receivedAt)) {
      return err(domainError('invalid-value', '받은 시각이 올바르지 않다', 'receivedAt'))
    }

    return ok(
      new Message(
        input.id,
        input.author,
        input.content,
        input.sentAt,
        input.receivedAt,
        input.seq,
        input.delivery,
      ),
    )
  }

  /** 내가 지금 쓴 메시지. 아직 보내지 않았다 */
  static draft(input: DraftInput): Result<Message, DomainError> {
    return Message.compose({
      id: input.id,
      author: input.author,
      content: input.content,
      sentAt: input.now,
      receivedAt: null,
      seq: input.seq,
      delivery: 'draft',
    })
  }

  /** 상대에게서 방금 받은 메시지 */
  static received(input: ReceivedInput): Result<Message, DomainError> {
    return Message.compose({
      id: input.id,
      author: input.author,
      content: input.content,
      sentAt: input.sentAt,
      receivedAt: input.now,
      seq: input.seq,
      // 받은 메시지는 이미 도착한 것이다
      delivery: 'delivered',
    })
  }

  /** 상태를 옮긴다. 규칙에 어긋나면 값이 바뀌지 않고 실패가 돌아온다 */
  withDelivery(next: DeliveryState): Result<Message, DomainError> {
    return map(
      transition(this.delivery, next),
      state =>
        new Message(
          this.id,
          this.author,
          this.content,
          this.sentAt,
          this.receivedAt,
          this.seq,
          state,
        ),
    )
  }

  markSending(): Result<Message, DomainError> {
    return this.withDelivery('sending')
  }

  markDelivered(): Result<Message, DomainError> {
    return this.withDelivery('delivered')
  }

  markRead(): Result<Message, DomainError> {
    return this.withDelivery('read')
  }

  /** 연결이 끊겨 기다린다. 사라지지 않는다 */
  markPending(): Result<Message, DomainError> {
    return this.withDelivery('pending')
  }

  markFailed(): Result<Message, DomainError> {
    return this.withDelivery('failed')
  }

  /** 사용자가 다시 보내기를 눌렀다 */
  retry(): Result<Message, DomainError> {
    return flatMap(this.withDelivery('pending'), message => ok(message))
  }

  /** 받은 시각을 채운다. 저장소에서 꺼낸 것을 되살릴 때 쓴다 */
  withReceivedAt(at: Date): Result<Message, DomainError> {
    if (!isValidDate(at)) {
      return err(domainError('invalid-value', '받은 시각이 올바르지 않다', 'receivedAt'))
    }

    return ok(
      new Message(
        this.id,
        this.author,
        this.content,
        this.sentAt,
        at,
        this.seq,
        this.delivery,
      ),
    )
  }

  isMine(me: PeerId): boolean {
    return this.author === me
  }

  isWaitingToSend(): boolean {
    return isWaitingToSend(this.delivery)
  }

  hasReachedPeer(): boolean {
    return hasReachedPeer(this.delivery)
  }

  /**
   * 화면에 줄 세울 때 쓰는 시각.
   *
   * 받은 시각을 기준으로 삼는 이유: 두 폰의 시계가 다를 수 있고,
   * 특히 시차를 넘는 비행에서는 한쪽이 먼저 시간대를 바꾼다.
   * 내 기기에서 본 순서가 흐트러지지 않아야 한다.
   */
  orderedAt(): Date {
    return this.receivedAt ?? this.sentAt
  }

  /** 두 폰의 시계가 얼마나 어긋나 있나. 밀리초 */
  clockSkewMillis(): number {
    if (this.receivedAt === null) return 0
    return this.receivedAt.getTime() - this.sentAt.getTime()
  }
}

export interface ComposeInput {
  readonly id: MessageId
  readonly author: PeerId
  readonly content: MessageContent
  readonly sentAt: Date
  readonly receivedAt: Date | null
  readonly seq: number
  readonly delivery: DeliveryState
}

export interface DraftInput {
  readonly id: MessageId
  readonly author: PeerId
  readonly content: MessageContent
  readonly seq: number
  readonly now: Date
}

export interface ReceivedInput {
  readonly id: MessageId
  readonly author: PeerId
  readonly content: MessageContent
  readonly seq: number
  readonly sentAt: Date
  readonly now: Date
}

function validateSeq(seq: number): Result<number, DomainError> {
  if (!Number.isInteger(seq)) {
    return err(domainError('invalid-value', '순번은 정수여야 한다', 'seq'))
  }
  if (seq < 1) {
    return err(domainError('invalid-value', '순번은 1부터 시작한다', 'seq'))
  }
  if (!Number.isSafeInteger(seq)) {
    return err(domainError('invalid-value', '순번이 너무 크다', 'seq'))
  }
  return ok(seq)
}

function isValidDate(value: Date): boolean {
  return !Number.isNaN(value.getTime())
}
