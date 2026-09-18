import * as Haptics from 'expo-haptics'
import { Vibration as RNVibration } from 'react-native'
import type { Vibration } from '@/application/ports/Vibration'

/**
 * 폰을 떨게 한다.
 *
 * 콕 찌르기와 누르고 말하기에서 쓴다. **말 없이 "자니?" 하는 용도라**
 * 소리보다 진동이 맞다. 비행기는 시끄럽고, 상대는 이어폰을 꽂고 있다.
 *
 * ## 실패해도 조용히 넘어간다
 *
 * 진동이 안 울리는 것은 아무것도 안 울리는 것보다 낫지 않지만,
 * **그것 때문에 앱이 죽으면 훨씬 나쁘다.** 진동을 못 쓰는 기기가
 * 있고, 설정에서 꺼둔 사람도 있다.
 */
export class HapticVibration implements Vibration {
  /** 콕 찔렸을 때. 두 번 톡톡 친다 */
  async nudge(): Promise<void> {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      await wait(120)
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch {
      // 햅틱이 없는 기기다. 그냥 떨게 한다.
      try {
        RNVibration.vibrate([0, 80, 120, 80])
      } catch {
        // 진동도 없다. 화면에는 이미 떴다.
      }
    }
  }

  /**
   * 마이크가 열렸을 때. 짧게 한 번.
   *
   * 소리 설정을 바꾸는 데 0.1초쯤 걸린다. **이 진동이 오기 전에
   * 말하면 앞부분이 잘린다.** 그래서 준비됐다는 표시다.
   */
  async talkReady(): Promise<void> {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    } catch {
      // 없어도 된다. 화면 색이 이미 바뀌었다.
    }
  }

  /** 가벼운 확인. 메시지가 왔을 때 같은 것 */
  async tap(): Promise<void> {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    } catch {
      // 조용히 넘어간다
    }
  }

  /** 뭔가 잘못됐을 때 */
  async warn(): Promise<void> {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } catch {
      // 조용히 넘어간다
    }
  }
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
