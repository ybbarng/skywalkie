import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { videoView } from '@/composition/services'
import type { CharacterId } from '@/domain/peer/Character'
import { Character } from '../../characters/Character'
import { useTheme } from '../../theme/ThemeProvider'
import { Icon } from '../Icon'
import { Text } from '../Text'

/**
 * 영상 통화 화면.
 *
 * 상대 얼굴이 크게, 내 얼굴이 구석에 작게 뜬다. 내 얼굴을 누르면
 * 자리를 바꾼다.
 *
 * ## 영상을 못 그려도 소리는 이어진다
 *
 * `RTCView` 는 통화 모듈이 주는 것이라 없을 수 있다. 그때는 캐릭터를
 * 대신 띄운다. **화면이 검은 것보다 낫고, 무엇보다 앱이 죽지 않는다.**
 *
 * 상대가 영상을 끈 자리에도 같은 캐릭터가 뜬다. 그러면 "끊긴 건가"
 * 싶지 않다.
 *
 * (docs/06-voice-video-spec.md 5장 · T18)
 */

interface VideoStageProps {
  localUrl: string | null
  remoteUrl: string | null
  peerCharacter: CharacterId
  myCharacter: CharacterId
  /** 상대가 영상을 끄고 있나 */
  peerVideoOff: boolean
}

export function VideoStage({
  localUrl,
  remoteUrl,
  peerCharacter,
  myCharacter,
  peerVideoOff,
}: VideoStageProps) {
  const theme = useTheme()
  const [swapped, setSwapped] = useState(false)

  const big = swapped ? localUrl : remoteUrl
  const small = swapped ? remoteUrl : localUrl
  const bigCharacter = swapped ? myCharacter : peerCharacter
  const smallCharacter = swapped ? peerCharacter : myCharacter

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <Surface
        url={peerVideoOff && !swapped ? null : big}
        character={bigCharacter}
        size={180}
        fill
      />

      <Pressable
        onPress={() => setSwapped(now => !now)}
        accessibilityRole="button"
        accessibilityLabel="큰 화면과 바꾸기"
        style={{
          position: 'absolute',
          right: theme.spacing.lg,
          top: theme.spacing.lg,
          width: 100,
          height: 140,
          borderRadius: theme.radius.lg,
          overflow: 'hidden',
          borderWidth: 2,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
        }}
      >
        <Surface url={small} character={smallCharacter} size={64} fill />
      </Pressable>
    </View>
  )
}

/**
 * 영상 한 칸.
 *
 * 그릴 것이 없으면 캐릭터를 띄운다. 검은 네모는 고장 난 것처럼 보인다.
 */
function Surface({
  url,
  character,
  size,
  fill,
}: {
  url: string | null
  character: CharacterId
  size: number
  fill?: boolean
}) {
  const theme = useTheme()
  // biome-ignore lint/suspicious/noExplicitAny: 통화 모듈이 주는 것이라 타입을 우리가 정하지 않는다
  const RTCView = videoView() as any

  if (url !== null && RTCView !== undefined) {
    return (
      <RTCView
        streamURL={url}
        objectFit="cover"
        style={fill === true ? { flex: 1 } : { width: '100%', height: '100%' }}
        mirror
      />
    )
  }

  return (
    <View
      style={{
        flex: fill === true ? 1 : undefined,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.sm,
        backgroundColor: theme.colors.surface,
      }}
    >
      <Character id={character} expression="videoOff" size={size} />
      {fill === true && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="videoOff" size={16} color="textMuted" />
          <Text variant="caption" color="textMuted">
            영상이 꺼져 있어요
          </Text>
        </View>
      )}
    </View>
  )
}
