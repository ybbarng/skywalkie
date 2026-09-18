import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import type { Message } from '@/domain/message/Message'
import type { PeerId } from '@/domain/peer/PeerId'
import { alreadyThere, nextToPlay } from '../stores/voiceAutoplay'

/**
 * 음성 메시지가 오면 저절로 들려준다.
 *
 * **이게 무전기를 만든다.** 상대가 말하면 내 이어폰에서 바로 나오고,
 * 나는 마이크를 꾹 눌러 답한다. 통화와 달리 둘 다 동시에 붙어 있을
 * 필요가 없어서, 한쪽이 잠깐 끊겨도 말이 사라지지 않는다.
 *
 * 무엇을 틀지 **정하는 일은 `voiceAutoplay.ts` 가** 한다. 여기서는
 * 틀기만 한다.
 *
 * ## 켠 뒤에 온 것만 튼다
 *
 * 켜는 순간 쌓여 있던 것은 전부 "이미 튼 것" 으로 친다. 안 그러면
 * **설정을 켜자마자 예전 음성이 줄줄이 재생된다.** 껐다 다시 켤
 * 때도 마찬가지다. 꺼둔 동안 온 것까지 몰아서 틀면 안 된다.
 *
 * ## 한 번 튼 것은 다시 안 튼다
 *
 * 저절로 튼 것이든 사람이 눌러서 튼 것이든 똑같이 적어둔다.
 * 그래서 화면을 다시 그려도, 새 메시지가 와도 예전 것이 또 나오지
 * 않는다.
 */

export interface VoiceAutoplayInput {
  readonly enabled: boolean
  readonly me: PeerId | null
  readonly messages: readonly Message[]
  /** 기기에 다 와 있는 것들 */
  readonly assetPaths: Readonly<Record<string, string>>
  /** 지금 무엇이 나오고 있나 */
  readonly playingVoice: string | null
  play(assetId: string): void
}

export function useVoiceAutoplay(input: VoiceAutoplayInput): void {
  /** 이미 튼 것. 저절로 튼 것과 눌러서 튼 것을 함께 적는다 */
  const played = useRef<Set<string>>(new Set())
  /** 바로 앞에 켜져 있었나. 꺼졌다 켜지는 순간을 잡는다 */
  const wasEnabled = useRef(false)

  /**
   * 트는 일만 참조로 든다.
   *
   * 다시 그릴 때마다 새 함수가 되는데, 그걸 의존성에 넣으면 매번
   * 다시 돈다. 나머지 값은 **바뀌면 다시 봐야 하므로** 그대로 읽는다.
   */
  const play = useRef(input.play)
  play.current = input.play

  // 사람이 눌러서 튼 것도 적어둔다. 나중에 저절로 또 나오면 안 된다.
  useEffect(() => {
    if (input.playingVoice !== null) played.current.add(input.playingVoice)
  }, [input.playingVoice])

  useEffect(() => {
    if (!input.enabled || input.me === null) {
      wasEnabled.current = false
      return
    }

    /**
     * 막 켜졌다. 지금 있는 것은 전부 "이미 튼 것" 으로 친다.
     *
     * 처음 화면을 열었을 때와 설정을 다시 켰을 때가 모두 여기로 온다.
     * **둘 다 "지금부터" 여야 한다.**
     */
    if (!wasEnabled.current) {
      wasEnabled.current = true
      for (const assetId of alreadyThere(input.messages)) played.current.add(assetId)
      return
    }

    const assetId = nextToPlay({
      enabled: input.enabled,
      me: input.me,
      messages: input.messages,
      ready: input.assetPaths,
      played: played.current,
      playing: input.playingVoice !== null,
      appActive: AppState.currentState === 'active',
    })

    if (assetId === null) return

    // 먼저 적어둔다. 안 적으면 다시 그릴 때 또 튼다.
    played.current.add(assetId)
    play.current(assetId)
  }, [input.enabled, input.me, input.messages, input.assetPaths, input.playingVoice])
}
