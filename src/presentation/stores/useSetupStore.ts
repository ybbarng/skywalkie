import { Platform } from 'react-native'
import { create } from 'zustand'
import {
  defaultPreferences,
  type KnownPeer,
  makePeerId,
  type Preferences,
  type Profile,
  settings,
} from '@/composition/services'
import type { CharacterId } from '@/domain/peer/Character'
import { generatePairingCode } from '@/domain/peer/PairingCode'

/**
 * 첫 실행에서 정한 것들.
 *
 * 화면 여러 곳에서 같이 보는 값이라 한곳에 모은다.
 * 바뀔 때마다 기기에 저장해서 앱을 껐다 켜도 남는다.
 */

interface SetupState {
  /** 기기에서 되살리는 중인가 */
  loading: boolean
  profile: Profile | null
  peer: KnownPeer | null
  preferences: Preferences

  load(): Promise<void>
  /**
   * 프로필이 없으면 만든다.
   *
   * **역할은 기기가 정한다.** 아이폰은 앱에서 핫스팟을 켤 수 없으니
   * 안드로이드가 여는 쪽, 아이폰이 붙는 쪽이다. 고르게 하면 헷갈림만 는다.
   */
  ensureProfile(): Promise<void>
  chooseCharacter(character: CharacterId): Promise<void>
  setDisplayName(displayName: string): Promise<void>
  chooseAudioMode(audioMode: Preferences['audioMode']): Promise<void>
  finishOnboarding(): Promise<void>
  restartOnboarding(): Promise<void>
  rememberPeer(peer: KnownPeer): Promise<void>
  /** 상대가 알려준 코드로 맞춘다. 코드로 연결하기에서 쓴다 */
  adoptPairingCode(code: string): Promise<void>
}

export const useSetupStore = create<SetupState>((set, get) => ({
  loading: true,
  profile: null,
  peer: null,
  preferences: defaultPreferences,

  async load() {
    const [profile, peer, preferences] = await Promise.all([
      settings.readProfile(),
      settings.readPeer(),
      settings.readPreferences(),
    ])

    set({
      loading: false,
      profile: profile.ok ? profile.value : null,
      peer: peer.ok ? peer.value : null,
      preferences: preferences.ok ? preferences.value : defaultPreferences,
    })
  },

  async ensureProfile() {
    if (get().profile !== null) return

    // 식별자와 코드는 한 번만 만들어 계속 쓴다.
    // 바뀌면 상대가 우리를 못 알아본다.
    const role: Profile['role'] = Platform.OS === 'ios' ? 'guest' : 'host'

    await persistProfile(set, {
      peerId: makePeerId(),
      displayName: '나',
      character: role === 'host' ? 'orion' : 'aria',
      pairingCode: generatePairingCode(Math.random),
      role,
    })
  },

  async chooseCharacter(character) {
    const current = get().profile
    if (current === null) return
    await persistProfile(set, { ...current, character })
  },

  async setDisplayName(displayName) {
    const current = get().profile
    if (current === null) return
    const trimmed = displayName.trim()
    if (trimmed.length === 0) return
    await persistProfile(set, { ...current, displayName: trimmed.slice(0, 20) })
  },

  async chooseAudioMode(audioMode) {
    await persistPreferences(set, { ...get().preferences, audioMode })
  },

  async finishOnboarding() {
    await persistPreferences(set, {
      ...get().preferences,
      onboardingDone: true,
      installedAt: get().preferences.installedAt ?? Date.now(),
    })
  },

  async restartOnboarding() {
    await persistPreferences(set, { ...get().preferences, onboardingDone: false })
  },

  async rememberPeer(peer) {
    await settings.writePeer(peer)
    set({ peer })
  },

  async adoptPairingCode(code) {
    const current = get().profile
    if (current === null) return
    await persistProfile(set, { ...current, pairingCode: code.toUpperCase() })
  },
}))

type Setter = (partial: Partial<SetupState>) => void

async function persistProfile(set: Setter, profile: Profile): Promise<void> {
  await settings.writeProfile(profile)
  set({ profile })
}

async function persistPreferences(set: Setter, preferences: Preferences): Promise<void> {
  await settings.writePreferences(preferences)
  set({ preferences })
}
