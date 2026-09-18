import { router } from 'expo-router'
import { Pressable, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { Preferences } from '@/composition/services'
import { selectableCharacters } from '@/domain/peer/Character'
import { Character } from '@/presentation/characters/Character'
import { Card } from '@/presentation/components/Card'
import { HelpTip } from '@/presentation/components/HelpTip'
import { Icon } from '@/presentation/components/Icon'
import { Text } from '@/presentation/components/Text'
import { alertModeChoice, audioModeChoice } from '@/presentation/copy/onboarding'
import { useSetupStore } from '@/presentation/stores/useSetupStore'
import { useTheme, useThemePreference } from '@/presentation/theme/ThemeProvider'
import type { ThemePreference } from '@/presentation/theme/tokens'

export default function Settings() {
  const theme = useTheme()

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.lg,
          gap: theme.spacing.lg,
          paddingBottom: theme.spacing['3xl'],
        }}
      >
        <Text variant="title">설정</Text>

        <ConnectionSection />
        <AppearanceSection />
        <AlertSection />
        <AudioSection />
        <ConversationSection />
        <AboutSection />
      </ScrollView>
    </SafeAreaView>
  )
}

function ConnectionSection() {
  return (
    <Section title="연결">
      <Row
        icon="wifi"
        label="연결 상태 자세히"
        onPress={() => router.push('/connection-detail')}
      />
      <Row
        icon="alert"
        label="코드로 연결하기"
        hint="자동으로 못 찾을 때"
        onPress={() => router.push('/pair-code')}
      />
      <Row
        icon="refresh"
        label="첫 실행 안내 다시 보기"
        onPress={() => {
          void useSetupStore
            .getState()
            .restartOnboarding()
            .then(() => router.replace('/onboarding/welcome'))
        }}
      />
    </Section>
  )
}

function AppearanceSection() {
  const theme = useTheme()
  const { preference, setPreference } = useThemePreference()
  const profile = useSetupStore(s => s.profile)
  const chooseCharacter = useSetupStore(s => s.chooseCharacter)

  const modes: Array<[ThemePreference, string]> = [
    ['system', '기기 설정'],
    ['light', '밝게'],
    ['dark', '어둡게'],
  ]

  return (
    <Section title="화면" help="themeMode">
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        {modes.map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() => setPreference(value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: preference === value }}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: theme.spacing.md,
              borderRadius: theme.radius.md,
              borderWidth: preference === value ? 2 : 1,
              borderColor: preference === value ? theme.colors.me : theme.colors.border,
            }}
          >
            <Text variant="label">{label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ marginTop: theme.spacing.lg, gap: theme.spacing.sm }}>
        <Text variant="label" color="textMuted">
          내 캐릭터
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {selectableCharacters().map(id => {
            const active = profile?.character === id
            return (
              <Pressable
                key={id}
                onPress={() => void chooseCharacter(id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={{
                  borderRadius: theme.radius.md,
                  borderWidth: active ? 2 : 1,
                  borderColor: active ? theme.colors.me : theme.colors.border,
                  padding: theme.spacing.xs,
                }}
              >
                <Character id={id} expression="idle" size={48} />
              </Pressable>
            )
          })}
        </View>
      </View>
    </Section>
  )
}

