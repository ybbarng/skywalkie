import { View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Character } from '@/presentation/characters/Character'
import { Card } from '@/presentation/components/Card'
import { Text } from '@/presentation/components/Text'
import { useSetupStore } from '@/presentation/stores/useSetupStore'
import { useTheme } from '@/presentation/theme/ThemeProvider'

/**
 * 통화 화면.
 *
 * T15~T17 에서 채운다. 지금은 자리만 있고, 무엇이 올지 알려준다.
 * 빈 화면을 두면 사용자는 앱이 고장난 줄 안다.
 */
export default function Talk() {
  const theme = useTheme()
  const peer = useSetupStore(s => s.peer)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: theme.spacing.xl,
          gap: theme.spacing.lg,
        }}
      >
        <Character id={peer?.character ?? 'aria'} expression="sleeping" size={160} />

        <Card style={{ gap: theme.spacing.sm }}>
          <Text variant="heading" align="center">
            아직 준비 중이에요
          </Text>
          <Text variant="caption" color="textMuted" align="center">
            음악을 들으면서 목소리로 이야기하는 기능이 여기 들어옵니다.{'\n'}
            지금은 대화 탭에서 글로 이야기할 수 있어요.
          </Text>
        </Card>
      </View>
    </SafeAreaView>
  )
}
