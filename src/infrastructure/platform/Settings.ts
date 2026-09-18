import Storage from 'expo-sqlite/kv-store'
import { z } from 'zod'
import { characterIds } from '@/domain/peer/Character'
import type { DomainError } from '@/domain/shared/DomainError'
import { ok, type Result } from '@/domain/shared/Result'

/**
 * 기기에 남겨두는 설정.
 *
 * 앱을 껐다 켜도, 아이폰 앱을 덮어쓰기로 다시 깔아도 남아야 한다.
 * 여기 있는 값이 사라지면 **상대와 다시 짝을 맺어야 한다.**
 */

const profileSchema = z.object({
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
   *
   * **없어도 된다.** 안 적으면 "상대" 라고 쓴다. 예전에 저장해둔
   * 프로필에는 이 값이 없으므로 `optional` 이어야 한다.
   */
  peerNickname: z.string().max(20).optional(),
})

const peerSchema = z.object({
  peerId: z.string().min(8).max(64),
  displayName: z.string().min(1).max(20),
  character: z.enum(characterIds),
})

const preferencesSchema = z.object({
  audioMode: z.enum(['push-to-talk-brief', 'phone-mic', 'like-a-call']),
  duckMusic: z.boolean(),
  volumeKeyTalk: z.boolean(),
  onboardingDone: z.boolean(),
  /** 아이폰 앱을 설치한 날. 만료 3일 전에 알리는 데 쓴다 */
  installedAt: z.number().int().optional(),
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
}

const keys = {
  profile: 'profile',
  peer: 'known-peer',
  preferences: 'preferences',
} as const

export const settings = {
  async readProfile(): Promise<Result<Profile | null, DomainError>> {
    return read(keys.profile, profileSchema)
  },

  async writeProfile(profile: Profile): Promise<Result<void, DomainError>> {
    return write(keys.profile, profile)
  },

  async readPeer(): Promise<Result<KnownPeer | null, DomainError>> {
    return read(keys.peer, peerSchema)
  },

  async writePeer(peer: KnownPeer): Promise<Result<void, DomainError>> {
    return write(keys.peer, peer)
  },

  async readPreferences(): Promise<Result<Preferences, DomainError>> {
    const stored = await read(keys.preferences, preferencesSchema)
    if (!stored.ok) return stored

    // 값이 없거나 형식이 바뀌었으면 기본값으로 시작한다.
    // 여기서 실패하면 앱이 아예 안 열린다.
    return ok(stored.value ?? defaultPreferences)
  },

  async writePreferences(preferences: Preferences): Promise<Result<void, DomainError>> {
    return write(keys.preferences, preferences)
  },

  /** 첫 실행 안내를 다시 보고 싶을 때 */
  async clearOnboarding(): Promise<void> {
    const current = await settings.readPreferences()
    if (!current.ok) return
    await settings.writePreferences({ ...current.value, onboardingDone: false })
  },
}

async function read<T>(
  key: string,
  schema: z.ZodType<T>,
): Promise<Result<T | null, DomainError>> {
  let raw: string | null
  try {
    raw = await Storage.getItem(key)
  } catch {
    // 저장소를 못 읽는다. 값이 없는 것으로 보고 넘어간다.
    return ok(null)
  }

  if (raw === null) return ok(null)

  try {
    const parsed = schema.safeParse(JSON.parse(raw))
    // 형식이 바뀌었으면 없는 것으로 본다. 여기서 앱을 멈추면
    // 새 버전을 깔았을 때 아무것도 못 하게 된다.
    return ok(parsed.success ? parsed.data : null)
  } catch {
    return ok(null)
  }
}

async function write<T>(key: string, value: T): Promise<Result<void, DomainError>> {
  try {
    await Storage.setItem(key, JSON.stringify(value))
  } catch {
    // 저장에 실패해도 화면은 이미 바뀌었다. 다음에 켤 때 기억을 못 할 뿐이다.
  }
  return ok(undefined)
}
