import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, TextInput, View } from 'react-native'
import { type CharacterId, selectableCharacters } from '@/domain/peer/Character'
import { Character } from '@/presentation/characters/Character'
import { Card } from '@/presentation/components/Card'
import { StepLayout } from '@/presentation/components/onboarding/StepLayout'
import { Text } from '@/presentation/components/Text'
import { useSetupStore } from '@/presentation/stores/useSetupStore'
import { useTheme } from '@/presentation/theme/ThemeProvider'

/**
 * 캐릭터와 이름 정하기.
 *
 * **고른 것이 곧바로 화면에 보여야 한다.** 저장소에 다녀오는 동안
 * 아무 반응이 없으면 눌리지 않은 줄 안다. 그래서 화면이 직접 값을 들고,
 * 저장은 다음으로 넘어갈 때 한 번만 한다.
 */
export default function ChooseCharacter() {
  const theme = useTheme()
  const profile = useSetupStore(s => s.profile)
  const ensureProfile = useSetupStore(s => s.ensureProfile)
  const chooseCharacter = useSetupStore(s => s.chooseCharacter)
  const setDisplayName = useSetupStore(s => s.setDisplayName)

  const [character, setCharacter] = useState<CharacterId>('aria')
  const [name, setName] = useState('')

  useEffect(() => {
    void ensureProfile()
  }, [ensureProfile])

  // 전에 정해둔 게 있으면 그걸 보여준다
  useEffect(() => {
    if (profile === null) return
    setCharacter(profile.character)
    if (profile.displayName.length > 0) setName(profile.displayName)
  }, [profile])

  const trimmed = name.trim()
  const ready = trimmed.length > 0

  return (
    <StepLayout
      step={2}
      totalSteps={4}
      title="나를 어떻게 보여줄까요"
      description="여기서 고른 모습과 이름이 상대 화면에 나타나요."
      primaryDisabled={!ready}
      onPrimary={() => {
        void (async () => {
          await chooseCharacter(character)
          await setDisplayName(trimmed)
          router.push('/onboarding/audio-mode')
        })()
      }}
    >
      <View style={{ alignItems: 'center', paddingVertical: theme.spacing.md }}>
        <Character id={character} expression="idle" size={150} />
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {selectableCharacters().map(id => {
          const active = character === id

          return (
            <Pressable
              key={id}
              onPress={() => setCharacter(id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              hitSlop={4}
              style={{
                borderRadius: theme.radius.lg,
                borderWidth: active ? 2 : 1,
                borderColor: active ? theme.colors.me : theme.colors.border,
                backgroundColor: active
                  ? theme.colors.surfaceRaised
                  : theme.colors.surface,
                padding: theme.spacing.sm,
              }}
            >
              <Character id={id} expression="idle" size={64} />
            </Pressable>
          )
        })}
      </View>

      <Card>
        <Text variant="heading" style={{ marginBottom: theme.spacing.sm }}>
          상대에게 보일 이름
        </Text>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="예: 지민"
          placeholderTextColor={theme.colors.textFaint}
          maxLength={20}
          autoCorrect={false}
          style={{
            ...theme.typography.body,
            color: theme.colors.text,
            backgroundColor: theme.colors.bg,
            borderRadius: theme.radius.md,
            borderWidth: 1,
            borderColor: ready ? theme.colors.border : theme.colors.me,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.md,
          }}
        />

        {!ready && (
          <Text
            variant="caption"
            color="textMuted"
            style={{ marginTop: theme.spacing.sm }}
          >
            상대 화면에 이 이름이 떠요. 한 글자라도 적어주세요.
          </Text>
        )}
      </Card>
    </StepLayout>
  )
}
