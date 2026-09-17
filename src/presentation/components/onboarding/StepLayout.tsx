import type { ReactNode } from 'react'
import { ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '../../theme/ThemeProvider'
import { Button } from '../Button'
import { Text } from '../Text'

interface StepLayoutProps {
  /** 몇 번째 단계인가. 1부터 */
  step: number
  totalSteps: number
  title: string
  description?: string
  children: ReactNode
  primaryLabel?: string
  onPrimary?: () => void
  primaryDisabled?: boolean
  secondaryLabel?: string
  onSecondary?: () => void
}

/**
 * 첫 실행 안내의 한 단계.
 *
 * 모든 단계가 같은 모양이라 사용자가 "다음이 어디 있는지" 찾지 않아도 된다.
 * 처음 쓰는 사람이 헤매지 않게 하는 데 이게 크다.
 * (docs/07-design-system.md 8장)
 */
export function StepLayout({
  step,
  totalSteps,
  title,
  description,
  children,
  primaryLabel = '다음',
  onPrimary,
  primaryDisabled = false,
  secondaryLabel,
  onSecondary,
}: StepLayoutProps) {
  const theme = useTheme()

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.xl,
            paddingTop: theme.spacing.lg,
            paddingBottom: theme.spacing.xl,
            gap: theme.spacing.lg,
          }}
        >
          <Progress step={step} total={totalSteps} />

          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="title">{title}</Text>
            {description !== undefined && <Text color="textMuted">{description}</Text>}
          </View>

          {children}
        </ScrollView>

        <View
          style={{
            paddingHorizontal: theme.spacing.xl,
            paddingBottom: theme.spacing.lg,
            gap: theme.spacing.sm,
          }}
        >
          {onPrimary !== undefined && (
            <Button
              label={primaryLabel}
              size="large"
              fullWidth
              disabled={primaryDisabled}
              onPress={onPrimary}
            />
          )}
          {secondaryLabel !== undefined && onSecondary !== undefined && (
            <Button label={secondaryLabel} tone="ghost" fullWidth onPress={onSecondary} />
          )}
        </View>
      </View>
    </SafeAreaView>
  )
}

/** 얼마나 남았는지 보여준다. 끝이 안 보이면 사람은 도중에 그만둔다 */
function Progress({ step, total }: { step: number; total: number }) {
  const theme = useTheme()
  const positions = Array.from({ length: total }, (_, index) => index + 1)

  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
      {positions.map(position => (
        <View
          key={position}
          style={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            backgroundColor: position <= step ? theme.colors.me : theme.colors.border,
          }}
        />
      ))}
    </View>
  )
}
