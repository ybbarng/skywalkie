import { useEffect } from 'react'
import { stayAlive } from '@/composition/services'

/**
 * 대화하는 동안 연결을 지킨다. 안드로이드만.
 *
 * ## 무엇을 막나
 *
 * 앱이 뒤로 가면 React Native 가 **JS 타이머를 통째로 끈다.** 5초마다
 * 보내던 심장박동이 멎고, 상대는 15초 뒤 "끊겼다" 고 보고 소켓을
 * 닫는다. 다시 붙고 또 15초 뒤 끊기는 일이 되풀이된다.
 *
 * 전경 서비스 안에서 헤드리스 작업을 하나 띄워두면 타이머가 살아
 * 있다. 그래서 주머니에 넣어둬도 대화가 이어진다.
 *
 * ## 대가
 *
 * 알림창에 **알림이 하나 떠 있게 된다.** 안드로이드가 강제하는
 * 것이라 없앨 수 없다. 대신 가장 낮은 중요도로 두어 소리도 진동도
 * 내지 않는다.
 *
 * ## 아이폰에서는
 *
 * 아무 일도 안 한다. 아이폰은 이런 길이 없다. 앞으로 돌아오면
 * 곧바로 다시 붙는 것(`useReconnectOnForeground`)과, 미리 걸어둔
 * 알림(`useAwayReminder`)으로 메운다.
 *
 * (docs/04-transport-spec.md 2.7)
 */
export function useStayAlive(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return
    if (!stayAlive.available()) return

    stayAlive.start()

    // 대화 화면을 떠나면 끈다. 알림도 같이 사라진다.
    return () => stayAlive.stop()
  }, [enabled])
}
