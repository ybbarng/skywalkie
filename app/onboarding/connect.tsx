import { router } from 'expo-router'
import { Linking, Platform, View } from 'react-native'
import { homeHotspot } from '@/composition/hotspot'
import { formatForDisplay, pairingCode } from '@/domain/peer/PairingCode'
import { Button } from '@/presentation/components/Button'
import { Card } from '@/presentation/components/Card'
import { HelpTip } from '@/presentation/components/HelpTip'
import { Icon } from '@/presentation/components/Icon'
import { StepLayout } from '@/presentation/components/onboarding/StepLayout'
import { Text } from '@/presentation/components/Text'
import { connectIntro, connectSteps, roleReason } from '@/presentation/copy/onboarding'
import { useSetupStore } from '@/presentation/stores/useSetupStore'
import { useTheme } from '@/presentation/theme/ThemeProvider'

/**
 * **이 앱에서 가장 중요한 화면이다.**
 *
 * 말을 나눌 수 없는 두 사람이 각자 이 화면만 보고 연결에 성공해야 한다.
 * 그래서 역할마다 자기가 할 일만 보여주고, 상대에게 보여줄 코드를
 * 화면에서 가장 크게 띄운다. (docs/07-design-system.md 8장)
 */
export default function Connect() {
  const theme = useTheme()
  const profile = useSetupStore(s => s.profile)
  const finishOnboarding = useSetupStore(s => s.finishOnboarding)
  const role = profile?.role ?? 'host'
  const steps = connectSteps[role]

  return (
    <StepLayout
      step={4}
      totalSteps={4}
      title={role === 'host' ? '내가 이어줄게요' : '상대에게 들어갈게요'}
      description={`${roleReason[role]}.`}
      onPrimary={() => {
        void finishOnboarding().then(() => router.replace('/(tabs)/chat'))
      }}
      primaryLabel="시작하기"
    >
      <Card raised style={{ marginBottom: theme.spacing.xs }}>
        <Text variant="bodyStrong">{connectIntro[role]}</Text>
      </Card>

      <View style={{ gap: theme.spacing.md }}>
        {steps.map((step, index) => (
          <Card key={step.title}>
            <View
              style={{
                flexDirection: 'row',
                gap: theme.spacing.md,
                alignItems: 'flex-start',
              }}
            >
              <StepNumber value={index + 1} />

              <View style={{ flex: 1, gap: theme.spacing.xs }}>
                <Text variant="bodyStrong">{step.title}</Text>
                <Text variant="caption" color="textMuted">
                  {step.detail}
                </Text>

                {step.opensSettings === true && (
                  <View style={{ marginTop: theme.spacing.sm }}>
                    <Button
                      label="설정 열기"
                      tone="neutral"
                      icon={<Icon name="settings" size={16} />}
                      onPress={() => openSettings(role)}
                    />
                  </View>
                )}
              </View>
            </View>
          </Card>
        ))}
      </View>

      <HotspotCard role={role} />

      {profile !== null && <PairingCodeCard code={profile.pairingCode} role={role} />}
    </StepLayout>
  )
}

/**
 * 핫스팟 이름과 비밀번호.
 *
 * **붙는 쪽 화면에도 그대로 뜬다.** 그래야 상대 폰을 넘겨다보지 않아도
 * 혼자 들어갈 수 있다. 길게 누르면 복사되니 비밀번호를 손으로
 * 옮겨 적을 일도 없다.
 */
function HotspotCard({ role }: { role: 'host' | 'guest' }) {
  const theme = useTheme()

  // `.env` 에 안 적어뒀다. 안내를 접고 예전처럼 상대 화면을 보고 들어간다.
  if (homeHotspot === null) return null

  return (
    <Card raised style={{ gap: theme.spacing.sm }}>
      <Text variant="heading">
        {role === 'host' ? '내 핫스팟은 이 이름이어야 해요' : '이 Wi-Fi 를 고르세요'}
      </Text>

      <Field label="이름" value={homeHotspot.ssid} />
      <Field label="비밀번호" value={homeHotspot.password} />

      <Text variant="caption" color="textMuted">
        {role === 'host'
          ? '설정에서 핫스팟 이름이 이것과 다르면 이 이름으로 바꿔주세요. 상대 폰이 이 이름을 찾습니다.'
          : '길게 누르면 복사돼요. 한 번 들어가두면 폰이 기억해서 다음부터는 저절로 들어갑니다.'}
      </Text>
    </Card>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  const theme = useTheme()

  return (
    <View style={{ gap: 2 }}>
      <Text variant="caption" color="textMuted">
        {label}
      </Text>

      <Text
        variant="bodyStrong"
        selectable
        style={{
          color: theme.colors.me,
          backgroundColor: theme.colors.surfaceRaised,
          borderRadius: theme.radius.md,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
        }}
      >
        {value}
      </Text>
    </View>
  )
}

function StepNumber({ value }: { value: number }) {
  const theme = useTheme()

  return (
    <View
      style={{
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: theme.colors.me,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text variant="label" style={{ color: theme.colors.meText }}>
        {value}
      </Text>
    </View>
  )
}

/**
 * 여섯 자리 코드.
 *
 * 화면에서 가장 크게 띄운다. **말을 못 해도 화면을 보여주면 되도록**
 * 한 손으로 들어 보여줄 수 있는 크기로 그린다.
 */
function PairingCodeCard({ code, role }: { code: string; role: 'host' | 'guest' }) {
  const theme = useTheme()
  const parsed = pairingCode(code)
  const display = parsed.ok ? formatForDisplay(parsed.value) : code

  return (
    <Card raised style={{ alignItems: 'center', gap: theme.spacing.sm }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
        }}
      >
        <Text variant="heading">우리 둘만의 코드</Text>
        <HelpTip topic="pairingCode" />
      </View>

      <Text
        variant="display"
        style={{
          color: theme.colors.me,
          letterSpacing: 6,
          fontVariant: ['tabular-nums'],
        }}
      >
        {display}
      </Text>

      <Text variant="caption" color="textMuted" align="center">
        {role === 'host'
          ? '이 숫자를 상대에게 보여주세요. 같아야 연결됩니다.'
          : '상대 화면의 숫자와 같은지 확인하세요.'}
      </Text>
    </Card>
  )
}

/**
 * 설정 화면으로 데려다준다.
 *
 * 앱이 핫스팟을 대신 켜줄 수는 없다. 안드로이드 10부터 막혔다.
 * 데려다주는 데까지가 전부다. (docs/02-tech-decisions.md D10)
 *
 * **여는 쪽은 핫스팟 화면으로 바로 보낸다.** 삼성 폰은 핫스팟이
 * `연결` 아래 묻혀 있어서 Wi-Fi 목록에 떨어뜨리면 못 찾는다.
 */
function openSettings(role: 'host' | 'guest'): void {
  if (Platform.OS === 'ios') {
    void Linking.openURL('App-Prefs:root=WIFI').catch(() => {
      void Linking.openSettings()
    })
    return
  }

  // 못 여는 기기가 있어서 한 단계씩 물러난다
  const targets =
    role === 'host'
      ? ['android.settings.TETHER_SETTINGS', 'android.settings.WIRELESS_SETTINGS']
      : ['android.settings.WIFI_SETTINGS', 'android.settings.WIRELESS_SETTINGS']

  void openFirstAvailable(targets)
}

async function openFirstAvailable(intents: readonly string[]): Promise<void> {
  for (const intent of intents) {
    try {
      await Linking.sendIntent(intent)
      return
    } catch {
      // 다음 것을 해본다
    }
  }

  await Linking.openSettings()
}
