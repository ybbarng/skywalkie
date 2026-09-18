import { useRef, useState } from 'react'
import { type LayoutChangeEvent, PanResponder, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import {
  MAX_POINTS_PER_STROKE,
  MAX_STROKES,
  type Point,
  type Stroke,
} from '@/domain/message/MessageContent'
import { useTheme } from '../../theme/ThemeProvider'
import { colorOf } from './DoodleRenderer'
import { thin, toRatio, toSvgPath } from './strokePath'

/**
 * 손가락으로 그리는 판.
 *
 * 좌표를 0~1 비율로 담는다. 화면 크기가 달라도 상대에게 같은 그림이
 * 간다. **아이폰과 안드로이드는 화면 비율이 달라서** 픽셀로 담으면
 * 어긋난다.
 *
 * 도메인이 정한 한계(선 200개, 한 선에 점 1000개)를 여기서도 지킨다.
 * 넘겨서 보낸 뒤 거절당하면 그린 것이 통째로 날아간다.
 *
 * (docs/05-messaging-spec.md 2장 · T24)
 */

interface DoodleCanvasProps {
  color: string
  width: number
  onChange: (strokes: Stroke[]) => void
  strokes: readonly Stroke[]
}

export function DoodleCanvas({
  color,
  width: penWidth,
  onChange,
  strokes,
}: DoodleCanvasProps) {
  const theme = useTheme()
  const [size, setSize] = useState({ width: 0, height: 0 })

  // 그리는 동안은 상태를 안 거친다. 매 점마다 다시 그리면 손이 밀린다.
  const drawing = useRef<Point[]>([])
  const [live, setLive] = useState<Point[]>([])
  const sizeRef = useRef(size)
  sizeRef.current = size

  const strokesRef = useRef(strokes)
  strokesRef.current = strokes

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: event => {
        const { width, height } = sizeRef.current
        drawing.current = [
          toRatio(
            event.nativeEvent.locationX,
            event.nativeEvent.locationY,
            width,
            height,
          ),
        ]
        setLive(drawing.current)
      },

      onPanResponderMove: event => {
        if (drawing.current.length >= MAX_POINTS_PER_STROKE) return

        const { width, height } = sizeRef.current
        drawing.current = [
          ...drawing.current,
          toRatio(
            event.nativeEvent.locationX,
            event.nativeEvent.locationY,
            width,
            height,
          ),
        ]
        setLive(drawing.current)
      },

      onPanResponderRelease: () => {
        const points = thin(drawing.current)
        drawing.current = []
        setLive([])

        if (points.length === 0) return
        if (strokesRef.current.length >= MAX_STROKES) return

        onChange([...strokesRef.current, { points, color, width: penWidth }])
      },
    }),
  ).current

  function onLayout(event: LayoutChangeEvent): void {
    const { width, height } = event.nativeEvent.layout
    setSize({ width, height })
  }

  return (
    <View
      onLayout={onLayout}
      {...responder.panHandlers}
      style={{
        flex: 1,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.surfaceRaised,
        overflow: 'hidden',
      }}
    >
      <Svg width={size.width} height={size.height}>
        {strokes.map((stroke, index) => (
          <Path
            // biome-ignore lint/suspicious/noArrayIndexKey: 선은 자리로 구분한다
            key={index}
            d={toSvgPath(stroke.points, size.width, size.height)}
            stroke={colorOf(stroke.color, theme.colors)}
            strokeWidth={stroke.width}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ))}

        {/* 지금 긋고 있는 선. 손을 떼면 위 목록으로 들어간다 */}
        {live.length > 0 && (
          <Path
            d={toSvgPath(live, size.width, size.height)}
            stroke={colorOf(color, theme.colors)}
            strokeWidth={penWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        )}
      </Svg>
    </View>
  )
}
