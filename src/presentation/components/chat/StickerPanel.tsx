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

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          gap: theme.spacing.sm,
        }}
      >
        {stickerPoses.map(pose => (
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
            <Sticker character={character} pose={pose} size={72} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  )
}
