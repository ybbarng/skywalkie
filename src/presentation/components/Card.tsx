import type { ReactNode } from 'react'
import { StyleSheet, View, type ViewProps } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'

interface CardProps extends ViewProps {
  children: ReactNode
  /** 떠 있는 느낌을 줄지 */
  raised?: boolean
  padded?: boolean
}

export function Card({
  children,
  raised = false,
  padded = true,
  style,
  ...rest
}: CardProps) {
  const theme = useTheme()

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: raised ? theme.colors.surfaceRaised : theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.lg,
          padding: padded ? theme.spacing.lg : 0,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  base: { borderWidth: StyleSheet.hairlineWidth },
})
