import { router } from 'expo-router'
import { useEffect } from 'react'
import { Platform, Pressable, View } from 'react-native'
import { Card } from '@/presentation/components/Card'
import { Icon } from '@/presentation/components/Icon'
import { StepLayout } from '@/presentation/components/onboarding/StepLayout'
import { Text } from '@/presentation/components/Text'
import { roleChoice } from '@/presentation/copy/onboarding'
import { useSetupStore } from '@/presentation/stores/useSetupStore'
import { useTheme } from '@/presentation/theme/ThemeProvider'

export default function Role() {
  const theme = useTheme()
  const profile = useSetupStore(s => s.profile)
  const chooseRole = useSetupStore(s => s.chooseRole)

  // 기기 종류로 미리 골라둔다. 아이폰은 핫스팟이 잘 안 되므로 붙는 쪽이다.
  useEffect(() => {
    if (profile === null) {
      void chooseRole(Platform.OS === 'ios' ? 'guest' : 'host')
    }
  }, [profile, chooseRole])

  const selected = profile?.role ?? 'host'

  return (
    <StepLayout
      step={2}
      totalSteps={5}
      title="내 폰은 어느 쪽인가요?"
      description="둘 중 한 명이 Wi-Fi 를 열어줘야 해요. 기기에 맞게 골라두었어요."
      onPrimary={() => router.push('/onboarding/character')}
    >
      <View style={{ gap: theme.spacing.md }}>
        {(['host', 'guest'] as const).map(role => {
          const choice = roleChoice[role]
          const active = selected === role

          return (
            <Pressable
              key={role}
              onPress={() => void chooseRole(role)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
            >
              <Card
                raised={active}
                style={{
                  borderColor: active ? theme.colors.me : theme.colors.border,
                  borderWidth: active ? 2 : 1,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.spacing.sm,
                    marginBottom: theme.spacing.sm,
                  }}
                >
                  <Icon
                    name={role === 'host' ? 'wifi' : 'chevronRight'}
                    color={active ? 'me' : 'textMuted'}
                  />
                  <Text variant="bodyStrong">{choice.label}</Text>
                </View>
                <Text color="textMuted">{choice.detail}</Text>
                <Text
                  variant="caption"
                  color="textFaint"
                  style={{ marginTop: theme.spacing.xs }}
                >
                  {choice.hint}
                </Text>
              </Card>
            </Pressable>
          )
        })}
      </View>
    </StepLayout>
  )
}
