import { Platform } from 'react-native'

/**
 * 폰을 내려놔도 상대가 말을 걸면 알려준다.
 *
 * **이게 없으면 앱을 보고 있을 때만 대화가 된다.** 폰을 잠그거나 다른
 * 앱을 보는 순간 말이 끊긴 것처럼 느껴진다. 세 시간 동안 화면만 보고
 * 있을 수는 없다.
 *
 * ## 서버가 필요 없다
 *
 * 흔히 쓰는 푸시 알림은 애플·구글 서버를 거친다. **비행기에는 인터넷이
 * 없어서 무용하다.** 여기서 쓰는 것은 기기가 스스로 띄우는 알림이라
 * 서버가 필요 없다. 메시지를 받은 그 자리에서 바로 띄운다.
 *
 * ## 없어도 앱은 돈다
 *
 * 권한을 거절했거나 모듈이 없으면 아무 일도 안 한다. 알림이 안 오는
 * 것은 불편할 뿐이고, **여기서 앱이 죽으면 글도 못 쓴다.**
 */

type LoadResult =
  // biome-ignore lint/suspicious/noExplicitAny: 네이티브 모듈이라 타입을 우리가 정하지 않는다
  { readonly available: true; readonly module: any } | { readonly available: false }

let cached: LoadResult | null = null

function load(): LoadResult {
  if (cached !== null) return cached

  try {
    const loaded = require('expo-notifications')
    cached =
      loaded !== null && typeof loaded.scheduleNotificationAsync === 'function'
        ? { available: true, module: loaded }
        : { available: false }
  } catch {
    cached = { available: false }
  }

  return cached
}

export class LocalNotifier {
  private allowed = false
  private ready = false

  /**
   * 알릴 준비를 한다.
   *
   * 권한을 물어보고, 안드로이드에서는 알림 통로를 만든다. **거절해도
   * 그냥 넘어간다.** 다시 묻지 않는다. 물어볼 때마다 귀찮게 하면
   * 앱을 꺼버린다.
   */
  async prepare(): Promise<boolean> {
    if (this.ready) return this.allowed
    this.ready = true

    const loaded = load()
    if (!loaded.available) return false

    try {
      // 앱을 보고 있을 때는 잠금 화면 알림을 안 띄운다.
      // 화면에 이미 떠 있는데 또 울리면 시끄럽다.
      loaded.module.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: false,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      })

      if (Platform.OS === 'android') {
        await loaded.module.setNotificationChannelAsync('messages', {
          name: '메시지',
          importance: loaded.module.AndroidImportance?.HIGH ?? 4,
          vibrationPattern: [0, 80, 120, 80],
          enableVibrate: true,
        })

        /**
         * 연결 알림은 통로를 따로 둔다.
         *
         * **메시지 알림을 꺼도 이건 남아야 한다.** 핫스팟이 꺼진 것을
         * 모르면 메시지가 아예 안 오는데, 그때 알림까지 꺼져 있으면
         * 상대가 조용한 것인지 끊긴 것인지 알 길이 없다.
         *
         * 진동도 더 길게 준다. 주머니에서도 알아채야 한다.
         */
        await loaded.module.setNotificationChannelAsync('link', {
          name: '연결 상태',
          importance: loaded.module.AndroidImportance?.HIGH ?? 4,
          vibrationPattern: [0, 200, 150, 200],
          enableVibrate: true,
        })
      }

      const existing = await loaded.module.getPermissionsAsync()
      const granted =
        existing.granted === true ||
        (await loaded.module.requestPermissionsAsync()).granted === true

      this.allowed = granted
      return granted
    } catch {
      // 권한을 못 물어봤다. 알림 없이 간다.
      return false
    }
  }

  /**
   * 지금 띄운다.
   *
   * `null` 로 예약하면 **곧바로** 뜬다. 시간을 재는 것이 아니라
   * 이미 받은 것을 알리는 것이라 기다릴 이유가 없다.
   */
  async show(
    title: string,
    body: string,
    channel: 'messages' | 'link' = 'messages',
  ): Promise<void> {
    if (!this.allowed || body.length === 0) return

    const loaded = load()
    if (!loaded.available) return

    try {
      await loaded.module.scheduleNotificationAsync({
        content: {
          title,
          body,
          // 연결이 끊긴 것은 소리까지 내서 알린다. 주머니에 있으면
          // 진동만으로는 놓친다.
          sound: channel === 'link',
          ...(Platform.OS === 'android' ? { channelId: channel } : {}),
        },
        trigger: null,
      })
    } catch {
      // 못 띄웠다. 앱을 열면 메시지는 그대로 있다.
    }
  }

  /**
   * 쌓인 알림을 치운다.
   *
   * 앱을 열면 이미 다 본 것이다. 잠금 화면에 남겨두면 나중에
   * 안 읽은 게 있는 줄 안다.
   */
  async clear(): Promise<void> {
    const loaded = load()
    if (!loaded.available) return

    try {
      await loaded.module.dismissAllNotificationsAsync()
    } catch {
      // 못 치웠다. 사람이 쓸어 넘기면 된다.
    }
  }
}
