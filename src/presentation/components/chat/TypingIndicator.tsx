import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useTheme } from '../../theme/ThemeProvider'

/** 상대가 입력 중일 때 뜨는 점 세 개 */
export function TypingIndicator() {
  const theme = useTheme()

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        gap: 5,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.xl,
        borderBottomLeftRadius: theme.radius.sm,
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.md,
        marginTop: theme.spacing.md,
      }}
    >
      {[0, 1, 2].map(index => (
        <Dot key={index} delay={index * 160} />
      ))}
    </View>
  )
}

function Dot({ delay }: { delay: number }) {
  const theme = useTheme()
  const reducedMotion = useReducedMotion()
  const offset = useSharedValue(0)

  useEffect(() => {
    if (reducedMotion) return

    offset.value = withRepeat(
      withSequence(
        withTiming(0, { duration: delay }),
        withTiming(-4, { duration: 300 }),
        withTiming(0, { duration: 300 }),
        withTiming(0, { duration: 400 }),
      ),
      -1,
      false,
    )
  }, [delay, offset, reducedMotion])

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
  }))

  return (
    <Animated.View
      style={[
        {
          width: 7,
          height: 7,
          borderRadius: 3.5,
          backgroundColor: theme.colors.textMuted,
        },
        style,
      ]}
    />
  )
}
