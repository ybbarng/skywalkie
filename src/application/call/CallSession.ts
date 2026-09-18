import { type CallEndReason, type CallKind, CallState } from '@/domain/call/CallState'
import type { Clock } from '@/domain/shared/Clock'
import { type DomainError, domainError } from '@/domain/shared/DomainError'
import { err, ok, type Result } from '@/domain/shared/Result'
import type { CallSignalPayload } from '../ports/Envelope'
import type { MessageTransport } from '../ports/MessageTransport'
import type { AudioMode, AudioSession, VoiceLink } from '../ports/VoiceLink'
import { SerialQueue } from '../shared/SerialQueue'

/**
 * 통화 한 판.
 *
 * 상태를 정하는 일은 `CallState` 가 하고, 여기서는 **순서**를 맡는다.
 * 무엇을 먼저 하고 무엇을 나중에 하는지가 이 파일의 내용이다.
 *
 * ## 지키는 것
 *
 * **끝내기는 언제나 된다.** 어떤 상태에서 불러도, 몇 번을 불러도
 * 마이크가 닫히고 상태가 `ended` 가 된다. 여기가 새면 마이크가 열린
 * 채로 남는다.
 *
 * **통화가 실패해도 메시지는 그대로다.** 통화 쪽에서 무슨 일이
 * 일어나든 `MessageTransport` 를 끊지 않는다.
 *
 * (docs/06-voice-video-spec.md 1장 · T15)
 */

export interface CallSessionDeps {
  readonly transport: MessageTransport
  readonly voice: VoiceLink
  readonly audio: AudioSession
  readonly clock: Clock
  /** 봉투에 붙일 고유 번호를 만든다 */
  nextId(): string
}

export interface CallSessionListeners {
  onStateChange?: (state: CallState) => void
}

export class CallSession {
  private state: CallState
  private readonly queue = new SerialQueue()
  private stopWatching: Array<() => void> = []
  private audioMode: AudioMode = 'push-to-talk-brief'

  constructor(
    private readonly deps: CallSessionDeps,
    private readonly listeners: CallSessionListeners = {},
  ) {
    this.state = CallState.idle(deps.clock.now())
  }

  current(): CallState {
    return this.state
  }

  /** 이 기기에서 통화를 걸 수 있나 */
  isAvailable(): boolean {
    return this.deps.voice.isAvailable()
  }

  setAudioMode(mode: AudioMode): void {
    this.audioMode = mode
  }

  /** 내가 건다 */
  async start(kind: CallKind): Promise<Result<void, DomainError>> {
    return this.queue.run(async () => {
      if (!this.deps.voice.isAvailable()) {
        // 걸 수 없다는 것을 상태로 남긴다. 화면이 이유를 보여준다.
        this.moveTo(this.state.end('unsupported', this.now()))
        return err(
          domainError('invalid-transition', '이 기기에서는 통화할 수 없다', 'call'),
        )
      }

      const started = this.state.start(kind, this.now())
      if (!started.ok) return started
      this.moveTo(started.value)

      const prepared = await this.prepare()
      if (!prepared.ok) return this.failWith('failed', prepared.error)

      const offer = await this.deps.voice.createOffer(kind)
      if (!offer.ok) return this.failWith('failed', offer.error)

      this.signal({ ...offer.value, kind: 'offer', media: kind })
      return ok(undefined)
    })
  }

