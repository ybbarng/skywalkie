import { View } from 'react-native'
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg'
import type { StickerPose } from '@/domain/message/MessageContent'
import type { CharacterId } from '@/domain/peer/Character'
import { useTheme } from '../theme/ThemeProvider'
import { paletteFor, stickerColor } from './palettes'

/**
 * 캐릭터 이모티콘.
 *
 * **그림 파일을 나르지 않는다.** "누가 어떤 자세인지"만 오가고 그리는
 * 일은 받는 쪽이 한다. 몇십 바이트라 어떤 길로도 즉시 간다.
 *
 * 얼굴 얼개는 `Character` 와 같은 자리를 쓴다. 그래야 같은 사람으로
 * 보인다. 자세마다 다른 것은 표정과 손, 그리고 주변에 뜨는 것뿐이다.
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

  return (
    <View accessibilityLabel={describePose(pose)}>
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <G rotation={tiltFor(pose)} origin="60, 70">
          {/* 몸 */}
          <Path d="M28 120c0-15 15-25 32-25s32 10 32 25z" fill={palette.clothing} />
          <Rect x={53} y={80} width={14} height={14} fill={palette.skinShade} />

          {/* 얼굴 */}
          <Ellipse cx={60} cy={58} rx={28} ry={30} fill={palette.skin} />

          {/* 머리 */}
          <Path
            d="M32 56c0-18 12-29 28-29s28 11 28 29c-3-8-8-12-13-13-7 4-23 4-30 0-5 1-10 5-13 13z"
            fill={palette.hair}
          />

          <PoseFace pose={pose} palette={palette} tear={tear} />
          <PoseHands pose={pose} palette={palette} />
        </G>

        <PoseExtras pose={pose} palette={palette} heart={heart} />
      </Svg>
    </View>
  )
}

type Palette = ReturnType<typeof paletteFor>

function PoseFace({
  pose,
  palette,
  tear,
}: {
  pose: StickerPose
  palette: Palette
  tear: string
}) {
  // 자세마다 눈과 입이 다르다. 여기가 이모티콘의 대부분이다.
  const closedEyes = pose === 'sleep' || pose === 'laugh' || pose === 'cry'

  return (
    <G>
      {closedEyes ? (
        <G>
          {/* 웃을 때는 위로, 울 때와 잘 때는 아래로 휜다 */}
          <Path
            d={pose === 'laugh' ? 'M44 58q5-5 10 0' : 'M44 56q5 5 10 0'}
            stroke={palette.line}
            strokeWidth={2.4}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d={pose === 'laugh' ? 'M66 58q5-5 10 0' : 'M66 56q5 5 10 0'}
            stroke={palette.line}
            strokeWidth={2.4}
            strokeLinecap="round"
            fill="none"
          />
        </G>
      ) : (
        <G>
          <Ellipse cx={49} cy={57} rx={4} ry={5} fill={palette.line} />
          <Ellipse cx={71} cy={57} rx={4} ry={5} fill={palette.line} />
          <Circle cx={50.5} cy={55} r={1.4} fill={palette.skin} />
          <Circle cx={72.5} cy={55} r={1.4} fill={palette.skin} />
        </G>
      )}

      <PoseMouth pose={pose} palette={palette} />

      {(pose === 'heart' || pose === 'laugh') && (
        <G opacity={0.5}>
          <Ellipse cx={40} cy={66} rx={5} ry={3} fill={palette.blush} />
          <Ellipse cx={80} cy={66} rx={5} ry={3} fill={palette.blush} />
        </G>
      )}

      {/* 눈물 */}
      {pose === 'cry' && (
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
      )}
    </G>
  )
}

function PoseMouth({ pose, palette }: { pose: StickerPose; palette: Palette }) {
  switch (pose) {
    case 'laugh':
      return <Ellipse cx={60} cy={72} rx={9} ry={7} fill={palette.mouth} />
    case 'eat':
      return <Ellipse cx={60} cy={72} rx={7} ry={6} fill={palette.mouth} />
    case 'cry':
      return <Ellipse cx={60} cy={73} rx={6} ry={5} fill={palette.mouth} />
    case 'sleep':
      return <Ellipse cx={60} cy={72} rx={3} ry={4} fill={palette.mouth} opacity={0.8} />
    case 'bored':
      return (
        <Path
          d="M53 73q7 -3 14 0"
          stroke={palette.mouth}
          strokeWidth={2.4}
          strokeLinecap="round"
          fill="none"
        />
      )
    default:
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

function PoseHands({ pose, palette }: { pose: StickerPose; palette: Palette }) {
  switch (pose) {
    case 'wave':
      // 한 손을 머리 옆으로 올린다
      return (
        <G>
          <Circle cx={97} cy={52} r={9} fill={palette.skin} />
          <Path
            d="M92 60 86 78"
            stroke={palette.clothing}
            strokeWidth={9}
            strokeLinecap="round"
          />
        </G>
      )
    case 'thumbsUp':
      return (
        <G>
          <Circle cx={95} cy={78} r={10} fill={palette.skin} />
          <Path
            d="M95 72v-9"
            stroke={palette.skinShade}
            strokeWidth={6}
            strokeLinecap="round"
          />
        </G>
      )
    case 'eat':
      // 젓가락
      return (
        <G>
          <Circle cx={92} cy={82} r={9} fill={palette.skin} />
          <Path
            d="M88 78 74 68M92 79 78 70"
            stroke={palette.accessory}
            strokeWidth={2.4}
            strokeLinecap="round"
          />
        </G>
      )
    case 'bored':
      // 턱을 괸다
      return (
        <G>
          <Circle cx={44} cy={82} r={9} fill={palette.skin} />
          <Path
            d="M40 90 34 104"
            stroke={palette.clothing}
            strokeWidth={9}
            strokeLinecap="round"
          />
        </G>
      )
    default:
      return null
  }
}

/** 캐릭터 주변에 뜨는 것. 기울임 밖에 그려야 같이 안 돈다 */
function PoseExtras({
  pose,
  palette,
  heart,
}: {
  pose: StickerPose
  palette: Palette
  heart: string
}) {
  switch (pose) {
    case 'heart':
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
    case 'sleep':
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
    case 'laugh':
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
    case 'bored':
      return (
        <G opacity={0.6}>
          <Circle cx={97} cy={30} r={2.5} fill={palette.line} />
          <Circle cx={105} cy={30} r={2.5} fill={palette.line} />
          <Circle cx={113} cy={30} r={2.5} fill={palette.line} />
        </G>
      )
    default:
      return null
  }
}

/** 자세마다 몸을 조금씩 기울인다. 굳어 있지 않아 보인다 */
function tiltFor(pose: StickerPose): number {
  switch (pose) {
    case 'wave':
      return -6
    case 'bored':
      return 8
    case 'sleep':
      return 10
    case 'laugh':
      return -4
    default:
      return 0
  }
}

export function describePose(pose: StickerPose): string {
  switch (pose) {
    case 'wave':
      return '손 흔드는 이모티콘'
    case 'sleep':
      return '자는 이모티콘'
    case 'heart':
      return '하트 이모티콘'
    case 'laugh':
      return '웃는 이모티콘'
    case 'cry':
      return '우는 이모티콘'
    case 'thumbsUp':
      return '엄지척 이모티콘'
    case 'eat':
      return '먹는 이모티콘'
    case 'bored':
      return '심심해하는 이모티콘'
  }
}
