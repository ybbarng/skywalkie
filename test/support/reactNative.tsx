import { createElement, forwardRef, type ReactNode } from 'react'

/**
 * `react-native` 를 흉내 낸다.
 *
 * **진짜 `react-native` 은 Flow 로 적혀 있어 vitest 가 못 읽는다.** 그래서
 * 화면을 시험하려면 여기서 가짜를 세워야 한다.
 *
 * 흉내 내는 것은 **생김새가 아니라 뼈대**다. 누를 수 있는가, 잠겼는가,
 * 글자가 들어가는가. 색과 여백은 어차피 여기서 못 본다.
 *
 * 이게 잡아주는 것: "다음 버튼이 안 눌린다", "잠긴 채로 풀리지 않는다",
 * "누르면 아무 일도 안 일어난다". **폰에 깔기 전에 잡힌다.**
 * (docs/09-testing.md)
 */

type AnyProps = Record<string, unknown> & { children?: ReactNode }

function host(name: string) {
  const Component = forwardRef<unknown, AnyProps>((props, ref) =>
    createElement(name, { ...props, ref }),
  )
  Component.displayName = name
  return Component
}

export const View = host('View')
export const Text = host('Text')
export const ScrollView = host('ScrollView')
export const KeyboardAvoidingView = host('KeyboardAvoidingView')
export const SafeAreaView = host('SafeAreaView')
export const Image = host('Image')
export const ActivityIndicator = host('ActivityIndicator')
export const Modal = host('Modal')
export const FlatList = host('FlatList')
export const SectionList = host('SectionList')
export const Switch = host('Switch')
export const TextInput = host('TextInput')
export const Pressable = host('Pressable')
export const TouchableOpacity = host('TouchableOpacity')
export const TouchableWithoutFeedback = host('TouchableWithoutFeedback')

/** 시험에서 어느 폰인지 바꿔가며 볼 수 있게 둔다 */
export const Platform = {
  OS: 'ios' as 'ios' | 'android',
  Version: 26 as number | string,
  select: <T,>(choices: { ios?: T; android?: T; default?: T }): T | undefined =>
    choices[Platform.OS] ?? choices.default,
}

export const StyleSheet = {
  create: <T,>(styles: T): T => styles,
  flatten: (style: unknown) =>
    Array.isArray(style) ? Object.assign({}, ...style) : style,
  absoluteFillObject: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  hairlineWidth: 1,
}

export const Dimensions = {
  get: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }),
  addEventListener: () => ({ remove: () => undefined }),
}

export const Appearance = {
  getColorScheme: () => 'dark' as const,
  addChangeListener: () => ({ remove: () => undefined }),
}

export const AppState = {
  currentState: 'active' as string,
  addEventListener: () => ({ remove: () => undefined }),
}

export const Keyboard = {
  dismiss: () => undefined,
  addListener: () => ({ remove: () => undefined }),
}

export const Linking = {
  openURL: async () => undefined,
  openSettings: async () => undefined,
  sendIntent: async () => undefined,
}

export const Vibration = { vibrate: () => undefined, cancel: () => undefined }

export const AccessibilityInfo = {
  isReduceMotionEnabled: async () => false,
  isScreenReaderEnabled: async () => false,
  addEventListener: () => ({ remove: () => undefined }),
  announceForAccessibility: () => undefined,
}

export const PermissionsAndroid = {
  requestMultiple: async () => ({}),
  PERMISSIONS: {},
  RESULTS: { GRANTED: 'granted' },
}

export const InteractionManager = {
  runAfterInteractions: (fn: () => void) => {
    fn()
    return { cancel: () => undefined }
  },
}

export const NativeModules: Record<string, unknown> = {}
export const useColorScheme = () => 'dark' as const
export const useWindowDimensions = () => ({
  width: 390,
  height: 844,
  scale: 3,
  fontScale: 1,
})
