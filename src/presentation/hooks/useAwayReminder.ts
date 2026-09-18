import { useEffect, useRef } from 'react'
import { notifier } from '@/composition/services'
import type { Role } from '../copy/connecting'
import { awayReminder } from '../copy/link'

/**
 * 앱이 잠든 뒤에도 알리는 유일한 길.
 *
 * ## 문제
 *
 * 아이폰은 앱이 뒤로 가면 몇십 초 안에 잠재운다. 그때부터 우리 코드가
 * 안 돈다. **알림을 띄우는 것은 되는데, 띄울 때가 됐다는 걸 알아챌
 * 수가 없다.** 안드로이드도 화면이 오래 꺼져 있으면 비슷하다.
 *
 * ## 푸는 법
 *
 * 살아 있는 동안 **미리 걸어둔다.** "10분 뒤에 이걸 띄워줘" 를
 * 운영체제에 맡기면, 앱이 자든 꺼졌든 약속한 시각에 띄운다.
 *
 * 그리고 멀쩡히 도는 동안에는 1분마다 거둬들이고 다시 건다. 그래서
 * **영영 안 뜬다.** 우리가 10분 넘게 멈춰 있을 때만 터진다.
 *
 * ```
 * 도는 중   ─┬─ 걸기(10분 뒤) ─┬─ 거두고 다시 걸기 ─┬─ …   안 뜬다
 *            1분               2분                 3분
 *
 * 잠듦      ─┬─ 걸기(10분 뒤) ─────────────────────────▶ 뜬다
 *            마지막으로 돈 때                        10분 뒤
 * ```
 *
 * ## 왜 10분인가
 *
 * 폰을 잠그면 곧바로 끊긴다. 2분으로 잡으면 잠글 때마다 울린다.
 * 잠깐 딴짓하는 것과 **한참 손을 놓은 것**을 가르는 선이 필요하다.
 *
 * 특히 안드로이드는 붙은 기기가 없으면 얼마 뒤 핫스팟을 저 혼자 끈다.
 * 그렇게 되면 아이폰이 앱을 열어도 못 들어온다. 그때 여는 쪽이
 * 알아채야 한다.
 */

/** 이만큼 우리가 안 돌면 뜬다 */
export const AWAY_AFTER_MS = 10 * 60_000

/** 이만큼마다 거두고 다시 건다 */
const REARM_EVERY_MS = 60_000

export interface AwayReminderInput {
  readonly enabled: boolean
  readonly role: Role
  readonly peerName: string | null
}

export function useAwayReminder(input: AwayReminderInput): void {
  /** 걸어둔 것. 다시 걸 때 이걸 먼저 거둔다 */
  const armed = useRef<string | null>(null)

  const latest = useRef(input)
  latest.current = input

  useEffect(() => {
    if (!input.enabled) return

    let stopped = false

    async function rearm(): Promise<void> {
      const now = latest.current

      // 먼저 거둔다. 안 거두면 1분마다 하나씩 쌓여 나중에 줄줄이 뜬다.
      const previous = armed.current
      armed.current = null
      if (previous !== null) await notifier.cancelScheduled(previous)

      if (stopped) return

      const alert = awayReminder(now.role, now.peerName)
      const id = await notifier.scheduleIn(
        AWAY_AFTER_MS / 1000,
        alert.title,
        alert.body,
        { kind: 'link' },
      )

      // 그새 화면을 떠났으면 방금 건 것도 거둔다
      if (stopped && id !== null) {
        void notifier.cancelScheduled(id)
        return
      }

      armed.current = id
    }

    void rearm()
    const timer = setInterval(() => void rearm(), REARM_EVERY_MS)

    return () => {
      stopped = true
      clearInterval(timer)

      // 대화 화면을 떠난다. 걸어둔 것을 거둔다.
      const previous = armed.current
      armed.current = null
      if (previous !== null) void notifier.cancelScheduled(previous)
    }
  }, [input.enabled])
}
