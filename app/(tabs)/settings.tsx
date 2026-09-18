import { router } from 'expo-router'
import { Platform, Pressable, ScrollView, Switch, View } from 'react-native'
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
        <VoiceSection />
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
 * **보고 있을 때와 안 보고 있을 때를 따로 정한다.** 서로 다른 일이라
 * 하나로 묶으면 한쪽을 끄려다 다른 쪽까지 꺼진다.
 */
function AlertSection() {
  const theme = useTheme()
  const preferences = useSetupStore(s => s.preferences)
  const chooseAlertMode = useSetupStore(s => s.chooseAlertMode)
  const setTapWhileWatching = useSetupStore(s => s.setTapWhileWatching)

  const modes = Object.keys(alertModeChoice) as Array<Preferences['alertMode']>

  return (
    <Section title="앱을 안 보고 있을 때">
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

      {/*
        보고 있을 때는 잠금 화면 알림을 안 띄운다. 화면에 이미 떠 있다.
        대신 짧게 떠는데, **거슬리면 끌 수 있어야 한다.**
      */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          marginTop: theme.spacing.lg,
          paddingTop: theme.spacing.lg,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong">보고 있을 때도 짧게 떨기</Text>
          <Text variant="caption" color="textMuted">
            설정 화면이나 통화 화면에 있으면 새 말이 온 줄 모를 수 있어요. 거슬리면
            꺼두세요.
          </Text>
        </View>

        <Switch
          value={preferences.tapWhileWatching}
          onValueChange={on => void setTapWhileWatching(on)}
          trackColor={{ false: theme.colors.border, true: theme.colors.me }}
          thumbColor={theme.colors.surface}
          accessibilityLabel="보고 있을 때도 짧게 떨기"
        />
      </View>
    </Section>
  )
}

/**
 * 음성 메시지와 연결 붙들기.
 *
 * **자동 재생이 켜지면 사실상 무전기가 된다.** 상대가 말하면 바로
 * 들리고 나는 마이크를 꾹 눌러 답한다.
 */
function VoiceSection() {
  const theme = useTheme()
  const preferences = useSetupStore(s => s.preferences)
  const setAutoPlayVoice = useSetupStore(s => s.setAutoPlayVoice)
  const setKeepAwakeWhileAway = useSetupStore(s => s.setKeepAwakeWhileAway)

  return (
    <Section title="음성 메시지">
      <Toggle
        label="오면 바로 들려주기"
        hint="대화 화면을 보고 있을 때만 틀어요. 켠 뒤에 온 것부터, 한 번 튼 건 다시 안 틀어요."
        value={preferences.autoPlayVoice}
        onChange={on => void setAutoPlayVoice(on)}
      />

      {/*
        아이폰만 쓰는 설정이다. 안드로이드는 전경 서비스로 늘 붙들고
        있어서 여기서 또 할 일이 없다.
      */}
      {Platform.OS === 'ios' && (
        <View
          style={{
            marginTop: theme.spacing.lg,
            paddingTop: theme.spacing.lg,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
          }}
        >
          <Toggle
            label="뒤로 가도 연결 붙들기"
            hint="아이폰은 앱이 뒤로 가면 잠들어 연결이 끊겨요. 들리지 않는 소리를 흘려 붙들 수 있는데, 배터리를 먹습니다. 연결이 자꾸 끊길 때만 켜세요."
            value={preferences.keepAwakeWhileAway}
            onChange={on => void setKeepAwakeWhileAway(on)}
          />
        </View>
      )}
    </Section>
  )
}

/** 켜고 끄는 한 줄 */
function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint: string
  value: boolean
  onChange(next: boolean): void
}) {
  const theme = useTheme()

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{label}</Text>
        <Text variant="caption" color="textMuted">
          {hint}
        </Text>
      </View>

      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: theme.colors.border, true: theme.colors.me }}
        thumbColor={theme.colors.surface}
        accessibilityLabel={label}
      />
    </View>
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
