import { useEffect } from 'react'
import { Platform } from 'react-native'
import { keepLinkAwake } from '@/composition/services'

/**
 * 아이폰이 뒤로 가도 연결을 붙든다.
 *
 * ## 안드로이드와 다른 길
 *
 * 안드로이드는 전경 서비스로 붙든다(`useStayAlive`). **아이폰에는
 * 그런 길이 없다.** 하나 있는 것은 소리를 내는 것이다. `audio` 배경
 * 모드를 가진 앱이 실제로 소리를 내고 있으면 iOS 가 안 재운다.
 *
 * 그래서 들리지 않는 소리를 계속 흘린다. 볼륨이 0 이고 담긴 것도
 * 무음이라 들릴 것이 없고, `mixWithOthers` 라 음악도 안 끊긴다.
 *
 * ## 기본은 꺼둔다
 *
 * 세 시간 내내 소리 장치를 깨워두면 배터리를 먹는다. **폰이 죽으면
 * 대화가 아예 끝난다.** 연결이 자꾸 끊길 때만 설정에서 켠다.
 *
 * (docs/04-transport-spec.md 2.7)
 */
export function useKeepLinkAwake(enabled: boolean): void {
  useEffect(() => {
    // 안드로이드는 전경 서비스가 맡는다. 여기서 또 할 일이 없다.
    if (!enabled || Platform.OS !== 'ios') return

    void keepLinkAwake.start()
    return () => void keepLinkAwake.stop()
  }, [enabled])
}
