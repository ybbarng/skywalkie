import { useEffect } from 'react'
import { keepAwake } from '@/composition/services'

/**
 * 화면이 꺼지지 않게 붙든다.
 *
 * **통화 중에만 쓴다.** 화면이 꺼지면 아이폰이 앱을 재우려 하고,
 * 그러면 목소리가 끊긴다.
 *
 * 대화할 때는 안 쓴다. 세 시간 내내 화면을 켜두면 배터리가 먼저
 * 죽는다. 그러면 대화 자체가 끝난다.
 */
export function useKeepAwake(active: boolean, why: string): void {
  useEffect(() => {
    if (!active) return

    void keepAwake.hold(why)
    return () => {
      void keepAwake.release(why)
    }
  }, [active, why])
}
