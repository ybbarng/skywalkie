import { router } from 'expo-router'
import { Pressable, View } from 'react-native'
import type { Preferences } from '@/infrastructure/platform/Settings'
import { Card } from '@/presentation/components/Card'
import { HelpTip } from '@/presentation/components/HelpTip'
import { StepLayout } from '@/presentation/components/onboarding/StepLayout'
import { Text } from '@/presentation/components/Text'
import { audioModeChoice } from '@/presentation/copy/onboarding'
import { useSetupStore } from '@/presentation/stores/useSetupStore'
import { useTheme } from '@/presentation/theme/ThemeProvider'

/**
 * 말하기 방식 고르기.
 *
 * 무선 이어폰은 마이크를 켜는 순간 음질이 떨어진다. 이어폰이 정하는
 * 일이라 앱이 어쩔 수 없다. 그래서 세 가지 중에 고르게 한다.
 * (docs/06-voice-video-spec.md 2장)
 */
export default function AudioMode() {
  const theme = useTheme()
  const preferences = useSetupStore(s => s.preferences)
  const chooseAudioMode = useSetupStore(s => s.chooseAudioMode)

  const modes = Object.keys(audioModeChoice) as Array<Preferences['audioMode']>

  return (
    <StepLayout
      step={3}
      totalSteps={4}
      title="음악 들으면서 대화하려면"
      description="이어폰은 마이크를 켜는 순간 음질이 떨어져요. 어떻게 할지 골라주세요."
      onPrimary={() => router.push('/onboarding/connect')}
    >
      <View style={{ gap: theme.spacing.md }}>
        {modes.map(mode => {
          const choice = audioModeChoice[mode]
          const active = preferences.audioMode === mode

          return (
            <Pressable
              key={mode}
              onPress={() => void chooseAudioMode(mode)}
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
                    justifyContent: 'space-between',
                    marginBottom: theme.spacing.xs,
                  }}
                >
                  <Text variant="bodyStrong">{choice.label}</Text>
                  {choice.recommended && (
                    <Text variant="label" style={{ color: theme.colors.me }}>
                      추천
                    </Text>
                  )}
                </View>
                <Text variant="caption" color="textMuted">
                  {choice.detail}
                </Text>
              </Card>
            </Pressable>
          )
        })}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <Text variant="caption" color="textFaint">
          목소리 기능은 준비 중이에요. 나중에 설정에서 바꿀 수 있어요
        </Text>
        <HelpTip topic="audioMode" size={16} />
      </View>
    </StepLayout>
  )
}
