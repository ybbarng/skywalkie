import { View } from 'react-native'
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg'
import type { StickerPose } from '@/domain/message/MessageContent'
import type { CharacterId } from '@/domain/peer/Character'
import { describePose } from '../copy/stickers'
import { useTheme } from '../theme/ThemeProvider'
import { paletteFor, stickerColor } from './palettes'
import {
  armsInFront,
  type BrowShape,
  type EyeShape,
  type HandsShape,
  limbsFor,
  lookFor,
  type MouthShape,
  type PoseExtra,
} from './poses'

/**
 * 캐릭터 이모티콘.
 *
 * **그림 파일을 나르지 않는다.** "누가 어떤 자세인지"만 오가고 그리는
 * 일은 받는 쪽이 한다. 몇십 바이트라 어떤 길로도 즉시 간다.
 *
 * 얼굴 얼개는 `Character` 와 같은 자리를 쓴다. 그래야 같은 사람으로
 * 보인다. 자세마다 다른 것은 표정과 손, 그리고 주변에 뜨는 것뿐이다.
 *
 * 무엇을 그릴지 **정하는 일은 `poses.ts` 가** 한다. 여기서는 선만 긋는다.
 * (docs/05-messaging-spec.md · T23)
 */

interface StickerProps {
  character: CharacterId
  pose: StickerPose
  size?: number
}

export function Sticker({ character, pose, size = 120 }: StickerProps) {
  const theme = useTheme()
  const palette = paletteFor(character, theme.mode)
  const tear = stickerColor('tear', theme.mode)
  const heart = stickerColor('heart', theme.mode)
  const look = lookFor(pose)

  return (
    <View accessibilityLabel={describePose(pose)}>
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <G rotation={look.tiltDegrees} origin="60, 70">
          {/* 몸 */}
          <Path d="M28 120c0-15 15-25 32-25s32 10 32 25z" fill={palette.clothing} />
          <Rect x={53} y={80} width={14} height={14} fill={palette.skinShade} />

          {/* 몸 옆으로 뻗는 팔은 얼굴 뒤에 */}
          {!armsInFront(look.hands) && <Arms hands={look.hands} palette={palette} />}

          {/* 얼굴 */}
          <Ellipse cx={60} cy={58} rx={28} ry={30} fill={palette.skin} />

          {/* 머리 */}
          <Path
            d="M32 56c0-18 12-29 28-29s28 11 28 29c-3-8-8-12-13-13-7 4-23 4-30 0-5 1-10 5-13 13z"
            fill={palette.hair}
          />

          <Brows shape={look.brows} palette={palette} />
          <Eyes shape={look.eyes} palette={palette} />
          <Mouth shape={look.mouth} palette={palette} />

          {look.blush && (
            <G opacity={0.5}>
              <Ellipse cx={40} cy={66} rx={5} ry={3} fill={palette.blush} />
              <Ellipse cx={80} cy={66} rx={5} ry={3} fill={palette.blush} />
            </G>
          )}

          {/*
            손과, 가슴을 가로지르는 팔은 얼굴 위에 온다.
            뒤에 그리면 얼굴에 가려 통째로 사라진다.
          */}
          {armsInFront(look.hands) && <Arms hands={look.hands} palette={palette} />}
          <Hands hands={look.hands} palette={palette} />
        </G>

        <Extras extra={look.extra} palette={palette} heart={heart} tear={tear} />
      </Svg>
    </View>
  )
}

type Palette = ReturnType<typeof paletteFor>

/* ── 얼굴 ─────────────────────────────────────────── */

