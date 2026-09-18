import { Pressable, View } from 'react-native'
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated'
import type { ConnectionState } from '@/domain/connection/ConnectionState'
import { useTheme } from '../theme/ThemeProvider'
import type { ColorTokens } from '../theme/tokens'
import { Icon } from './Icon'
import { Text } from './Text'

interface ConnectionBarProps {
  state: ConnectionState | null
  pendingCount?: number
  /**
   * 끊김을 알릴 때가 됐나.
   *
   * 짧은 끊김은 알리지 않는다. 비행기에서는 신호가 자주 흔들리는데
   * 그때마다 빨간 띠가 뜨면 사람이 불안해진다. 그동안은 조용히
   * 다시 붙으려 애쓴다.
   */
  announceDisconnect?: boolean
  onPress?: () => void
}

/**
 * 화면 맨 위 가는 띠.
 *
 * 어느 탭에 있든 보인다. 색이 바뀔 때 서서히 변한다 — 깜빡이면
 * 눈이 그리로 자꾸 간다. (docs/07-design-system.md 9장)
 */
export function ConnectionBar({
  state,
  pendingCount = 0,
  announceDisconnect = true,
  onPress,
}: ConnectionBarProps) {
  const theme = useTheme()
  const look = describe(state, pendingCount, announceDisconnect)

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: withTiming(theme.colors[look.color], {
      duration: theme.duration.status,
    }),
  }))

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={look.text}
    >
      <Animated.View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.spacing.sm,
            paddingVertical: 6,
            paddingHorizontal: theme.spacing.md,
          },
          animatedStyle,
        ]}
      >
        <Icon name={look.icon} size={13} color="onStatus" />
        <Text variant="label" style={{ color: theme.colors.onStatus }}>
          {look.text}
        </Text>
        {look.showSpinner && <PulsingDot />}
      </Animated.View>
    </Pressable>
  )
}

interface BarLook {
  readonly color: keyof ColorTokens
  readonly icon: 'wifi' | 'bluetooth' | 'refresh' | 'alert'
  readonly text: string
  readonly showSpinner: boolean
}

function describe(
  state: ConnectionState | null,
  pendingCount: number,
  announceDisconnect: boolean,
): BarLook {
  if (state === null) {
    return { color: 'textMuted', icon: 'refresh', text: '준비 중...', showSpinner: true }
  }

  const waiting = pendingCount > 0 ? ` · 쓴 말 ${pendingCount}개 보관 중` : ''

  // 끊겼지만 아직 알릴 때가 아니다. 조용히 다시 붙는 중이라고만 말한다.
  if (!state.isUsable() && !announceDisconnect) {
    return {
      color: 'textMuted',
      icon: 'refresh',
      text: `다시 잇는 중...${waiting}`,
      showSpinner: true,
    }
  }

  switch (state.phase) {
    case 'connected':
      return state.link === 'ble'
        ? {
            color: 'warning',
            icon: 'bluetooth',
            text: '이어져 있어요 · 지금은 글만',
            showSpinner: false,
          }
        : { color: 'success', icon: 'wifi', text: '이어져 있어요', showSpinner: false }

    case 'switching':
      return {
        color: 'warning',
        icon: 'refresh',
        text: '더 나은 길로 옮기는 중...',
        showSpinner: true,
      }

    case 'searching':
      return {
        color: 'textMuted',
        icon: 'refresh',
        text: `찾는 중...${waiting}`,
        showSpinner: true,
      }

    case 'handshaking':
      return {
        color: 'textMuted',
        icon: 'refresh',
        text: '이어지는 중...',
        showSpinner: true,
      }

    case 'idle':
      return {
        color: 'danger',
        icon: 'alert',
        text: `아직 못 이었어요${waiting}`,
        showSpinner: false,
      }
  }
}

/** 뭔가 진행 중이라는 표시. 빙글빙글 도는 것보다 조용하다 */
function PulsingDot() {
  const theme = useTheme()

  return (
    <View
      style={{
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: theme.colors.onStatus,
        opacity: 0.7,
      }}
    />
  )
}
