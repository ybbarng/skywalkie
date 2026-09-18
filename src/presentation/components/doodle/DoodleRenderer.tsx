import { useEffect, useState } from 'react'
import { View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import type { Stroke } from '@/domain/message/MessageContent'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useTheme } from '../../theme/ThemeProvider'
import type { ColorTokens } from '../../theme/tokens'
import { PLAYBACK_MS, strokesAt, toSvgPath } from './strokePath'

/**
 * 받은 낙서를 그린다.
 *
 * **그려지는 과정이 재생된다.** 그냥 나타나는 것보다 재밌고, 상대가
 * 그리는 걸 곁에서 본 것 같다.
 *
 * 색은 토큰 이름으로 담겨 온다. 여기서 실제 색으로 바꾼다. 그래야
 * 보내는 쪽이 어두운 화면이고 받는 쪽이 밝은 화면이어도 잘 보인다.
 * (docs/05-messaging-spec.md 2장 · T24)
 */

interface DoodleRendererProps {
  strokes: readonly Stroke[]
  width: number
  height: number
  /** 그려지는 과정을 보여줄까. 한 번 본 낙서는 바로 완성으로 둔다 */
  animate?: boolean
}

export function DoodleRenderer({
  strokes,
  width,
  height,
  animate = false,
}: DoodleRendererProps) {
  const theme = useTheme()
  const reducedMotion = useReducedMotion()
  const progress = usePlayback(animate && !reducedMotion)

  const visible = strokesAt(strokes, progress)

  return (
    <View
      style={{
        width,
        height,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.surfaceRaised,
        overflow: 'hidden',
      }}
    >
      <Svg width={width} height={height}>
        {visible.map((stroke, index) => (
          <Path
            // 선은 순서가 곧 정체성이라 자리로 구분한다
            // biome-ignore lint/suspicious/noArrayIndexKey: 선은 자리로 구분한다
            key={index}
            d={toSvgPath(stroke.points, width, height)}
            stroke={colorOf(stroke.color, theme.colors)}
            strokeWidth={stroke.width}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ))}
      </Svg>
    </View>
  )
}

/** 0 에서 1 까지 흐른다 */
function usePlayback(active: boolean): number {
  const [progress, setProgress] = useState(active ? 0 : 1)

  useEffect(() => {
    if (!active) {
      setProgress(1)
      return
    }

    const startedAt = Date.now()
    const timer = setInterval(() => {
      const ratio = (Date.now() - startedAt) / PLAYBACK_MS
      setProgress(Math.min(1, ratio))
      if (ratio >= 1) clearInterval(timer)
    }, 33)

    return () => clearInterval(timer)
  }, [active])

  return progress
}

/**
 * 토큰 이름을 실제 색으로.
 *
 * 모르는 이름이면 글자 색을 쓴다. 상대가 새 버전이라 우리가 모르는
 * 색을 쓸 수 있는데, 거기서 안 그려지면 낙서가 반쪽이 된다.
 */
export function colorOf(token: string, colors: ColorTokens): string {
  switch (token) {
    case 'me':
      return colors.me
    case 'peer':
      return colors.peer
    case 'success':
      return colors.success
    case 'warning':
      return colors.warning
    case 'danger':
      return colors.danger
    case 'muted':
      return colors.textMuted
    default:
      return colors.text
  }
}

/** 낙서에 쓸 수 있는 색들. 고르는 화면이 이 목록을 보여준다 */
export const doodleColors = [
  'me',
  'peer',
  'success',
  'warning',
  'danger',
  'muted',
] as const
