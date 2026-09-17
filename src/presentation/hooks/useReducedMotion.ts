import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

/**
 * 기기에서 "동작 줄이기"를 켰는지.
 *
 * 켰다면 움직임을 전부 없애고 즉시 바뀌게 한다.
 * 멀미가 나는 사람이 있고, 비행 중엔 더 그렇다.
 * (docs/07-design-system.md 5장)
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    let cancelled = false

    void AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
      if (!cancelled) setReduced(enabled)
    })

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduced,
    )

    return () => {
      cancelled = true
      subscription.remove()
    }
  }, [])

  return reduced
}