function Eyes({ shape, palette }: { shape: EyeShape; palette: Palette }) {
  // 감은 눈은 선 하나로 그린다. 납작한 타원은 어색해 보인다.
  const shut = (d: string) => (
    <Path
      d={d}
      stroke={palette.line}
      strokeWidth={2.4}
      strokeLinecap="round"
      fill="none"
    />
  )

  switch (shape) {
    case 'closedUp':
      return (
        <G>
          {shut('M44 58q5-5 10 0')}
          {shut('M66 58q5-5 10 0')}
        </G>
      )

    case 'closedDown':
      return (
        <G>
          {shut('M44 56q5 5 10 0')}
          {shut('M66 56q5 5 10 0')}
        </G>
      )

    case 'winkRight':
      return (
        <G>
          <Ellipse cx={49} cy={57} rx={4} ry={5} fill={palette.line} />
          <Circle cx={50.5} cy={55} r={1.4} fill={palette.skin} />
          {shut('M66 58q5-5 10 0')}
        </G>
      )

    case 'squint':
      return (
        <G>
          <Ellipse cx={49} cy={57} rx={4} ry={2.2} fill={palette.line} />
          <Ellipse cx={71} cy={57} rx={4} ry={2.2} fill={palette.line} />
        </G>
      )

    case 'wide':
      return (
        <G>
          <Ellipse cx={49} cy={57} rx={5.5} ry={7} fill={palette.skin} />
          <Ellipse cx={71} cy={57} rx={5.5} ry={7} fill={palette.skin} />
          <Ellipse
            cx={49}
            cy={57}
            rx={5.5}
            ry={7}
            fill="none"
            stroke={palette.line}
            strokeWidth={1.6}
          />
          <Ellipse
            cx={71}
            cy={57}
            rx={5.5}
            ry={7}
            fill="none"
            stroke={palette.line}
            strokeWidth={1.6}
          />
          <Circle cx={49} cy={58} r={3} fill={palette.line} />
          <Circle cx={71} cy={58} r={3} fill={palette.line} />
        </G>
      )

    case 'lookUp':
      // 눈동자를 위로 올린다. 딴 데를 보는 것처럼 보인다.
      return (
        <G>
          <Ellipse cx={49} cy={57} rx={4} ry={5} fill={palette.line} opacity={0.25} />
          <Ellipse cx={71} cy={57} rx={4} ry={5} fill={palette.line} opacity={0.25} />
          <Circle cx={50} cy={54} r={2.8} fill={palette.line} />
          <Circle cx={72} cy={54} r={2.8} fill={palette.line} />
        </G>
      )

    case 'open':
      return (
        <G>
          <Ellipse cx={49} cy={57} rx={4} ry={5} fill={palette.line} />
          <Ellipse cx={71} cy={57} rx={4} ry={5} fill={palette.line} />
          <Circle cx={50.5} cy={55} r={1.4} fill={palette.skin} />
          <Circle cx={72.5} cy={55} r={1.4} fill={palette.skin} />
        </G>
      )
  }
}

function Brows({ shape, palette }: { shape: BrowShape; palette: Palette }) {
  if (shape === 'none') return null

  const stroke = (d: string) => (
    <Path
      d={d}
      stroke={palette.hairShade}
      strokeWidth={2.6}
      strokeLinecap="round"
      fill="none"
    />
  )

  switch (shape) {
    case 'angry':
      // 안쪽이 내려온다
      return (
        <G>
          {stroke('M43 44l11 6')}
          {stroke('M77 44l-11 6')}
        </G>
      )
    case 'sad':
      // 안쪽이 올라간다
      return (
        <G>
          {stroke('M43 50l11-6')}
          {stroke('M77 50l-11-6')}
        </G>
      )
    case 'raised':
      return (
        <G>
          {stroke('M43 43q6-3 11 0')}
          {stroke('M66 43q6-3 11 0')}
        </G>
      )
  }
}

