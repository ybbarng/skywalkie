import { useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { type StickerPose, stickerPoses } from '@/domain/message/MessageContent'
import type { CharacterId } from '@/domain/peer/Character'
import { Sticker } from '../../characters/Sticker'
import { stickerMeaning } from '../../copy/stickers'
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

  /**
   * 길게 누르고 있는 이모티콘.
   *
   * **그림만으로는 애매한 것이 있다.** 팔짱 낀 건 "안 돼"인지 "추워"인지
   * 헷갈린다. 길게 누르면 무슨 말인지 위에 뜬다. 짧게 누르면 그대로
   * 나가므로 보내는 데 한 걸음이 더 늘지는 않는다.
   */
  const [asking, setAsking] = useState<StickerPose | null>(null)

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
        {asking === null ? (
          <Text variant="caption" color="textMuted">
            누르면 보내져요 · 길게 누르면 뜻이 떠요
          </Text>
        ) : (
          <Text variant="bodyStrong">{stickerMeaning(asking)}</Text>
        )}

        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button">
          <Text variant="caption" color="textMuted">
            닫기
          </Text>
        </Pressable>
      </View>

      {/*
        **두 줄로 놓는다.** 스물아홉이나 되어 한 줄이면 끝까지 가는 데
        한참 밀어야 한다. 두 줄이면 두어 번 밀어 다 본다.
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
                  // 길게 누르면 뜻만 보여주고 보내지 않는다
                  onLongPress={() => setAsking(pose)}
                  onPressOut={() => setAsking(null)}
                  delayLongPress={300}
                  accessibilityRole="button"
                  accessibilityHint="길게 누르면 무슨 말인지 알려줍니다"
                  style={{
                    borderRadius: theme.radius.lg,
                    backgroundColor: theme.colors.bg,
                    padding: theme.spacing.xs,
                    // 밝은 화면에서는 바탕을 바꿔봐야 티가 안 난다.
                    // 테두리로 "지금 이걸 묻고 있다"를 표시한다.
                    borderWidth: 2,
                    borderColor: asking === pose ? theme.colors.me : 'transparent',
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
