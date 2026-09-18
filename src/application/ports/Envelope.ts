import type { MessageContent } from '@/domain/message/MessageContent'
import type { CharacterId } from '@/domain/peer/Character'

/**
 * 두 기기가 주고받는 봉투.
 *
 * **연결 방식이 달라도 봉투의 생김새는 같다.** Wi-Fi 든 블루투스든 웹이든
 * 같은 형식을 쓴다. 그래야 길을 갈아타도 위층 코드가 그대로다.
 *
 * 여기는 "무엇을 주고받는가"만 정한다. 바이트로 바꾸고 형식을 검사하는
 * 일은 infrastructure 가 한다. 이 층은 zod 같은 바깥 도구를 모른다.
 * (docs/04-transport-spec.md 3장)
 */

/** 규약 버전. 기기끼리 다르면 인사 단계에서 낮은 쪽에 맞춘다 */
export const PROTOCOL_VERSION = 1

export interface EnvelopeHeader {
  /** 규약 버전 */
  readonly v: number
  /** 이 봉투의 고유 번호 (ULID) */
  readonly id: string
  /** 보낸 쪽 기준 순번 */
  readonly seq: number
  /** 보낸 시각. 밀리초 */
  readonly ts: number
}

export interface HelloPayload {
  readonly peerId: string
  readonly displayName: string
  readonly character: CharacterId
  readonly pairingCode: string
  /** 내가 상대에게서 마지막으로 받은 순번. 놓친 걸 바로 알아채려고 알려준다 */
  readonly lastSeenSeq: number
  readonly appVersion: string
}

export interface HelloAckPayload extends HelloPayload {
  /** 상대를 받아들였는지. 코드가 안 맞으면 false */
  readonly accepted: boolean
  /** 거절한 이유. 화면에 무엇을 하면 되는지 적을 때 쓴다 */
  readonly reason?: 'code-mismatch' | 'version-too-old' | 'unknown-peer'
}

export interface MessagePayload {
  readonly messageId: string
  readonly author: string
  readonly content: MessageContent
  readonly sentAt: number
  readonly messageSeq: number
}

export interface AckPayload {
  readonly messageId: string
}

export interface ReadPayload {
  /** 여러 건을 묶어 한 번에 보낸다 */
  readonly messageIds: readonly string[]
}

export interface TypingPayload {
  readonly typing: boolean
}

export interface NudgePayload {
  readonly messageId: string
}

export interface PresencePayload {
  readonly foreground: boolean
  readonly batteryLevel?: number
  /** 지금 듣는 것. 사용자가 켰을 때만 보낸다 */
  readonly nowPlaying?: string
}

export interface SyncRequestPayload {
  /** 못 받은 순번들 */
  readonly missingSeqs: readonly number[]
}

export interface SyncResponsePayload {
  readonly messages: readonly MessagePayload[]
  /** 상대가 요청한 것 중 이제는 없는 것 */
  readonly unavailableSeqs: readonly number[]
}

export interface CallSignalPayload {
  readonly kind: 'offer' | 'answer' | 'candidate' | 'hangup' | 'decline'
  readonly sdp?: string
  readonly candidate?: string
  readonly sdpMid?: string
  readonly sdpMLineIndex?: number
  /**
   * 소리만인가 영상까지인가. `offer` 에만 붙는다.
   *
   * 없으면 소리로 본다. 예전 버전이 보낸 봉투일 수 있는데,
   * 거기서 멈추면 통화가 아예 안 된다.
   */
  readonly media?: 'voice' | 'video'
}

export interface ByePayload {
  readonly reason: 'user-stopped' | 'app-closing' | 'switching-link'
}

export type Envelope =
  | (EnvelopeHeader & { t: 'hello'; p: HelloPayload })
  | (EnvelopeHeader & { t: 'hello_ack'; p: HelloAckPayload })
  | (EnvelopeHeader & { t: 'message'; p: MessagePayload })
  | (EnvelopeHeader & { t: 'ack'; p: AckPayload })
  | (EnvelopeHeader & { t: 'read'; p: ReadPayload })
  | (EnvelopeHeader & { t: 'typing'; p: TypingPayload })
  | (EnvelopeHeader & { t: 'nudge'; p: NudgePayload })
  | (EnvelopeHeader & { t: 'presence'; p: PresencePayload })
  | (EnvelopeHeader & { t: 'sync_request'; p: SyncRequestPayload })
  | (EnvelopeHeader & { t: 'sync_response'; p: SyncResponsePayload })
  | (EnvelopeHeader & { t: 'call_signal'; p: CallSignalPayload })
  | (EnvelopeHeader & { t: 'bye'; p: ByePayload })

export type EnvelopeType = Envelope['t']

/**
 * 좁은 길(블루투스)로도 보낼 만한 봉투인가.
 *
 * 입력 중 표시 같은 건 안 보낸다. 좁은 길을 실제 대화에 양보한다.
 * (docs/04-transport-spec.md 4.4)
 */
export function worthSendingOnNarrowLink(type: EnvelopeType): boolean {
  return type !== 'typing' && type !== 'presence'
}

/** 받았다는 답을 기다려야 하는 봉투인가 */
export function expectsAck(type: EnvelopeType): boolean {
  return type === 'message'
}
