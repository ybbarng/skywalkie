import { router } from 'expo-router'
import { useState } from 'react'
import { TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CODE_LENGTH, formatForDisplay, pairingCode } from '@/domain/peer/PairingCode'
import { Button } from '@/presentation/components/Button'
import { Card } from '@/presentation/components/Card'
import { HelpTip } from '@/presentation/components/HelpTip'
import { Text } from '@/presentation/components/Text'
import { useSetupStore } from '@/presentation/stores/useSetupStore'
import { useTheme } from '@/presentation/theme/ThemeProvider'

/**
 * 코드로 연결하기.
 *
 * 자동으로 찾는 게 전부 실패했을 때 쓴다. 한쪽이 화면을 보여주고
 * 다른 쪽이 입력하면 된다. (docs/04-transport-spec.md 2.3)
 */
export default function PairCode() {
  const theme = useTheme()
  const profile = useSetupStore(s => s.profile)
  const adoptPairingCode = useSetupStore(s => s.adoptPairingCode)

  const [input, setInput] = useState('')
  const parsed = pairingCode(input)
  const mine = profile === null ? null : pairingCode(profile.pairingCode)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ flex: 1, padding: theme.spacing.xl, gap: theme.spacing.xl }}>
        <View style={{ gap: theme.spacing.sm }}>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}
          >
            <Text variant="title">코드로 연결하기</Text>
            <HelpTip topic="pairingCode" />
          </View>
          <Text color="textMuted">
            자동으로 못 찾을 때 써요. 한 사람이 화면을 보여주고 다른 사람이 입력하면
            됩니다.
          </Text>
        </View>

        <Card raised style={{ alignItems: 'center', gap: theme.spacing.sm }}>
          <Text variant="label" color="textMuted">
            내 코드
          </Text>
          <Text variant="display" style={{ color: theme.colors.me, letterSpacing: 6 }}>
            {mine?.ok === true ? formatForDisplay(mine.value) : '------'}
          </Text>
          <Text variant="caption" color="textFaint" align="center">
            상대에게 이 화면을 보여주세요
          </Text>
        </Card>

        <Card style={{ gap: theme.spacing.md }}>
          <Text variant="label" color="textMuted">
            상대 코드 입력
          </Text>
          <TextInput
            value={input}
            onChangeText={text => setInput(text.toUpperCase().slice(0, CODE_LENGTH))}
            placeholder="여섯 자리"
            placeholderTextColor={theme.colors.textFaint}
            autoCapitalize="characters"
            autoCorrect={false}
            style={{
              ...theme.typography.display,
              color: theme.colors.text,
              backgroundColor: theme.colors.bg,
              borderRadius: theme.radius.md,
              borderWidth: 1,
              borderColor: parsed.ok ? theme.colors.success : theme.colors.border,
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: theme.spacing.md,
              textAlign: 'center',
              letterSpacing: 8,
            }}
          />
          {input.length > 0 && !parsed.ok && (
            <Text variant="caption" color="danger">
              {parsed.error.detail}
            </Text>
          )}
        </Card>

        <View style={{ flex: 1 }} />

        <Button
          label="이 코드로 연결하기"
          size="large"
          fullWidth
          disabled={!parsed.ok}
          onPress={() => {
            if (!parsed.ok) return
            void adoptPairingCode(parsed.value).then(() => router.back())
          }}
        />
      </View>
    </SafeAreaView>
  )
}
