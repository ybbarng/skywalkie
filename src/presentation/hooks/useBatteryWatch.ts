import { useEffect, useState } from 'react'
import { AppState } from 'react-native'
import { readBattery } from '@/composition/services'

/**
 * 내 배터리를 지켜본다.
 *
 * **비행기에서 폰이 죽으면 대화가 끝난다.** 핫스팟을 연 쪽은 특히
 * 빨리 준다. 미리 알면 보조 배터리를 꽂거나 통화를 접을 수 있다.
 *
 * 상대에게도 알려준다. 갑자기 조용해졌을 때 **잠든 것인지 폰이 죽은
 * 것인지** 알 수 있어야 한다.
 *
 * 자주 읽지 않는다. 배터리는 천천히 줄고, 자주 읽는 것 자체가
 * 배터리를 쓴다.
 */

const CHECK_EVERY_MS = 60_000

export interface BatteryWatch {
  /** 0에서 1 사이. 아직 모르면 null */
  readonly level: number | null
  readonly charging: boolean
}

export function useBatteryWatch(enabled = true): BatteryWatch {
  const [watch, setWatch] = useState<BatteryWatch>({
    level: null,
    charging: false,
  })

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    async function check(): Promise<void> {
      const now = await readBattery()
      if (cancelled || now === null) return
      setWatch(now)
    }

    void check()
    const timer = setInterval(() => void check(), CHECK_EVERY_MS)

    // 앱이 앞으로 돌아오면 바로 본다. 뒤에 있는 동안 많이 줄었을 수 있다.
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active') void check()
    })

    return () => {
      cancelled = true
      clearInterval(timer)
      subscription.remove()
    }
  }, [enabled])

  return watch
}