  /** 상대가 걸어왔다 */
  async receiveOffer(offer: CallSignalPayload): Promise<Result<void, DomainError>> {
    return this.queue.run(async () => {
      // 없으면 소리로 본다. 예전 버전이 보낸 봉투일 수 있다.
      const kind: CallKind = offer.media ?? 'voice'

      if (!this.deps.voice.isAvailable()) {
        // 받을 수 없으면 **상대를 기다리게 두지 않는다.** 바로 알린다.
        this.signal({ kind: 'decline' })
        return err(
          domainError('invalid-transition', '이 기기에서는 통화할 수 없다', 'call'),
        )
      }

      if (this.state.isBusy()) {
        // 이미 통화 중이다. 받으면 지금 통화가 끊긴다.
        this.signal({ kind: 'decline' })
        return err(domainError('invalid-transition', '이미 통화 중이다', 'call'))
      }

      const ringing = this.state.receive(kind, this.now())
      if (!ringing.ok) return ringing
      this.moveTo(ringing.value)

      // offer 는 들고만 있는다. 사람이 받겠다고 해야 마이크를 연다.
      this.pendingOffer = offer
      return ok(undefined)
    })
  }

  /** 받겠다고 눌렀다 */
  async accept(): Promise<Result<void, DomainError>> {
    return this.queue.run(async () => {
      const offer = this.pendingOffer
      if (offer === null) {
        return err(domainError('not-found', '받을 통화가 없다', 'call'))
      }

      const accepted = this.state.accept(this.now())
      if (!accepted.ok) return accepted
      this.moveTo(accepted.value)

      const prepared = await this.prepare()
      if (!prepared.ok) return this.failWith('failed', prepared.error)

      const answer = await this.deps.voice.acceptOffer(offer, this.state.kind)
      if (!answer.ok) return this.failWith('failed', answer.error)

      this.pendingOffer = null
      this.signal({ ...answer.value, kind: 'answer' })
      return ok(undefined)
    })
  }

  /** 상대가 받았다 */
  async receiveAnswer(answer: CallSignalPayload): Promise<Result<void, DomainError>> {
    return this.queue.run(async () => {
      if (this.state.phase !== 'calling') {
        // 늦게 온 것이다. 버린다.
        return ok(undefined)
      }

      const moving = this.state.accept(this.now())
      if (!moving.ok) return moving
      this.moveTo(moving.value)

      const applied = await this.deps.voice.acceptAnswer(answer)
      if (!applied.ok) return this.failWith('failed', applied.error)

      return ok(undefined)
    })
  }

  /** 상대가 알려준 주소 후보 */
  async receiveCandidate(
    candidate: CallSignalPayload,
  ): Promise<Result<void, DomainError>> {
    // 통화 중이 아니면 버린다. 오류로 보지 않는다. 늦게 오는 게 정상이다.
    if (!this.state.isBusy()) return ok(undefined)

    const added = await this.deps.voice.addCandidate(candidate)
    // 후보 하나가 안 붙어도 통화가 안 되는 건 아니다. 다른 후보가 있다.
    return added.ok ? ok(undefined) : ok(undefined)
  }

  /** 상대가 끊었다 */
  async receiveHangup(declined: boolean): Promise<void> {
    await this.hangUp(declined ? 'declined' : 'peer-hung-up', false)
  }

  /** 내가 끊는다 */
  async end(reason: CallEndReason = 'hung-up'): Promise<void> {
    await this.hangUp(reason, true)
  }

  /**
   * 마이크를 열고 닫는다.
   *
   * 누르고 말하기가 이걸 쓴다. **통화 중이 아니면 절대 열지 않는다.**
   */
  setMicrophoneEnabled(enabled: boolean): Result<void, DomainError> {
    if (enabled && !this.state.isLive()) {
      return err(domainError('invalid-transition', '통화 중이 아니다', 'call'))
    }
    return this.deps.voice.setMicrophoneEnabled(enabled)
  }

  setCameraEnabled(enabled: boolean): Result<void, DomainError> {
    if (enabled && !this.state.isLive()) {
      return err(domainError('invalid-transition', '통화 중이 아니다', 'call'))
    }
    return this.deps.voice.setCameraEnabled(enabled)
  }

  /** 시간이 다 됐는지 살핀다. 화면이 주기적으로 부른다 */
  async checkTimeout(): Promise<void> {
    if (!this.state.hasTimedOut(this.now())) return
    await this.hangUp(this.state.timeoutReason(), true)
  }

