import { createElement, forwardRef, type ReactNode } from 'react'

/**
 * `react-native-reanimated` 를 흉내 낸다.
 *
 * **움직임은 글자로 확인할 수 없다.** 자리만 잡아두고 넘어간다. 여기서
 * 보려는 것은 버튼이 눌리는가지 버튼이 어떻게 튀는가가 아니다.
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

const passthrough = <T,>(value: T): T => value

export const useSharedValue = <T,>(initial: T) => ({ value: initial })
export const useAnimatedStyle = (fn: () => unknown) => fn()
export const useDerivedValue = <T,>(fn: () => T) => ({ value: fn() })
export const withTiming = passthrough
export const withSpring = passthrough
export const withDelay = <T,>(_ms: number, value: T): T => value
export const withRepeat = <T,>(value: T): T => value
export const withSequence = <T,>(...values: T[]): T | undefined => values[0]
export const cancelAnimation = () => undefined
export const runOnJS =
  <A extends unknown[]>(fn: (...args: A) => unknown) =>
  (...args: A) =>
    fn(...args)
export const runOnUI =
  <A extends unknown[]>(fn: (...args: A) => unknown) =>
  (...args: A) =>
    fn(...args)
export const interpolate = (value: number) => value
export const interpolateColor = (_value: number, _input: number[], output: string[]) =>
  output[0]
export const Easing = {
  linear: passthrough,
  ease: passthrough,
  inOut: passthrough,
  out: passthrough,
  in: passthrough,
  bezier: () => passthrough,
}
/**
 * 화면에 들고 날 때의 움직임.
 *
 * `FadeIn.duration(200).delay(50)` 처럼 줄줄이 이어 부른다. 그래서
 * **무엇을 불러도 자기 자신을 돌려주는** 것으로 만든다. 하나라도 빠지면
 * 화면이 아예 안 그려진다.
 */
function motion(): Record<string, () => unknown> {
  const self: Record<string, () => unknown> = {}
  for (const name of [
    'duration',
    'delay',
    'springify',
    'easing',
    'withInitialValues',
    'withCallback',
    'randomDelay',
    'reduceMotion',
    'build',
    'damping',
    'stiffness',
    'mass',
    'restDisplacementThreshold',
    'restSpeedThreshold',
  ]) {
    self[name] = () => self
  }
  return self
}

export const FadeIn = motion()
export const FadeOut = motion()
export const SlideInDown = motion()
export const SlideOutDown = motion()
export const SlideInUp = motion()
export const SlideOutUp = motion()
export const SlideInLeft = motion()
export const SlideOutLeft = motion()
export const SlideInRight = motion()
export const SlideOutRight = motion()
export const ZoomIn = motion()
export const ZoomOut = motion()
export const Layout = motion()
export const LinearTransition = motion()

export const Animated = {
  View: host('AnimatedView'),
  Text: host('AnimatedText'),
  ScrollView: host('AnimatedScrollView'),
  Image: host('AnimatedImage'),
  createAnimatedComponent: <T,>(component: T): T => component,
}

export default Animated
