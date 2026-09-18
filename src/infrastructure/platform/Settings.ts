import Storage from 'expo-sqlite/kv-store'
import type { z } from 'zod'
import type { DomainError } from '@/domain/shared/DomainError'
import { ok, type Result } from '@/domain/shared/Result'
import {
  defaultPreferences,
  type KnownPeer,
  type Preferences,
  type Profile,
  peerSchema,
  preferencesSchema,
  profileSchema,
} from './settingsSchema'

/**
 * 기기에 남겨두는 설정.
 *
 * 앱을 껐다 켜도, 아이폰 앱을 덮어쓰기로 다시 깔아도 남아야 한다.
 * 여기 있는 값이 사라지면 **상대와 다시 짝을 맺어야 한다.**
 *
 * 형식은 `settingsSchema.ts` 에 있다. 저장소를 안 건드리는 부분이라
 * 거기서 시험한다.
 */

export type { KnownPeer, Preferences, Profile }
export { defaultPreferences }

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
