import { useEffect, useRef } from 'react'
import { AppState, type AppStateStatus } from 'react-native'

/**
 * 앱이 앞으로 돌아오면 다시 붙는다.
 *
 * **아이폰은 앱을 닫으면 몇 초 안에 소켓이 끊긴다.** 막을 수 없다.
 * 대신 앞으로 돌아온 순간 바로 다시 붙어서, 사용자가 화면을 보는
 * 동안에는 늘 연결된 상태를 만든다.
 *
 * 안드로이드도 화면이 오래 꺼져 있으면 비슷한 일이 생긴다.
 */
export function useReconnectOnForeground(reconnect: () => void, enabled = true): void {
  const latest = useRef(reconnect)
  latest.current = reconnect

  useEffect(() => {
    if (!enabled) return

    let previous: AppStateStatus = AppState.currentState

    const subscription = AppState.addEventListener('change', next => {
      const cameForward =
        previous.match(/inactive|background/) !== null && next === 'active'
      previous = next

      if (cameForward) latest.current()
    })

    return () => subscription.remove()
  }, [enabled])
}
