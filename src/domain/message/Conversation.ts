import type { PeerId } from '../peer/PeerId'
import { type DomainError, domainError } from '../shared/DomainError'
import { err, ok, type Result } from '../shared/Result'
import type { Message } from './Message'
import type { MessageId } from './MessageId'

/**
 * 두 사람의 대화.
 *
 * 쓰는 사람이 둘뿐이라 대화는 하나뿐이다. 그래서 대화를 고르는 화면도,
 * 대화 목록도 없다.
 *
 * **이 객체는 메시지를 들고 있지 않는다.** 메시지가 수만 개가 되어도
 * 폰이 버텨야 하기 때문이다. 대신 판단에 필요한 최소한만 기억한다.
 *
 *   · 최근에 본 식별자 — 같은 메시지가 두 번 들어오는 걸 빠르게 걸러낸다
 *   · 사람별 순번의 진행 상황 — "3, 4, 6이 왔으니 5가 없다"를 안다
 *   · 읽지 않은 개수
 *
 * 화면에 보이는 메시지는 저장소에서 필요한 만큼만 꺼내 쓴다.
 * (docs/05-messaging-spec.md 4장)
 */

/**
 * 기억해 둘 식별자의 개수.
 *
 * 무한정 쌓으면 메모리가 는다. 이 수를 넘으면 오래된 것부터 잊는다.
 * 잊은 뒤에 같은 메시지가 또 와도 저장소의 기본 키가 막아준다.
 * 여기서 거르는 건 저장소까지 가지 않고 끝내려는 최적화다.
 */
const RECENT_ID_LIMIT = 4096

/** 사람 한 명의 순번이 어디까지 왔나 */
interface PeerProgress {
  /** 지금까지 본 가장 큰 순번 */
  readonly maxSeq: number
  /** 아직 안 온 순번들 */
  readonly missing: ReadonlySet<number>
}

export interface AcceptResult {
  readonly conversation: Conversation
  /** 새로 받아들였는지. false 면 이미 있던 메시지라 버렸다 */
  readonly accepted: boolean
}

export class Conversation {
  private constructor(
    readonly me: PeerId,
    private readonly recentIds: readonly MessageId[],
    private readonly recentIdSet: ReadonlySet<MessageId>,
    private readonly progress: ReadonlyMap<PeerId, PeerProgress>,
    readonly unreadCount: number,
    /** 내가 다음에 쓸 순번 */
    readonly nextOutgoingSeq: number,
  ) {}

  static start(me: PeerId): Conversation {
    return new Conversation(me, [], new Set(), new Map(), 0, 1)
  }

  /**
   * 메시지를 받아들인다. 이미 있는 것이면 조용히 버린다.
   *
   * 버리는 것도 정상이다. 길을 갈아탈 때나 받았다는 답이 유실됐을 때
   * 같은 메시지가 두 번 온다.
   */
  accept(message: Message): AcceptResult {
    if (this.recentIdSet.has(message.id)) {
      return { conversation: this, accepted: false }
    }

    const nextIds = [...this.recentIds, message.id]
    const nextSet = new Set(this.recentIdSet)
    nextSet.add(message.id)

    // 오래된 것부터 잊는다
    while (nextIds.length > RECENT_ID_LIMIT) {
      const dropped = nextIds.shift()
      if (dropped !== undefined) nextSet.delete(dropped)
    }

    const nextProgress = new Map(this.progress)
    nextProgress.set(
      message.author,
      advance(this.progress.get(message.author), message.seq),
    )

    const isMine = message.isMine(this.me)
    const nextUnread = isMine ? this.unreadCount : this.unreadCount + 1
    const nextSeq = isMine
      ? Math.max(this.nextOutgoingSeq, message.seq + 1)
      : this.nextOutgoingSeq

    return {
      conversation: new Conversation(
        this.me,
        nextIds,
        nextSet,
        nextProgress,
        nextUnread,
        nextSeq,
      ),
      accepted: true,
    }
  }

  /** 이 메시지를 이미 본 적 있나 */
  hasSeen(id: MessageId): boolean {
    return this.recentIdSet.has(id)
  }

  /**
   * 상대에게서 못 받은 순번들. 다시 붙었을 때 이것만 골라 요청한다.
   *
   * 앞에서부터 빠진 것도 찾는다. 앱을 새로 깔았을 때처럼
   * 1번부터 통째로 없을 수 있다.
   */
  missingSeqs(peer: PeerId): number[] {
    const state = this.progress.get(peer)
    if (state === undefined) return []
    return [...state.missing].sort((a, b) => a - b)
  }

  /** 그 사람에게서 받은 가장 큰 순번. 인사할 때 상대에게 알려준다 */
  highestSeqFrom(peer: PeerId): number {
    return this.progress.get(peer)?.maxSeq ?? 0
  }

  /** 빠진 게 있나 */
  hasGaps(peer: PeerId): boolean {
    return (this.progress.get(peer)?.missing.size ?? 0) > 0
  }

  /** 여러 건이 한꺼번에 읽혔다 */
  markRead(count: number): Result<Conversation, DomainError> {
    if (!Number.isInteger(count) || count < 0) {
      return err(
        domainError('invalid-value', '읽은 개수는 0 이상의 정수여야 한다', 'count'),
      )
    }

    return ok(
      new Conversation(
        this.me,
        this.recentIds,
        this.recentIdSet,
        this.progress,
        Math.max(0, this.unreadCount - count),
        this.nextOutgoingSeq,
      ),
    )
  }

  /** 전부 읽었다 */
  markAllRead(): Conversation {
    return new Conversation(
      this.me,
      this.recentIds,
      this.recentIdSet,
      this.progress,
      0,
      this.nextOutgoingSeq,
    )
  }

  /** 내가 쓸 다음 순번을 쓰고 하나 올린다 */
  takeOutgoingSeq(): { seq: number; conversation: Conversation } {
    return {
      seq: this.nextOutgoingSeq,
      conversation: new Conversation(
        this.me,
        this.recentIds,
        this.recentIdSet,
        this.progress,
        this.unreadCount,
        this.nextOutgoingSeq + 1,
      ),
    }
  }
}

/**
 * 순번 하나를 반영한다.
 *
 *   · 건너뛰고 왔으면 그 사이를 안 온 것으로 적어둔다
 *   · 안 온 것으로 적어두었던 게 오면 지운다
 *   · 이미 지난 순번이 또 오면 아무 일도 없다
 */
function advance(current: PeerProgress | undefined, seq: number): PeerProgress {
  if (current === undefined) {
    // 처음 받는 사람. 1번부터 이 순번 앞까지가 없다.
    const missing = new Set<number>()
    for (let n = 1; n < seq; n += 1) missing.add(n)
    return { maxSeq: seq, missing }
  }

  const missing = new Set(current.missing)

  if (seq > current.maxSeq) {
    for (let n = current.maxSeq + 1; n < seq; n += 1) missing.add(n)
    return { maxSeq: seq, missing }
  }

  missing.delete(seq)
  return { maxSeq: current.maxSeq, missing }
}

export const conversationLimits = { recentIds: RECENT_ID_LIMIT } as const
