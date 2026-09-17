import type { ExpoConfig } from 'expo/config'

/**
 * 앱 설정. 여기서 ios/ 와 android/ 폴더가 만들어진다.
 * 네이티브를 고쳐야 할 일이 생기면 손으로 만지지 말고 여기 플러그인으로 처리한다.
 * (docs/08-build-release.md 참고)
 */
const config: ExpoConfig = {
  name: 'Skywalkie',
  slug: 'skywalkie',
  scheme: 'skywalkie',
  version: '0.1.0',
  orientation: 'default',
  userInterfaceStyle: 'automatic',

  // 아이콘은 assets/icon/*.svg 가 원본이고 `pnpm icons:generate` 가 뽑는다.
  // generated 폴더는 저장소에 넣지 않는다. (docs/07-design-system.md 7장)
  icon: './assets/icon/generated/icon.png',
  backgroundColor: '#0B1020',

  ios: {
    bundleIdentifier: 'com.ybbarng.skywalkie',
    supportsTablet: false,
    infoPlist: {
      // 소리가 흐르는 동안에는 앱이 뒤로 가도 살아 있어야 한다.
      // 화면을 끄고도 대화가 이어지려면 필요하다. (docs/06-voice-video-spec.md 4장)
      UIBackgroundModes: ['audio', 'bluetooth-central', 'bluetooth-peripheral'],

      NSMicrophoneUsageDescription: '상대에게 목소리를 전하려면 마이크가 필요해요.',
      NSCameraUsageDescription: '영상 통화로 얼굴을 보여주려면 카메라가 필요해요.',
      NSBluetoothAlwaysUsageDescription:
        'Wi-Fi를 쓸 수 없을 때 블루투스로 메시지를 주고받아요.',
      NSPhotoLibraryUsageDescription: '사진을 골라 보내려면 앨범이 필요해요.',
      NSLocalNetworkUsageDescription: '같은 Wi-Fi에 있는 상대 폰을 찾으려면 필요해요.',
      // 기기를 찾기 위해 사설망에 알리는 서비스 이름
      NSBonjourServices: ['_skywalkie._tcp'],
    },
  },

  android: {
    package: 'com.ybbarng.skywalkie',
    adaptiveIcon: {
      foregroundImage: './assets/icon/generated/icon-foreground.png',
      backgroundImage: './assets/icon/generated/icon-background.png',
      monochromeImage: './assets/icon/generated/icon-monochrome.png',
    },
    permissions: [
      'android.permission.INTERNET',
      'android.permission.ACCESS_NETWORK_STATE',
      'android.permission.ACCESS_WIFI_STATE',
      'android.permission.CHANGE_WIFI_MULTICAST_STATE',
      'android.permission.RECORD_AUDIO',
      'android.permission.MODIFY_AUDIO_SETTINGS',
      'android.permission.CAMERA',
      'android.permission.BLUETOOTH_SCAN',
      'android.permission.BLUETOOTH_CONNECT',
      'android.permission.BLUETOOTH_ADVERTISE',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.VIBRATE',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MICROPHONE',
      'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
      'android.permission.WAKE_LOCK',
    ],
  },

  // `expo install` 은 플러그인을 app.json 에 적으려 한다.
  // 설정이 두 곳으로 흩어지지 않게 여기로 옮기고 app.json 은 지운다.
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/icon/generated/splash.png',
        imageWidth: 180,
        backgroundColor: '#0B1020',
        // 밝은 화면에서도 같은 그림을 쓰되 바탕만 바꾼다
        dark: { backgroundColor: '#0B1020' },
      },
    ],
    'expo-sqlite',
  ],

  experiments: {
    typedRoutes: true,
  },
}

export default config
