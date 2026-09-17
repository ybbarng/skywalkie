import { router } from 'expo-router'
import { Pressable, TextInput, View } from 'react-native'
import { selectableCharacters } from '@/domain/peer/Character'
import { Character } from '@/presentation/characters/Character'
import { Card } from '@/presentation/components/Card'
import { HelpTip } from '@/presentation/components/HelpTip'
import { StepLayout } from '@/presentation/components/onboarding/StepLayout'
import { Text } from '@/presentation/components/Text'
import { useSetupStore } from '@/presentation/stores/useSetupStore'
import { useTheme } from '@/presentation/theme/ThemeProvider'

export default function ChooseCharacter() {
  const theme = useTheme()
  const profile = useSetupStore(s => s.profile)
  const chooseCharacter = useSetupStore(s => s.chooseCharacter)
  const setDisplayName = useSetupStore(s => s.setDisplayName)

  const selected = profile?.character ?? 'aria'

  return (
    <StepLayout
      step={3}
      totalSteps={5}
      title="내 캐릭터를 골라요"
      description="여기서 고른 캐릭터가 상대 화면에 나타나요."
      onPrimary={() => router.push('/onboarding/connect')}
    >
      <View style={{ alignItems: 'center', paddingVertical: theme.spacing.md }}>
        <Character id={selected} expression="idle" size={150} />
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {selectableCharacters().map(id => {
          const active = selected === id

          return (
            <Pressable
              key={id}
              onPress={() => void chooseCharacter(id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              style={{
                borderRadius: theme.radius.lg,
                borderWidth: active ? 2 : 1,
                borderColor: active ? theme.colors.me : theme.colors.border,
                backgroundColor: theme.colors.surface,
                padding: theme.spacing.sm,
              }}
            >
              <Character id={id} expression="idle" size={64} />
            </Pressable>
          )
        })}
      </View>

      <Card>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: theme.spacing.sm,
          }}
        >
          <Text variant="heading">상대에게 보일 이름</Text>
          <HelpTip topic="character" />
        </View>

        <TextInput
          defaultValue={profile?.displayName ?? ''}
          onChangeText={text => void setDisplayName(text)}
          placeholder="예: 지민"
          placeholderTextColor={theme.colors.textFaint}
          maxLength={20}
          style={{
            ...theme.typography.body,
            color: theme.colors.text,
            backgroundColor: theme.colors.bg,
            borderRadius: theme.radius.md,
            borderWidth: 1,
            borderColor: theme.colors.border,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.md,
          }}
        />
      </Card>
    </StepLayout>
  )
}
