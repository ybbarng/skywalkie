import { Pressable, ScrollView, View } from 'react-native'
import { type StickerPose, stickerPoses } from '@/domain/message/MessageContent'
import type { CharacterId } from '@/domain/peer/Character'
import { Sticker } from '../../characters/Sticker'
import { useTheme } from '../../theme/ThemeProvider'
import { Text } from '../Text'

/**
 * 이모티콘 고르기.
 *
 * **내 캐릭터가 자세를 취한다.** 남의 그림이 아니라 내가 고른 모습이라
 * 보내는 재미가 있고, 상대는 누가 보냈는지 바로 안다.
 *
 * 한 번 누르면 바로 나간다. 고르고 "보내기"를 또 누르게 하지 않는다.
 * (docs/05-messaging-spec.md · T23)
 */

/** 위아래 두 줄로 나눈다. 홀수면 윗줄이 하나 많다 */
function rowsOf(poses: readonly StickerPose[]): StickerPose[][] {
  const half = Math.ceil(poses.length / 2)
  return [poses.slice(0, half), poses.slice(half)]
}

interface StickerPanelProps {
  character: CharacterId
  onPick: (pose: StickerPose) => void
  onClose: () => void
}

export function StickerPanel({ character, onPick, onClose }: StickerPanelProps) {
  const theme = useTheme()

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        paddingVertical: theme.spacing.md,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: theme.spacing.lg,
          marginBottom: theme.spacing.sm,
        }}
      >
        <Text variant="caption" color="textMuted">
          누르면 바로 보내져요
        </Text>
        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button">
          <Text variant="caption" color="textMuted">
            닫기
          </Text>
        </Pressable>
      </View>

      {/*
        **두 줄로 놓는다.** 열여섯이나 되어 한 줄이면 끝까지 가는 데
        한참 밀어야 한다. 두 줄이면 한 번 밀어 다 본다.
      */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: theme.spacing.lg }}
      >
        <View style={{ gap: theme.spacing.sm }}>
          {rowsOf(stickerPoses).map(row => (
            <View
              key={row.join()}
              style={{ flexDirection: 'row', gap: theme.spacing.sm }}
            >
              {row.map(pose => (
                <Pressable
                  key={pose}
                  onPress={() => onPick(pose)}
                  accessibilityRole="button"
                  style={{
                    borderRadius: theme.radius.lg,
                    backgroundColor: theme.colors.bg,
                    padding: theme.spacing.xs,
                  }}
                >
                  <Sticker character={character} pose={pose} size={64} />
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}
