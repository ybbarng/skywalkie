import type { AudioMode, AudioRoute } from '@/application/ports/VoiceLink'

/**
 * 소리 길을 어떻게 잡을지 **정하는** 곳.
 *
 * 실제로 잡는 일은 기기가 하지만, 무엇을 요청할지 고르는 것은 순수한
 * 계산이라 여기서 하고 전부 시험한다. 기기 없이 확인할 수 있는 부분을
 * 최대한 여기로 끌어온다.
 *
 * ## 무엇을 포기할지의 문제다
 *
 * 무선 이어폰은 **마이크를 켜는 순간 나쁜 음질로 넘어간다.** 이어폰과
 * 운영체제가 정하는 일이라 앱이 거스를 수 없다. 그래서 "음악을 좋은
 * 음질로 들으면서 이어폰 마이크로 말하기"는 **불가능하다.**
 *
 * 세 가지 중에 고르게 한다. (docs/06-voice-video-spec.md 2장)
 */

export interface IosAudioPlan {
  readonly category: 'playAndRecord'
  readonly mode: 'voiceChat'
  readonly options: readonly IosAudioOption[]
}

export type IosAudioOption =
  /** 다른 앱 소리를 끄지 않는다. **음악이 살아남는 이유다** */
  | 'mixWithOthers'
  /** 내 소리가 날 때 다른 소리를 줄인다 */
  | 'duckOthers'
  /** 이어폰으로 좋은 음질 출력을 허용 */
  | 'allowBluetoothA2DP'
  /** 이어폰 마이크를 허용. **이걸 빼면 폰 마이크를 쓴다** */
  | 'allowBluetoothHFP'

export function planForIos(mode: AudioMode): IosAudioPlan {
  const options: IosAudioOption[] = ['mixWithOthers', 'duckOthers', 'allowBluetoothA2DP']

  // **여기가 핵심이다.**
  //
  // `allowBluetoothHFP` 를 빼면 iOS 가 이어폰 마이크를 후보에서 제외하고
  // 폰 내장 마이크를 쓴다. 이어폰은 출력 전용으로 남아 좋은 음질을
  // 유지한다. 폰에 대고 말하는 대신 음악을 지키는 것이다.
  if (mode !== 'phone-mic') options.push('allowBluetoothHFP')

  return { category: 'playAndRecord', mode: 'voiceChat', options }
}

export interface AndroidAudioPlan {
  readonly usage: 'USAGE_VOICE_COMMUNICATION'
  readonly contentType: 'CONTENT_TYPE_SPEECH'
  /** 내 소리 날 동안 네 소리를 줄여달라. 끄지는 말고 */
  readonly focus: 'AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK'
  /** 통신에 쓸 마이크를 폰 것으로 못박을까 */
  readonly forceBuiltInMic: boolean
}

export function planForAndroid(mode: AudioMode): AndroidAudioPlan {
  return {
    usage: 'USAGE_VOICE_COMMUNICATION',
    contentType: 'CONTENT_TYPE_SPEECH',
    focus: 'AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK',
    // 안드로이드 12부터 통신에 쓸 기기를 앱이 고를 수 있다
    forceBuiltInMic: mode === 'phone-mic',
  }
}

/**
 * 이 방식에서 마이크를 계속 열어두나.
 *
 * "말할 때만 잠깐"은 누를 때만 연다. 나머지 둘은 계속 열어둔다.
 */
export function keepsMicrophoneOpen(mode: AudioMode): boolean {
  return mode !== 'push-to-talk-brief'
}

/**
 * 이 방식에서 음악 음질이 통화 내내 떨어지나.
 *
 * 화면에서 "이걸 고르면 무엇을 잃는지" 알려줄 때 쓴다.
 */
export function degradesMusic(mode: AudioMode): boolean {
  // 폰 마이크를 쓰면 이어폰이 출력 전용으로 남아 음질이 그대로다.
  // 말할 때만 잠깐 여는 것은 그 순간만 떨어진다.
  return mode === 'like-a-call'
}

/**
 * 이어폰이 빠졌나.
 *
 * 빠지면 **마이크를 즉시 꺼야 한다.** 스피커로 대화 내용이
 * 새어나가는 걸 막는다. (명세 2.5)
 */
export function headphonesJustUnplugged(
  before: AudioRoute | null,
  after: AudioRoute,
): boolean {
  if (before === null) return false
  return before.headphonesConnected && !after.headphonesConnected
}

/**
 * 소리 길이 바뀌어 다시 잡아야 하나.
 *
 * 에어팟에서 유선 헤드폰으로 갈아끼우면 설정을 다시 잡아야 한다.
 */
export function needsReconfigure(before: AudioRoute | null, after: AudioRoute): boolean {
  if (before === null) return true
  return before.output !== after.output || before.input !== after.input
}

/** 상대 목소리가 들어올 때 음악을 이만큼까지 줄인다 (명세 2.3) */
export const DUCK_TO = 0.25

/** 줄이는 데 걸리는 시간. 뚝 끊기지 않게 서서히 */
export const DUCK_FADE_MS = 200

/**
 * 목소리가 멎고 이만큼 뒤에 되돌린다.
 *
 * 문장 사이 짧은 침묵마다 음악이 오르내리는 걸 막는다.
 */
export const UNDUCK_AFTER_MS = 800
