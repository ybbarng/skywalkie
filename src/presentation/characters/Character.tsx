import { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg'
import type { CharacterId, Expression } from '@/domain/peer/Character'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { useTheme } from '../theme/ThemeProvider'
import {
  BLINK_DURATION_MS,
  blinkAmount,
  type FaceShape,
  nextBlinkGap,
  shapeFor,
  shapeWhileSpeaking,
  smoothLevel,
} from './expressions'
import { paletteWithFade } from './palettes'

/**
 * 캐릭터.
 *
 * 그림 파일이 아니라 코드로 그린다. 상대가 말하면 입이 움직이고 연결이
 * 끊기면 시무룩해져야 하는데, 그림 파일로는 그런 변화를 만들 수 없다.
 *
 * 무엇을 그릴지 **정하는 일은 `expressions.ts` 가** 하고 여기서는
 * 그리기만 한다. 그래서 표정 계산은 전부 시험되어 있다.
 * (docs/07-design-system.md 6장)
 */

interface CharacterProps {
  id: CharacterId
  expression: Expression
  /** 말할 때 소리 크기. 0에서 1 사이 */
  level?: number
  size?: number
}

export function Character({ id, expression, level = 0, size = 160 }: CharacterProps) {
  const theme = useTheme()
  const reducedMotion = useReducedMotion()

  const smoothed = useSmoothedLevel(level, expression === 'speaking')
  const blink = useBlink(reducedMotion, expression)

  const base =
    expression === 'speaking' ? shapeWhileSpeaking(smoothed) : shapeFor(expression)
  const shape: FaceShape = { ...base, eyeOpen: base.eyeOpen * blink }
  const palette = paletteWithFade(id, theme.mode, shape.desaturate)

  return (
    <View accessibilityLabel={describe(expression)}>
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <G rotation={shape.tiltDegrees} origin="60, 70">
          {/* 어깨 */}
          <Path d="M22 120c0-16 17-27 38-27s38 11 38 27z" fill={palette.clothing} />

          {/* 목 */}
          <Rect x={52} y={78} width={16} height={16} fill={palette.skinShade} />

          {/* 얼굴 */}
          <Ellipse cx={60} cy={56} rx={30} ry={33} fill={palette.skin} />

          <Hair id={id} palette={palette} />
          <Eyes shape={shape} palette={palette} />
          <Brows shape={shape} palette={palette} />
          <Mouth shape={shape} palette={palette} />
          <Blush shape={shape} palette={palette} />
          <Accessory id={id} palette={palette} />
        </G>

        {expression === 'sleeping' && <SleepMarks palette={palette} />}
        {expression === 'typing' && <TypingDots palette={palette} />}
      </Svg>
    </View>
  )
}

type Palette = ReturnType<typeof paletteWithFade>

function Eyes({ shape, palette }: { shape: FaceShape; palette: Palette }) {
  const height = Math.max(0.5, shape.eyeOpen * 5)

  // 눈을 거의 감았으면 선으로 그린다. 납작한 타원은 어색해 보인다.
  if (shape.eyeOpen < 0.12) {
    return (
      <G>
        <Path d="M44 55h9" stroke={palette.line} strokeWidth={2} strokeLinecap="round" />
        <Path d="M67 55h9" stroke={palette.line} strokeWidth={2} strokeLinecap="round" />
      </G>
    )
  }

  return (
    <G>
      <Ellipse cx={48.5} cy={55} rx={4} ry={height} fill={palette.line} />
      <Ellipse cx={71.5} cy={55} rx={4} ry={height} fill={palette.line} />
      {/* 눈에 비치는 빛. 이게 있어야 살아 있어 보인다 */}
      {shape.eyeOpen > 0.6 && (
        <G>
          <Circle cx={50} cy={53} r={1.4} fill={palette.skin} />
          <Circle cx={73} cy={53} r={1.4} fill={palette.skin} />
        </G>
      )}
    </G>
  )
}

function Brows({ shape, palette }: { shape: FaceShape; palette: Palette }) {
  const lift = shape.browLift * 6

  return (
    <G>
      <Path
        d={`M43 ${45 - lift}q5 -3 11 ${shape.browLift < 0 ? 1 : -1}`}
        stroke={palette.hairShade}
        strokeWidth={2.2}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d={`M66 ${45 - lift}q6 ${shape.browLift < 0 ? 1 : -1} 11 ${shape.browLift < 0 ? -1 : 1}`}
        stroke={palette.hairShade}
        strokeWidth={2.2}
        strokeLinecap="round"
        fill="none"
      />
    </G>
  )
}

function Mouth({ shape, palette }: { shape: FaceShape; palette: Palette }) {
  const open = shape.mouthOpen * 12
  const curve = shape.mouthCurve * 6

  if (open < 1.5) {
    // 다문 입은 선 하나로 그린다
    return (
      <Path
        d={`M52 70q8 ${curve} 16 0`}
        stroke={palette.mouth}
        strokeWidth={2.2}
        strokeLinecap="round"
        fill="none"
      />
    )
  }

  return (
    <Ellipse cx={60} cy={70 + curve / 3} rx={6.5} ry={open / 2} fill={palette.mouth} />
  )
}

function Blush({ shape, palette }: { shape: FaceShape; palette: Palette }) {
  if (shape.desaturate >= 0.5) return null

  return (
    <G opacity={0.45}>
      <Ellipse cx={40} cy={64} rx={5} ry={3} fill={palette.blush} />
      <Ellipse cx={80} cy={64} rx={5} ry={3} fill={palette.blush} />
    </G>
  )
}

/** 캐릭터를 가르는 건 머리 모양과 소품뿐이다. 얼굴 얼개는 하나를 함께 쓴다 */
function Hair({ id, palette }: { id: CharacterId; palette: Palette }) {
  switch (id) {
    case 'aria':
      return (
        <G>
          <Path
            d="M30 54c0-19 13-30 30-30s30 11 30 30c0-8-6-12-12-13-6 4-30 4-36 0-6 1-12 5-12 13z"
            fill={palette.hair}
          />
          <Path
            d="M28 52c-1 16 1 28 4 36 2-10 2-24 1-36zM92 52c1 16-1 28-4 36-2-10-2-24-1-36z"
            fill={palette.hair}
          />
        </G>
      )
    case 'nova':
      return (
        <Path
          d="M30 56c0-20 13-32 30-32s30 12 30 32c-2-9-8-14-14-15-7 4-25 4-32 0-6 1-12 6-14 15z"
          fill={palette.hair}
        />
      )
    case 'orion':
      return (
        <Path
          d="M31 50c2-16 14-26 29-26s27 10 29 26c-4-6-10-9-16-10-8 3-18 3-26 0-6 1-12 4-16 10z"
          fill={palette.hair}
        />
      )
    case 'atlas':
      return (
        <G>
          <Circle cx={44} cy={32} r={11} fill={palette.hair} />
          <Circle cx={60} cy={27} r={12} fill={palette.hair} />
          <Circle cx={76} cy={32} r={11} fill={palette.hair} />
          <Circle cx={35} cy={44} r={9} fill={palette.hair} />
          <Circle cx={85} cy={44} r={9} fill={palette.hair} />
        </G>
      )
    case 'luna':
      return (
        <G>
          <Path
            d="M30 54c0-19 13-30 30-30s30 11 30 30c-3-8-8-12-14-13-7 4-25 4-32 0-6 1-11 5-14 13z"
            fill={palette.hair}
          />
          {/* 묶은 머리 */}
          <Circle cx={92} cy={40} r={8} fill={palette.hairShade} />
        </G>
      )
    case 'pilot':
      return (
        <Path
          d="M31 50c2-16 14-26 29-26s27 10 29 26c-4-6-10-9-16-10-8 3-18 3-26 0-6 1-12 4-16 10z"
          fill={palette.hair}
        />
      )
  }
}

function Accessory({ id, palette }: { id: CharacterId; palette: Palette }) {
  switch (id) {
    case 'aria':
      // 헤드폰
      return (
        <G>
          <Path
            d="M27 56a33 33 0 0 1 66 0"
            stroke={palette.accessory}
            strokeWidth={4}
            fill="none"
            strokeLinecap="round"
          />
          <Rect x={21} y={52} width={10} height={16} rx={5} fill={palette.accessory} />
          <Rect x={89} y={52} width={10} height={16} rx={5} fill={palette.accessory} />
        </G>
      )
    case 'nova':
      // 안경
      return (
        <G>
          <Circle
            cx={48.5}
            cy={55}
            r={9}
            stroke={palette.accessory}
            strokeWidth={2.2}
            fill="none"
          />
          <Circle
            cx={71.5}
            cy={55}
            r={9}
            stroke={palette.accessory}
            strokeWidth={2.2}
            fill="none"
          />
          <Path d="M57.5 55h5" stroke={palette.accessory} strokeWidth={2.2} />
        </G>
      )
    case 'orion':
      // 이어폰
      return (
        <G>
          <Circle cx={30} cy={58} r={4} fill={palette.accessory} />
          <Circle cx={90} cy={58} r={4} fill={palette.accessory} />
        </G>
      )
    case 'atlas':
      // 후드
      return (
        <Path
          d="M22 120c0-16 17-27 38-27s38 11 38 27zM38 95q22 14 44 0"
          stroke={palette.accessory}
          strokeWidth={3}
          fill="none"
        />
      )
    case 'luna':
      // 목도리
      return (
        <G>
          <Rect x={38} y={88} width={44} height={10} rx={5} fill={palette.accessory} />
          <Rect x={72} y={92} width={9} height={22} rx={4} fill={palette.accessory} />
        </G>
      )
    case 'pilot':
      // 조종사 모자
      return (
        <G>
          <Path d="M28 40h64v-4c0-14-14-22-32-22S28 22 28 36z" fill={palette.accessory} />
          <Rect x={24} y={38} width={72} height={8} rx={4} fill={palette.accessory} />
          <Rect x={52} y={22} width={16} height={12} rx={2} fill={palette.clothing} />
        </G>
      )
  }
}

function SleepMarks({ palette }: { palette: Palette }) {
  return (
    <G opacity={0.75}>
      <Path
        d="M92 26h8l-8 9h8"
        stroke={palette.line}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d="M104 14h6l-6 7h6"
        stroke={palette.line}
        strokeWidth={1.6}
        fill="none"
        strokeLinecap="round"
      />
    </G>
  )
}

function TypingDots({ palette }: { palette: Palette }) {
  return (
    <G>
      <Circle cx={84} cy={22} r={3} fill={palette.accessory} opacity={0.9} />
      <Circle cx={94} cy={22} r={3} fill={palette.accessory} opacity={0.6} />
      <Circle cx={104} cy={22} r={3} fill={palette.accessory} opacity={0.35} />
    </G>
  )
}

/**
 * 소리 크기를 부드럽게 따라간다.
 *
 * 실제 소리는 한 프레임마다 크게 오르내려서 그대로 쓰면 입이 떨린다.
 */
function useSmoothedLevel(level: number, active: boolean): number {
  const [value, setValue] = useState(0)
  const target = useRef(level)
  target.current = level

  useEffect(() => {
    if (!active) {
      setValue(0)
      return
    }

    const timer = setInterval(() => {
      setValue(previous => smoothLevel(previous, target.current))
    }, 33)

    return () => clearInterval(timer)
  }, [active])

  return value
}

/** 가끔 눈을 깜빡인다 */
function useBlink(reducedMotion: boolean, expression: Expression): number {
  const [amount, setAmount] = useState(1)
  const startedAt = useRef(Date.now())
  const gap = useRef(nextBlinkGap(Math.random))

  const stillEyes = reducedMotion || expression === 'sleeping'

  useEffect(() => {
    if (stillEyes) {
      setAmount(1)
      return
    }

    const timer = setInterval(() => {
      const elapsed = Date.now() - startedAt.current
      const next = blinkAmount(elapsed, gap.current)
      setAmount(next)

      if (elapsed > gap.current + BLINK_DURATION_MS) {
        startedAt.current = Date.now()
        gap.current = nextBlinkGap(Math.random)
      }
    }, 50)

    return () => clearInterval(timer)
  }, [stillEyes])

  return amount
}

function describe(expression: Expression): string {
  switch (expression) {
    case 'idle':
      return '상대 캐릭터'
    case 'speaking':
      return '상대가 말하는 중'
    case 'listening':
      return '상대가 듣는 중'
    case 'typing':
      return '상대가 입력하는 중'
    case 'disconnected':
      return '연결이 끊겨 있음'
    case 'sleeping':
      return '상대가 앱을 보고 있지 않음'
    case 'videoOff':
      return '상대가 영상을 껐음'
  }
}
