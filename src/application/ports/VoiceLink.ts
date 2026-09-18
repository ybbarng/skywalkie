import type { CallKind } from '@/domain/call/CallState'
import type { DomainError } from '@/domain/shared/DomainError'
import type { Result } from '@/domain/shared/Result'
import type { CallSignalPayload } from './Envelope'
import type { Unsubscribe } from './MessageTransport'

/**
 * 소리와 영상을 나르는 무언가.
 *
 * **협상 정보는 이미 열려 있는 우리 TCP 연결로 오간다.** 시그널링
 * 서버도 STUN 도 쓰지 않는다. 같은 사설망이라 서로의 주소로 바로 닿는다.
 * (docs/06-voice-video-spec.md 1장)
 *
 * 이 층은 WebRTC 를 모른다. 여기서 정하는 것은 "무엇을 할 수 있나"뿐이고,
 * 실제로 어떻게 하는지는 infrastructure 가 안다.
 */
export interface VoiceLink {
  /**
   * 이 기기에서 통화를 할 수 있나.
   *
   * **없을 수 있다는 것을 전제로 만든다.** 통화 모듈이 안 들어갔거나
   * 빌드가 어긋났을 수 있는데, 그래도 글은 주고받을 수 있어야 한다.
   */
  isAvailable(): boolean

  /** 내가 건다. 상대에게 보낼 offer 를 만든다 */
  createOffer(kind: CallKind): Promise<Result<CallSignalPayload, DomainError>>

  /** 상대의 offer 를 받아 answer 를 만든다 */
  acceptOffer(
    offer: CallSignalPayload,
    kind: CallKind,
  ): Promise<Result<CallSignalPayload, DomainError>>

  /** 상대의 answer 를 받아들인다 */
  acceptAnswer(answer: CallSignalPayload): Promise<Result<void, DomainError>>

  /** 상대가 알려준 주소 후보를 더한다 */
  addCandidate(candidate: CallSignalPayload): Promise<Result<void, DomainError>>

  /** 내가 알려줄 주소 후보가 생기면 알려준다 */
  onCandidate(handler: (candidate: CallSignalPayload) => void): Unsubscribe

  /** 소리가 흐르기 시작하거나 끊기면 알려준다 */
  onStateChange(handler: (state: VoiceLinkState) => void): Unsubscribe

  /** 마이크를 열고 닫는다. 누르고 말하기가 이걸 쓴다 */
  setMicrophoneEnabled(enabled: boolean): Result<void, DomainError>

  /** 영상을 켜고 끈다 */
  setCameraEnabled(enabled: boolean): Result<void, DomainError>

  /** 앞뒤 카메라를 바꾼다 */
  switchCamera(): Promise<Result<void, DomainError>>

  /** 화면에 그릴 것들. 통화 중이 아니면 null */
  streams(): VoiceStreams

  /** 전부 닫는다. **여러 번 불러도 안전해야 한다** */
  close(): Promise<void>
}

export type VoiceLinkState =
  /** 길을 트는 중 */
  | 'connecting'
  /** 소리가 흐른다 */
  | 'connected'
  /** 잠깐 끊겼다. 곧 돌아올 수 있다 */
  | 'interrupted'
  /** 끝났다 */
  | 'closed'
  /** 트지 못했다 */
  | 'failed'

export interface VoiceStreams {
  /** 내 화면에 비칠 내 모습 */
  readonly localUrl: string | null
  /** 상대 모습 */
  readonly remoteUrl: string | null
}

/**
 * 소리 설정을 다루는 무언가.
 *
 * **이 앱에서 가장 까다로운 부분이다.** "음악을 들으면서 대화한다"는
 * 요구 하나 때문에 있다. (docs/06-voice-video-spec.md 2장)
 */
export interface AudioSession {
  /** 통화에 맞게 소리 길을 잡는다 */
  activate(mode: AudioMode): Promise<Result<void, DomainError>>

  /** 원래대로 되돌린다 */
  deactivate(): Promise<Result<void, DomainError>>

  /** 지금 소리가 어디로 나가나 */
  currentRoute(): Promise<Result<AudioRoute, DomainError>>

  /** 이어폰이 빠지거나 바뀌면 알려준다 */
  onRouteChange(handler: (route: AudioRoute) => void): Unsubscribe
}

/**
 * 세 가지 말하기 방식.
 *
 * 무선 이어폰은 마이크를 켜는 순간 나쁜 음질로 넘어간다. 이건 앱이
 * 거스를 수 없어서, **무엇을 포기할지 사용자가 고르게** 한다.
 */
export type AudioMode =
  /** 말할 때만 잠깐. 대부분의 시간 동안 음악이 온전하다 */
  | 'push-to-talk-brief'
  /** 폰에 대고 말하기. 음악이 계속 좋은 음질이다 */
  | 'phone-mic'
  /** 전화처럼. 편하지만 음악 음질이 통화 내내 떨어진다 */
  | 'like-a-call'

export interface AudioRoute {
  /** 소리가 나가는 곳 */
  readonly output: 'earpiece' | 'speaker' | 'bluetooth' | 'wired'
  /** 소리를 받는 곳 */
  readonly input: 'built-in' | 'bluetooth' | 'wired'
  /** 이어폰이 꽂혀 있나. 빠지면 마이크를 즉시 꺼야 한다 */
  readonly headphonesConnected: boolean
}