function Mouth({ shape, palette }: { shape: MouthShape; palette: Palette }) {
  switch (shape) {
    case 'grin':
      return (
        <Path
          d="M51 70q9 8 18 0"
          stroke={palette.mouth}
          strokeWidth={2.6}
          strokeLinecap="round"
          fill="none"
        />
      )
    case 'openBig':
      return <Ellipse cx={60} cy={72} rx={9} ry={7} fill={palette.mouth} />
    case 'openSmall':
      return <Ellipse cx={60} cy={72} rx={6.5} ry={5.5} fill={palette.mouth} />
    case 'flat':
      return (
        <Path
          d="M53 72h14"
          stroke={palette.mouth}
          strokeWidth={2.4}
          strokeLinecap="round"
          fill="none"
        />
      )
    case 'frown':
      return (
        <Path
          d="M53 74q7-5 14 0"
          stroke={palette.mouth}
          strokeWidth={2.4}
          strokeLinecap="round"
          fill="none"
        />
      )
    case 'wavy':
      // 덜덜 떠는 입
      return (
        <Path
          d="M52 72q3.5-3 7 0t7 0"
          stroke={palette.mouth}
          strokeWidth={2.4}
          strokeLinecap="round"
          fill="none"
        />
      )
    case 'tiny':
      return (
        <Ellipse cx={60} cy={72} rx={3} ry={3.5} fill={palette.mouth} opacity={0.85} />
      )
    case 'tongue':
      // 입에서 혀가 아래로 나온다
      return (
        <G>
          <Path
            d="M51 70q9 7 18 0"
            stroke={palette.mouth}
            strokeWidth={2.6}
            strokeLinecap="round"
            fill="none"
          />
          <Path d="M53 73h14a7 7 0 0 1-14 0z" fill={palette.blush} />
          <Path
            d="M60 74v5"
            stroke={palette.mouth}
            strokeWidth={1.4}
            strokeLinecap="round"
            opacity={0.5}
          />
        </G>
      )
    case 'smile':
      return (
        <Path
          d="M53 71q7 5 14 0"
          stroke={palette.mouth}
          strokeWidth={2.4}
          strokeLinecap="round"
          fill="none"
        />
      )
  }
}

/* ── 팔과 손 ──────────────────────────────────────── */

/**
 * 어깨에서 손까지. 옷 색으로 그려 소매처럼 보인다.
 *
 * **몸 앞으로 오는 팔에는 윤곽을 두른다.** 팔과 몸이 같은 옷 색이라
 * 겹치는 자리에서 팔이 통째로 사라졌다. 가위표도 두 손 모으기도
 * 그래서 안 보였다.
 */
function Arms({ hands, palette }: { hands: HandsShape; palette: Palette }) {
  const limbs = limbsFor(hands)
  if (limbs.length === 0) return null

  const outlined = armsInFront(hands)

  return (
    <G>
      {outlined &&
        limbs.map(limb => (
          <Path
            key={`edge-${limb.path}`}
            d={limb.path}
            stroke={palette.line}
            strokeWidth={12}
            strokeLinecap="round"
            fill="none"
            opacity={0.35}
          />
        ))}

      {limbs.map(limb => (
        <Path
          key={limb.path}
          d={limb.path}
          stroke={palette.clothing}
          strokeWidth={9}
          strokeLinecap="round"
          fill="none"
        />
      ))}
    </G>
  )
}

function Hands({ hands, palette }: { hands: HandsShape; palette: Palette }) {
  const limbs = limbsFor(hands)
  if (limbs.length === 0) return null

  return (
    <G>
      {/*
        손에는 **늘 테두리를 두른다.**

        살색 손이 살색 얼굴이나 목 위에 오면 테두리가 없을 때 통째로
        묻힌다. 턱을 괴거나 두 손을 모으는 자세가 그래서 안 보였다.
      */}
      {limbs.map(limb => (
        <Circle
          key={limb.path}
          cx={limb.hand.x}
          cy={limb.hand.y}
          r={limb.hand.r}
          fill={palette.skin}
          stroke={palette.skinShade}
          strokeWidth={1.8}
        />
      ))}

      {/*
        엄지.

        주먹 옆으로 비스듬히 세운다. 곧게 위로 세우면 손가락으로
        가리키는 것처럼 보인다.
      */}
      {hands === 'thumbsUp' && (
        <G>
          <Path
            d="M89 73 86 64"
            stroke={palette.skinShade}
            strokeWidth={9}
            strokeLinecap="round"
          />
          <Path
            d="M89 73 86 64"
            stroke={palette.skin}
            strokeWidth={6}
            strokeLinecap="round"
          />
          {/* 접힌 손가락 */}
          <Path
            d="M88 79h10M89 84h8"
            stroke={palette.skinShade}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        </G>
      )}

      {/* 젓가락 */}
      {hands === 'chopsticks' && (
        <Path
          d="M86 78 72 66M90 79 76 68"
          stroke={palette.accessory}
          strokeWidth={2.4}
          strokeLinecap="round"
        />
      )}

      {/* 부채 */}
      {hands === 'fan' && (
        <Path d="M86 72 76 58 96 58z" fill={palette.accessory} opacity={0.9} />
      )}
    </G>
  )
}

