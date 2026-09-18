import { createElement, forwardRef, type ReactNode } from 'react'

/**
 * 화면이 쓰는 네이티브 라이브러리들을 흉내 낸다.
 *
 * 전부 Flow 나 네이티브 코드라 vitest 가 못 읽는다. 그림과 움직임은
 * 어차피 글자로 확인할 수 없으니, **자리만 잡아두고 넘어간다.**
 *
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

/* react-native-svg — 캐릭터와 아이콘을 그린다 */
export const Svg = host('Svg')
export const Path = host('Path')
export const Circle = host('Circle')
export const Ellipse = host('Ellipse')
export const Rect = host('Rect')
export const G = host('G')
export const Line = host('Line')
export const Polyline = host('Polyline')
export const Polygon = host('Polygon')
export const Defs = host('Defs')
export const ClipPath = host('ClipPath')
export const LinearGradient = host('LinearGradient')
export const Stop = host('Stop')
export const Mask = host('Mask')
export const SvgText = host('SvgText')
export default Svg

/* react-native-safe-area-context */
export const SafeAreaView = host('SafeAreaView')
export const SafeAreaProvider = host('SafeAreaProvider')
export const useSafeAreaInsets = () => ({ top: 47, bottom: 34, left: 0, right: 0 })
export const initialWindowMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, bottom: 34, left: 0, right: 0 },
}
