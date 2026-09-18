import { z } from 'zod'
import { characterIds } from '@/domain/peer/Character'

/**
 * 기기에 남겨두는 설정의 형식.
 *
 * **저장소를 건드리지 않는 순수한 부분이다.** 실제로 읽고 쓰는 일만
 * `Settings.ts` 에 맡기고 형식은 여기서 시험한다.
 *
 * ## 여기를 고칠 때 지킬 것
 *
 * 새 값을 더할 때는 **반드시 `optional` 이나 `default` 로 둔다.**
 * 필수로 두면 예전에 저장해둔 설정이 형식에 안 맞아 통째로 버려진다.
 * 그러면 `onboardingDone` 까지 날아가서 **비행기 안에서 첫 실행
 * 안내부터 다시 하게 된다.**
 */

export const profileSchema = z.object({
  peerId: z.string().min(8).max(64),
  // 처음에는 비어 있다. 첫 실행 안내에서 채운다.
  displayName: z.string().max(20),
  character: z.enum(characterIds),
  pairingCode: z.string().length(6),
  /** 핫스팟을 연 쪽인가 붙는 쪽인가 */
  role: z.enum(['host', 'guest']),
  /**
   * 상대를 내가 뭐라고 부르는가. "여자친구" 같은 것.
   *
   * **상대가 고른 이름은 인사를 주고받아야 안다.** 그런데 연결 화면은
   * 바로 그 전에 뜬다. 그때 "상대가 들어오기를 기다려요" 라고 하면
   * 누구를 기다리는지 모르는 것처럼 들린다. 사실은 안다.
   */
  peerNickname: z.string().max(20).optional(),
})

export const peerSchema = z.object({
  peerId: z.string().min(8).max(64),
  displayName: z.string().min(1).max(20),
  character: z.enum(characterIds),
})

export const preferencesSchema = z.object({
  audioMode: z.enum(['push-to-talk-brief', 'phone-mic', 'like-a-call']),
  duckMusic: z.boolean(),
  volumeKeyTalk: z.boolean(),
  onboardingDone: z.boolean(),
  /** 아이폰 앱을 설치한 날. 만료 3일 전에 알리는 데 쓴다 */
  installedAt: z.number().int().optional(),
  /** 새 말이 왔을 때 어떻게 알릴까 */
  alertMode: z.enum(['sound', 'vibrate', 'silent']).default('vibrate'),
})

export type Profile = z.infer<typeof profileSchema>
export type KnownPeer = z.infer<typeof peerSchema>
export type Preferences = z.infer<typeof preferencesSchema>

export const defaultPreferences: Preferences = {
  // 기본은 "말할 때만 잠깐". 음악을 들으면서 쓰기에 가장 낫다.
  audioMode: 'push-to-talk-brief',
  duckMusic: true,
  volumeKeyTalk: true,
  onboardingDone: false,
  // 비행기는 시끄럽고 상대는 이어폰을 꽂고 있다. 소리보다 진동이 맞다.
  alertMode: 'vibrate',
}
