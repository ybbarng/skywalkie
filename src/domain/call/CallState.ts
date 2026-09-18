import { type DomainError, domainError } from '../shared/DomainError'
import { err, ok, type Result } from '../shared/Result'

/**
 * 통화가 어디쯤 왔나.
 *
 * **두 기기가 다르게 생각하는 것이 이 앱의 주된 버그다.** 통화는 특히
 * 그렇다. 한쪽은 끊었다고 아는데 다른 쪽은 통화 중이면, 마이크가 계속
 * 열려 있는 채로 남는다. 그래서 갈 수 있는 길을 표로 못박아 둔다.
 *
 * (docs/06-voice-video-spec.md 1장)
 */

export const callPhases = [
  /** 통화 중이 아니다 */
  'idle',
  /** 내가 걸었고 상대가 받기를 기다린다 */
  'calling',
  /** 상대가 걸어왔고 내가 받을지 정해야 한다 */
  'ringing',
  /** 받았고 길을 트는 중이다 */
  'connecting',
  /** 소리가 흐른다 */
  'active',
  /** 끝났다 */
  'ended',
] as const

export type CallPhase = (typeof callPhases)[number]

export const callKinds = ['voice', 'video'] as const
export type CallKind = (typeof callKinds)[number]

/**
 * 왜 끝났나.
 *
 * 화면에 그대로 띄우지 않는다. 화면이 이걸 보고 한국어를 만든다.
 */
export const callEndReasons = [
  /** 내가 끊었다 */
  'hung-up',
  /** 상대가 끊었다 */
  'peer-hung-up',
  /** 상대가 거절했다 */
  'declined',
  /** 아무도 받지 않았다 */
  'unanswered',
  /** 길을 트지 못했다 */
  'failed',
  /** 연결이 끊겼다 */
  'link-lost',
  /** 마이크를 못 쓴다 */
  'no-microphone',
  /** 이 기기에서 통화를 할 수 없다 */
  'unsupported',
] as const

export type CallEndReason = (typeof callEndReasons)[number]

/** 아무도 안 받으면 이만큼 뒤에 포기한다 */
export const RING_TIMEOUT_MS = 30_000

/** 길을 트는 데 이보다 오래 걸리면 포기한다 (명세 1장) */
export const CONNECT_TIMEOUT_MS = 10_000

export class CallState {
  private constructor(
    readonly phase: CallPhase,
    readonly kind: CallKind,
    /** 내가 건 통화인가 */
    readonly outgoing: boolean,
    readonly endReason: CallEndReason | null,
    /** 이 상태가 된 시각. 시간 재는 데 쓴다 */
    readonly since: Date,
  ) {}

  static idle(now: Date = new Date(0)): CallState {
    return new CallState('idle', 'voice', false, null, now)
  }

  /** 내가 건다 */
  start(kind: CallKind, now: Date): Result<CallState, DomainError> {
    if (this.phase !== 'idle' && this.phase !== 'ended') {
      return err(
        domainError('invalid-transition', `${this.phase} 에서 걸 수 없다`, 'call'),
      )
    }
    return ok(new CallState('calling', kind, true, null, now))
  }

  /** 상대가 걸어왔다 */
  receive(kind: CallKind, now: Date): Result<CallState, DomainError> {
    if (this.phase !== 'idle' && this.phase !== 'ended') {
      return err(
        domainError('invalid-transition', `${this.phase} 에서 받을 수 없다`, 'call'),
      )
    }
    return ok(new CallState('ringing', kind, false, null, now))
  }

  /** 받겠다고 눌렀다 */
  accept(now: Date): Result<CallState, DomainError> {
    // 거는 쪽은 상대의 answer 를 받았을 때 여기로 온다
    if (this.phase !== 'ringing' && this.phase !== 'calling') {
      return err(
        domainError('invalid-transition', `${this.phase} 에서 받을 수 없다`, 'call'),
      )
    }
    return ok(new CallState('connecting', this.kind, this.outgoing, null, now))
  }

  /** 소리가 흐르기 시작했다 */
  connected(now: Date): Result<CallState, DomainError> {
    if (this.phase !== 'connecting') {
      return err(
        domainError('invalid-transition', `${this.phase} 에서 이어질 수 없다`, 'call'),
      )
    }
    return ok(new CallState('active', this.kind, this.outgoing, null, now))
  }

  /**
   * 끝낸다.
   *
   * **어느 상태에서든 끝낼 수 있다.** 여기서 막으면 마이크가 열린 채로
   * 남는 길이 생긴다. 이미 끝났으면 그대로 둔다. 처음 끝난 이유가
   * 진짜 이유다.
   */
  end(reason: CallEndReason, now: Date): CallState {
    if (this.phase === 'ended' || this.phase === 'idle') {
      return this.phase === 'ended'
        ? this
        : new CallState('ended', this.kind, this.outgoing, reason, now)
    }
    return new CallState('ended', this.kind, this.outgoing, reason, now)
  }

  /** 영상으로 올리거나 소리만으로 내린다 */
  switchKind(kind: CallKind): Result<CallState, DomainError> {
    if (this.phase !== 'active') {
      return err(domainError('invalid-transition', '통화 중에만 바꿀 수 있다', 'call'))
    }
    return ok(new CallState(this.phase, kind, this.outgoing, null, this.since))
  }

  /** 마이크를 열어둘 상태인가. **여기가 틀리면 소리가 새거나 안 들린다** */
  isLive(): boolean {
    return this.phase === 'connecting' || this.phase === 'active'
  }

  /** 화면에 통화 창을 띄울 상태인가 */
  isBusy(): boolean {
    return this.phase !== 'idle' && this.phase !== 'ended'
  }

  /** 사람이 답해야 하는 상태인가 */
  needsAnswer(): boolean {
    return this.phase === 'ringing'
  }

  /** 이 상태로 얼마나 있었나 */
  elapsedMillis(now: Date): number {
    return now.getTime() - this.since.getTime()
  }

  /** 기다리다 포기할 때가 됐나 */
  hasTimedOut(now: Date): boolean {
    const elapsed = this.elapsedMillis(now)

    if (this.phase === 'calling' || this.phase === 'ringing') {
      return elapsed >= RING_TIMEOUT_MS
    }
    if (this.phase === 'connecting') {
      return elapsed >= CONNECT_TIMEOUT_MS
    }
    return false
  }

  /** 시간이 다 됐을 때 붙일 이유 */
  timeoutReason(): CallEndReason {
    return this.phase === 'connecting' ? 'failed' : 'unanswered'
  }
}