function AudioSection() {
  const theme = useTheme()
  const preferences = useSetupStore(s => s.preferences)
  const chooseAudioMode = useSetupStore(s => s.chooseAudioMode)

  const modes = Object.keys(audioModeChoice) as Array<Preferences['audioMode']>

  return (
    <Section title="소리" help="audioMode">
      <View style={{ gap: theme.spacing.sm }}>
        {modes.map(mode => {
          const choice = audioModeChoice[mode]
          const active = preferences.audioMode === mode

          return (
            <Pressable
              key={mode}
              onPress={() => void chooseAudioMode(mode)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              style={{
                borderRadius: theme.radius.md,
                borderWidth: active ? 2 : 1,
                borderColor: active ? theme.colors.me : theme.colors.border,
                padding: theme.spacing.md,
                gap: 2,
              }}
            >
              <Text variant="bodyStrong">{choice.label}</Text>
              <Text variant="caption" color="textMuted">
                {choice.detail}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </Section>
  )
}

/**
 * 새 말이 왔을 때 어떻게 알릴까.
 *
 * **앱을 안 보고 있을 때만 쓰는 설정이다.** 보고 있으면 화면에 이미
 * 떠 있어서 잠금 화면 알림은 안 띄우고 짧게 떨기만 한다.
 */
function AlertSection() {
  const theme = useTheme()
  const preferences = useSetupStore(s => s.preferences)
  const chooseAlertMode = useSetupStore(s => s.chooseAlertMode)

  const modes = Object.keys(alertModeChoice) as Array<Preferences['alertMode']>

  return (
    <Section title="새 말이 오면">
      <View style={{ gap: theme.spacing.sm }}>
        {modes.map(mode => {
          const choice = alertModeChoice[mode]
          const active = preferences.alertMode === mode

          return (
            <Pressable
              key={mode}
              onPress={() => void chooseAlertMode(mode)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              style={{
                borderRadius: theme.radius.md,
                borderWidth: active ? 2 : 1,
                borderColor: active ? theme.colors.me : theme.colors.border,
                padding: theme.spacing.md,
                gap: 2,
              }}
            >
              <Text variant="bodyStrong">{choice.label}</Text>
              <Text variant="caption" color="textMuted">
                {choice.detail}
              </Text>
            </Pressable>
          )
        })}
      </View>

      <Text variant="caption" color="textMuted" style={{ marginTop: theme.spacing.sm }}>
        연결이 끊겼다는 알림은 이 설정과 상관없이 울려요. 그걸 놓치면 말이 아예 안 갑니다.
      </Text>
    </Section>
  )
}

function ConversationSection() {
  return (
    <Section title="대화">
      <Row
        icon="send"
        label="대화 꺼내두기"
        hint="앱이 사라져도 대화는 남아요"
        onPress={() => router.push('/export')}
      />
      <Row
        icon="refresh"
        label="대화 되돌리기"
        hint="꺼내둔 파일을 다시 넣어요"
        onPress={() => router.push('/export')}
      />
    </Section>
  )
}

function AboutSection() {
  const profile = useSetupStore(s => s.profile)

  return (
    <Section title="이 앱에 대하여">
      <Row icon="chat" label="도움말" onPress={() => router.push('/help')} />
      <Row
        icon="alert"
        label="내 코드"
        hint={profile?.pairingCode ?? '-'}
        onPress={() => router.push('/pair-code')}
      />
    </Section>
  )
}

function Section({
  title,
  help,
  children,
}: {
  title: string
  help?: Parameters<typeof HelpTip>[0]['topic']
  children: React.ReactNode
}) {
  const theme = useTheme()

  return (
    <Card>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: theme.spacing.md,
        }}
      >
        <Text variant="heading">{title}</Text>
        {help !== undefined && <HelpTip topic={help} />}
      </View>
      {children}
    </Card>
  )
}

function Row({
  icon,
  label,
  hint,
  onPress,
  disabled = false,
}: {
  icon: Parameters<typeof Icon>[0]['name']
  label: string
  hint?: string
  onPress: () => void
  disabled?: boolean
}) {
  const theme = useTheme()

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        minHeight: theme.minTouchSize,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <Icon name={icon} size={20} color="textMuted" />
      <Text style={{ flex: 1 }}>{label}</Text>
      {hint !== undefined && (
        <Text variant="caption" color="textFaint">
          {hint}
        </Text>
      )}
      {!disabled && <Icon name="chevronRight" size={16} color="textFaint" />}
    </Pressable>
  )
}
