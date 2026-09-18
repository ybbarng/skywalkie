import type { DomainError } from '@/domain/shared/DomainError'
import type { Result } from '@/domain/shared/Result'

/**
 * 목소리를 녹음하고 듣는 무언가.
 *
 * **통화와 다르다.** 통화는 지금 둘 다 듣고 있어야 하지만 음성
 * 메시지는 파일로 남아 나중에 들어도 된다. 끊겨 있어도 보내둘 수 있다.
 */

export interface Recorded {
  /** 녹음된 파일 (base64) */
  readonly base64: string
  readonly durationMs: number
  readonly byteLength: number
}

export interface VoiceRecorder {
  /** 이 기기에서 녹음할 수 있나. 권한을 거절했으면 false */
  isAvailable(): boolean

  /** 마이크를 연다. 권한을 물어보는 것도 여기서 */
  start(): Promise<Result<void, DomainError>>

  /** 멈추고 결과를 돌려준다 */
  stop(): Promise<Result<Recorded, DomainError>>

  /** 보내지 않고 버린다 */
  cancel(): Promise<void>

  /** 지금 녹음 중인가 */
  isRecording(): boolean
}

export interface VoicePlayer {
  /**
   * 파일 하나를 듣는다.
   *
   * **다른 것이 돌고 있으면 멈추고 바꾼다.** 두 개가 겹쳐 나오면
   * 둘 다 못 알아듣는다.
   */
  play(path: string): Promise<Result<void, DomainError>>

  /**
   * 다 들었을 때 알려준다.
   *
   * **이게 있어야 다음 것이 이어진다.** 없으면 하나 듣고 멈춰 서서,
   * 저절로 들려주기가 한 번밖에 안 된다.
   */
  onFinished(handler: () => void): () => void

  stop(): Promise<void>

  /** 지금 무엇을 듣고 있나. 아무것도 아니면 null */
  playingPath(): string | null
}