/* ── 몸 주위에 뜨는 것 ────────────────────────────── */

/** 기울임 밖에 그려야 같이 안 돈다 */
function Extras({
  extra,
  palette,
  heart,
  tear,
}: {
  extra: PoseExtra
  palette: Palette
  heart: string
  tear: string
}) {
  switch (extra) {
    case 'none':
      return null

    case 'hearts':
      return (
        <G>
          <Path
            d="M96 30c0-5 7-6 8-1 1-5 8-4 8 1 0 6-8 11-8 11s-8-5-8-11z"
            fill={heart}
          />
          <Path
            d="M14 46c0-4 5-4 6-1 1-3 6-3 6 1 0 4-6 8-6 8s-6-4-6-8z"
            fill={heart}
            opacity={0.7}
          />
        </G>
      )

    case 'zzz':
      return (
        <G opacity={0.8}>
          <Path
            d="M92 24h9l-9 10h9"
            stroke={palette.line}
            strokeWidth={2.2}
            fill="none"
            strokeLinecap="round"
          />
          <Path
            d="M105 10h7l-7 8h7"
            stroke={palette.line}
            strokeWidth={1.8}
            fill="none"
            strokeLinecap="round"
          />
        </G>
      )

    case 'laughLines':
      return (
        <G opacity={0.75}>
          <Path
            d="M18 34q4-6 8 0M96 28q4-6 8 0"
            stroke={palette.accessory}
            strokeWidth={2.4}
            fill="none"
            strokeLinecap="round"
          />
        </G>
      )

    case 'dots':
      return (
        <G opacity={0.6}>
          <Circle cx={97} cy={30} r={2.5} fill={palette.line} />
          <Circle cx={105} cy={30} r={2.5} fill={palette.line} />
          <Circle cx={113} cy={30} r={2.5} fill={palette.line} />
        </G>
      )

    case 'steam':
      // 머리 양옆으로 김이 뿜어져 나온다
      return (
        <G opacity={0.8}>
          <Path
            d="M26 30q-6-4-3-11M34 22q-7-2-6-10"
            stroke={palette.accessory}
            strokeWidth={2.6}
            fill="none"
            strokeLinecap="round"
          />
          <Path
            d="M94 30q6-4 3-11M86 22q7-2 6-10"
            stroke={palette.accessory}
            strokeWidth={2.6}
            fill="none"
            strokeLinecap="round"
          />
        </G>
      )

    case 'bang':
      return (
        <G>
          <Path
            d="M104 12v16"
            stroke={palette.accessory}
            strokeWidth={4.5}
            strokeLinecap="round"
          />
          <Circle cx={104} cy={35} r={2.6} fill={palette.accessory} />
        </G>
      )

    case 'sparkle':
      return (
        <G opacity={0.9}>
          <Path
            d="M100 18v12M94 24h12"
            stroke={palette.accessory}
            strokeWidth={2.4}
            strokeLinecap="round"
          />
          <Path
            d="M18 40v8M14 44h8"
            stroke={palette.accessory}
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.7}
          />
        </G>
      )

    case 'thoughtDots':
      // 작은 방울이 커지며 올라간다
      return (
        <G opacity={0.75}>
          <Circle
            cx={92}
            cy={38}
            r={3}
            fill="none"
            stroke={palette.line}
            strokeWidth={1.8}
          />
          <Circle
            cx={100}
            cy={28}
            r={4.5}
            fill="none"
            stroke={palette.line}
            strokeWidth={1.8}
          />
          <Circle
            cx={110}
            cy={16}
            r={6.5}
            fill="none"
            stroke={palette.line}
            strokeWidth={1.8}
          />
        </G>
      )

    case 'snow':
      return (
        <G opacity={0.85}>
          <Path
            d="M18 22v12M13 25l10 6M23 25l-10 6"
            stroke={tear}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <Path
            d="M102 30v9M98.5 32l7 5M105.5 32l-7 5"
            stroke={tear}
            strokeWidth={1.8}
            strokeLinecap="round"
            opacity={0.8}
          />
        </G>
      )

    case 'sweat':
      return (
        <Path
          d="M96 34c0 0-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11z"
          fill={tear}
          opacity={0.85}
        />
      )

    case 'tears':
      return (
        <G>
          <Path
            d="M47 62q-2 8 1 12"
            stroke={tear}
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
          />
          <Path
            d="M73 62q2 8-1 12"
            stroke={tear}
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
          />
        </G>
      )

    case 'growl':
      // 배 옆에서 나는 소리
      return (
        <G opacity={0.7}>
          <Path
            d="M12 100q4-4 8 0t8 0M12 108q4-4 8 0t8 0"
            stroke={palette.accessory}
            strokeWidth={2.2}
            fill="none"
            strokeLinecap="round"
          />
        </G>
      )

    case 'noiseLines':
      // 양옆에서 들이치는 소리
      return (
        <G opacity={0.85}>
          <Path
            d="M16 44l7-7 0 6 7-7M16 58l7-7 0 6 7-7"
            stroke={palette.accessory}
            strokeWidth={2.2}
            fill="none"
            strokeLinecap="round"
          />
          <Path
            d="M104 44l-7-7 0 6-7-7M104 58l-7-7 0 6-7-7"
            stroke={palette.accessory}
            strokeWidth={2.2}
            fill="none"
            strokeLinecap="round"
          />
        </G>
      )

    case 'shiver':
      return (
        <G opacity={0.75}>
          <Path
            d="M14 74h8M12 84h8M14 94h8"
            stroke={palette.line}
            strokeWidth={2.2}
            strokeLinecap="round"
          />
          <Path
            d="M98 74h8M100 84h8M98 94h8"
            stroke={palette.line}
            strokeWidth={2.2}
            strokeLinecap="round"
          />
        </G>
      )

    case 'ache':
      // 결리는 어깨 위에 뜨는 표시
      return (
        <G opacity={0.85}>
          <Path
            d="M36 86l-6-6M36 86l-8 1M36 86l1-8"
            stroke={palette.accessory}
            strokeWidth={2.4}
            strokeLinecap="round"
          />
        </G>
      )

    case 'sigh':
      // 입에서 빠져나가는 숨
      return (
        <Path
          d="M90 80q10-2 13-10"
          stroke={palette.line}
          strokeWidth={2.4}
          fill="none"
          strokeLinecap="round"
          opacity={0.55}
        />
      )

    case 'doorSign':
      // 화장실 문. 손만 들면 인사와 구별이 안 된다
      return (
        <G>
          <Rect
            x={10}
            y={20}
            width={22}
            height={32}
            rx={3}
            fill={palette.accessory}
            opacity={0.9}
          />
          <Circle cx={27} cy={37} r={2} fill={palette.clothing} />
          <Path
            d="M16 27h10"
            stroke={palette.clothing}
            strokeWidth={2.2}
            strokeLinecap="round"
          />
        </G>
      )

    case 'heatDrops':
      // 이마와 목덜미로 흐르는 땀
      return (
        <G opacity={0.85}>
          <Path d="M20 26c0 0-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11z" fill={tear} />
          <Path
            d="M28 46c0 0-4 5-4 8a4 4 0 0 0 8 0c0-3-4-8-4-8z"
            fill={tear}
            opacity={0.75}
          />
        </G>
      )
  }
}