  /** 이어폰이 빠졌다. **마이크를 즉시 끈다** */
  onHeadphonesUnplugged(): void {
    // 스피커로 대화 내용이 새어나가는 걸 막는다.
    // 켜는 건 사람이 다시 눌러야 한다.
    this.deps.voice.setMicrophoneEnabled(false)
  }

  private pendingOffer: CallSignalPayload | null = null

  /** 소리 길을 잡고 통화 쪽 알림을 듣기 시작한다 */
  private async prepare(): Promise<Result<void, DomainError>> {
    const activated = await this.deps.audio.activate(this.audioMode)
    // 소리 설정에 실패해도 통화를 접지 않는다. 기본 길로라도 들린다.
    if (!activated.ok) {
      // 여기서 멈추면 "소리가 좀 이상한 통화"가 아니라 "통화 없음"이 된다
    }

    this.watch()
    return ok(undefined)
  }

  private watch(): void {
    this.unwatch()

    this.stopWatching.push(
      this.deps.voice.onCandidate(candidate => {
        this.signal({ ...candidate, kind: 'candidate' })
      }),
    )

    this.stopWatching.push(
      this.deps.voice.onStateChange(next => {
        void this.queue.run(async () => {
          if (next === 'connected' && this.state.phase === 'connecting') {
            const connected = this.state.connected(this.now())
            if (connected.ok) this.moveTo(connected.value)
            return ok(undefined)
          }

          if (next === 'failed' || next === 'closed') {
            // 큐 안이라 hangUp 을 그대로 부르면 맞물린다. 속만 실행한다.
            await this.teardown()
            this.moveTo(
              this.state.end(next === 'failed' ? 'failed' : 'link-lost', this.now()),
            )
          }

          return ok(undefined)
        })
      }),
    )
  }

  private unwatch(): void {
    for (const stop of this.stopWatching) stop()
    this.stopWatching = []
  }

  /**
   * 끝낸다.
   *
   * **여러 번 불러도 안전하다.** 이미 끝났으면 아무 일도 안 한다.
   * 알림을 두 번 받거나 사람이 두 번 누르는 일은 흔하다.
   */
  private async hangUp(reason: CallEndReason, tell: boolean): Promise<void> {
    await this.queue.run(async () => {
      if (this.state.phase === 'ended' || this.state.phase === 'idle') {
        return ok(undefined)
      }

      if (tell) this.signal({ kind: 'hangup' })

      await this.teardown()
      this.moveTo(this.state.end(reason, this.now()))
      return ok(undefined)
    })
  }

  /** 마이크와 소리 길을 되돌린다. **여기가 새면 마이크가 남는다** */
  private async teardown(): Promise<void> {
    this.pendingOffer = null
    this.unwatch()

    // 무엇이 실패하든 나머지는 계속 되돌린다
    this.deps.voice.setMicrophoneEnabled(false)
    this.deps.voice.setCameraEnabled(false)
    await this.deps.voice.close()
    await this.deps.audio.deactivate()
  }

  private failWith(reason: CallEndReason, error: DomainError): Result<void, DomainError> {
    void this.teardown()
    this.moveTo(this.state.end(reason, this.now()))
    return err(error)
  }

  private moveTo(next: CallState): void {
    this.state = next
    this.listeners.onStateChange?.(next)
  }

  /**
   * 통화 신호를 보낸다.
   *
   * **실패해도 삼킨다.** 통화 신호가 안 나갔다고 메시지 쪽을 건드리면
   * 안 된다. 신호가 안 가면 어차피 시간이 다 되어 끝난다.
   */
  private signal(payload: CallSignalPayload): void {
    void this.deps.transport
      .send({
        v: 1,
        id: this.deps.nextId(),
        seq: 0,
        ts: this.now().getTime(),
        t: 'call_signal',
        p: payload,
      })
      .catch(() => {
        // 통화 신호 하나가 안 나간 것뿐이다
      })
  }

  private now(): Date {
    return this.deps.clock.now()
  }
}
