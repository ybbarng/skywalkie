import { Pressable, View } from 'react-native'
import type { DeliveryState } from '@/domain/message/DeliveryState'
import { useTheme } from '../../theme/ThemeProvider'
import { Icon } from '../Icon'
import { Text } from '../Text'

/**
 * 어디까지 갔나.
 *
 * ○  보내는 중
 * ✓  전달됨
 * ✓✓ 읽음
 * !  실패 — 누르면 다시 보낸다
 * ⏸  대기 중 — 연결되면 자동으로 나간다
 */
export function DeliveryMark({
  state,
  onRetry,
}: {
  state: DeliveryState
  onRetry?: () => void
}) {
  const theme = useTheme()

  if (state === 'failed') {
    return (
      <Pressable
        onPress={onRetry}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="다시 보내기"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
      >
        <Icon name="alert" size={13} color="danger" />
        <Text variant="caption" color="danger">
          다시 보내기
        </Text>
      </Pressable>
    )
  }

  if (state === 'pending' || state === 'draft') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <Icon name="refresh" size={12} color="textFaint" />
        <Text variant="caption" color="textFaint">
          연결되면 보낼게요
        </Text>
      </View>
    )
  }

  if (state === 'read') {
    return <Icon name="checkDouble" size={14} color="peer" />
  }

  if (state === 'delivered') {
    return <Icon name="check" size={14} color="textFaint" />
  }

  // 보내는 중
  return (
    <View
      style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: theme.colors.textFaint,
      }}
    />
  )
}
