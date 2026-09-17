import { router } from 'expo-router'
import { View } from 'react-native'
import { Character } from '@/presentation/characters/Character'
import { StepLayout } from '@/presentation/components/onboarding/StepLayout'
import { Text } from '@/presentation/components/Text'
import { welcome } from '@/presentation/copy/onboarding'
import { useTheme } from '@/presentation/theme/ThemeProvider'

export default function Welcome() {
  const theme = useTheme()

  return (
    <StepLayout
      step={1}
      totalSteps={5}
      title={welcome.title}
      primaryLabel="시작하기"
      onPrimary={() => router.push('/onboarding/role')}
    >
      <View style={{ alignItems: 'center', paddingVertical: theme.spacing.lg }}>
        <Character id="aria" expression="idle" size={180} />
      </View>

      <View style={{ gap: theme.spacing.xs }}>
        {welcome.lines.map(line => (
          <Text key={line} variant="bodyStrong">
            {line}
          </Text>
        ))}
      </View>

      <Text color="textMuted">{welcome.note}</Text>
    </StepLayout>
  )
}
