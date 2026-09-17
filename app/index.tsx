import { Redirect } from 'expo-router'
import { useEffect } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { useSetupStore } from '@/presentation/stores/useSetupStore'
import { useTheme } from '@/presentation/theme/ThemeProvider'

/**
 * 앱을 열면 여기로 온다.
 *
 * 처음이면 안내로, 이미 설정했으면 대화 화면으로 보낸다.
 */
export default function Index() {
  const theme = useTheme()
  const loading = useSetupStore(s => s.loading)
  const preferences = useSetupStore(s => s.preferences)
  const load = useSetupStore(s => s.load)

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.bg,
        }}
      >
        <ActivityIndicator color={theme.colors.me} />
      </View>
    )
  }

  return preferences.onboardingDone ? (
    <Redirect href="/(tabs)/chat" />
  ) : (
    <Redirect href="/onboarding/welcome" />
  )
}
