import type { Message } from '@/domain/message/Message'
import type { PeerId } from '@/domain/peer/PeerId'

/**
 * 다음에 저절로 들려줄 음성 메시지 고르기.
 *
 * **이게 잘 되면 무전기가 된다.** 상대가 말하면 내 이어폰에서 바로
 * 나오고, 나는 마이크를 꾹 눌러 답한다. 통화와 달리 둘 다 동시에
 * 붙어 있을 필요가 없다.
 *
 * 소리를 건드리지 않는 순수한 계산이라 여기서 하고 전부 시험한다.
 *
 * ## 지키는 것
 *
 *   · 내가 보낸 것은 안 튼다. 방금 내가 말한 것이다
 *   · 이미 튼 것은 다시 안 튼다
 *   · 아직 안 온 것은 못 튼다. 조각이 다 와야 한다
 *   · **하나씩, 온 순서대로.** 두 개가 겹치면 둘 다 못 알아듣는다
 *   · 앱을 보고 있을 때만. 주머니에서 갑자기 소리가 나면 놀란다
 *
 * ## 왜 "보고 있을 때만" 인가
 *
 * 잠금 화면에서 소리가 나면 옆자리 승객이 듣는다. 이어폰을 꽂고
 * 있더라도 무엇이 나올지 모른 채 소리가 나는 것은 겁난다.
 * 화면을 보고 있으면 지금 대화 중이라는 뜻이다.
 */

export interface AutoplayInput {
  readonly enabled: boolean
  readonly me: PeerId | null
  readonly messages: readonly Message[]
  /** 기기에 다 와 있는 것들 */
  readonly ready: Readonly<Record<string, string>>
  /** 이미 튼 것들 */
  readonly played: ReadonlySet<string>
  /** 지금 무언가 나오고 있나 */
  readonly playing: boolean
  /** 앱을 보고 있나 */
  readonly appActive: boolean
}

/** 지금 틀 것. 없으면 `null` */
export function nextToPlay(input: AutoplayInput): string | null {
  if (!input.enabled || !input.appActive || input.playing) return null
  if (input.me === null) return null

  for (const message of input.messages) {
    if (message.content.kind !== 'voice') continue

    const assetId = message.content.assetId
    if (input.played.has(assetId)) continue

    // 내가 보낸 것은 안 튼다. 방금 내가 말한 것이다.
    if (message.isMine(input.me)) continue

    // 아직 조각이 다 안 왔다. 다 오면 그때 튼다.
    if (input.ready[assetId] === undefined) continue

    return assetId
  }

  return null
}

/**
 * 처음 화면을 열 때 쌓여 있던 것.
 *
 * **이미 온 것을 줄줄이 틀지 않는다.** 앱을 여는 순간 예전 음성이
 * 통째로 재생되면 못 쓴다. 처음 한 번은 전부 "이미 튼 것" 으로 친다.
 */
export function alreadyThere(messages: readonly Message[]): Set<string> {
  const seen = new Set<string>()

  for (const message of messages) {
    if (message.content.kind === 'voice') seen.add(message.content.assetId)
  }

  return seen
}
