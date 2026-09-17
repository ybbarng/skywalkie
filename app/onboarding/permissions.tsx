import { router } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'
import { Card } from '@/presentation/components/Card'
import { Icon } from '@/presentation/components/Icon'
import { StepLayout } from '@/presentation/components/onboarding/StepLayout'
import { Text } from '@/presentation/components/Text'
import { permissionReasons } from '@/presentation/copy/onboarding'
import { useTheme } from '@/presentation/theme/ThemeProvider'

/**
 * 권한은 필요할 때 필요한 것만 묻는다.
 *
 * 여기서는 왜 필요한지만 미리 알려준다. 처음에 한꺼번에 물으면
 * 사람은 이유를 모른 채 거절한다. 거절해도 나머지 기능은 동작한다.
 */
export default function Permissions() {
  const theme = useTheme()
  const [seen, setSeen] = useState(false)

  const items = [
    { icon: 'wifi', title: '주변 기기 찾기', reason: permissionReasons.nearby },
    { icon: 'mic', title: '마이크', reason: permissionReasons.microphone },
    { icon: 'chat', title: '알림', reason: permissionReasons.notification },
  ] as const

  return (
    <StepLayout
      step={5}
      totalSteps={5}
      title="이런 걸 물어볼 거예요"
      description="쓸 때가 되면 하나씩 물어봐요. 지금 허락하지 않아도 돼요."
      primaryLabel="알겠어요"
      onPrimary={() => {
        setSeen(true)
        router.push('/onboarding/audio-mode')
      }}
      primaryDisabled={seen}
    >
      <View style={{ gap: theme.spacing.md }}>
        {items.map(item => (
          <Card key={item.title}>
            <View
              style={{
                flexDirection: 'row',
                gap: theme.spacing.md,
                alignItems: 'flex-start',
              }}
            >
              <Icon name={item.icon} color="me" size={22} />
              <View style={{ flex: 1, gap: theme.spacing.xs }}>
                <Text variant="bodyStrong">{item.title}</Text>
                <Text variant="caption" color="textMuted">
                  {item.reason}
                </Text>
              </View>
            </View>
          </Card>
        ))}
      </View>

      <Text variant="caption" color="textFaint">
        거절해도 나머지는 그대로 돼요. 나중에 설정에서 바꿀 수 있어요.
      </Text>
    </StepLayout>
  )
}
