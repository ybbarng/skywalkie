import type { ReactNode } from 'react'
import { Pressable, type PressableProps, StyleSheet, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { useTheme } from '../theme/ThemeProvider'
import { Text } from './Text'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

export type ButtonTone = 'primary' | 'neutral' | 'danger' | 'ghost'
export type ButtonSize = 'medium' | 'large'

interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string
  tone?: ButtonTone
  size?: ButtonSize
  /** 글자 왼쪽에 놓을 것 */
  icon?: ReactNode
  fullWidth?: boolean
}

/**
 * 버튼.
 *
 * 누르면 살짝 줄었다 돌아온다. 흔들리는 기내에서 눌렸는지 아닌지
 * 헷갈리지 않게 하는 신호다.
 */
export function Button({
  label,
  tone = 'primary',
  size = 'medium',
  icon,
  fullWidth = false,
  disabled = false,
  ...rest
}: ButtonProps) {
  const theme = useTheme()
  const reducedMotion = useReducedMotion()
  const pressed = useSharedValue(0)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: reducedMotion ? 1 : 1 - pressed.value * (1 - theme.scale.pressed),
      },
    ],
  }))

  const palette = {
    primary: { bg: theme.colors.me, text: theme.colors.meText, border: 'transparent' },
    neutral: {
      bg: theme.colors.surfaceRaised,
      text: theme.colors.text,
      border: theme.colors.border,
    },
    danger: {
      bg: theme.colors.danger,
      text: theme.colors.onStatus,
      border: 'transparent',
    },
    ghost: { bg: 'transparent', text: theme.colors.text, border: theme.colors.border },
  }[tone]

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled === true }}
      disabled={disabled}
      onPressIn={() => {
        pressed.value = withTiming(1, { duration: theme.duration.press })
      }}
      onPressOut={() => {
        pressed.value = withTiming(0, { duration: theme.duration.press })
      }}
      style={[
        styles.base,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderRadius: theme.radius.lg,
          paddingHorizontal: theme.spacing.lg,
          minHeight: size === 'large' ? 56 : theme.minTouchSize,
          gap: theme.spacing.sm,
          opacity: disabled ? 0.45 : 1,
        },
        fullWidth && styles.fullWidth,
        animatedStyle,
      ]}
      {...rest}
    >
      {icon !== undefined && <View>{icon}</View>}
      <Text
        variant={size === 'large' ? 'bodyStrong' : 'body'}
        style={{ color: palette.text }}
      >
        {label}
      </Text>
    </AnimatedPressable>
  )
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  fullWidth: { alignSelf: 'stretch' },
})
