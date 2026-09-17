import Constants from 'expo-constants'
import { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  type CharacterId,
  type Expression,
  expressions,
  selectableCharacters,
} from '@/domain/peer/Character'
import { Character } from '@/presentation/characters/Character'
import { Button } from '@/presentation/components/Button'
import { Card } from '@/presentation/components/Card'
import { HelpTip } from '@/presentation/components/HelpTip'
import { Icon } from '@/presentation/components/Icon'
import { Text } from '@/presentation/components/Text'
import { useTheme, useThemePreference } from '@/presentation/theme/ThemeProvider'
import type { ThemePreference } from '@/presentation/theme/tokens'

/**
 * 토큰과 부품이 제대로 도는지 보는 화면. T12 에서 첫 실행 안내로 바뀐다.
 */
export default function Index() {
  const theme = useTheme()
  const { preference, setPreference } = useThemePreference()
  const [nudged, setNudged] = useState(0)
  const [character, setCharacter] = useState<CharacterId>('aria')
  const [expression, setExpression] = useState<Expression>('speaking')
  const version = Constants.expoConfig?.version ?? '0.0.0'

  const modes: Array<[ThemePreference, string]> = [
    ['system', '기기 설정'],
    ['light', '밝게'],
    ['dark', '어둡게'],
  ]

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.xl, gap: theme.spacing.xl }}
      >
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="display">Skywalkie</Text>
          <Text color="textMuted">비행기에서 둘만의 통신망</Text>
        </View>

        <Card>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: theme.spacing.md,
            }}
          >
            <Text variant="heading">밝기 모드</Text>
            <HelpTip topic="themeMode" />
          </View>

          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            {modes.map(([value, label]) => (
              <View key={value} style={{ flex: 1 }}>
                <Button
                  label={label}
                  tone={preference === value ? 'primary' : 'ghost'}
                  onPress={() => setPreference(value)}
                />
              </View>
            ))}
          </View>
        </Card>

        <Card>
          <Text variant="heading" style={{ marginBottom: theme.spacing.md }}>
            말풍선 색
          </Text>

          <View style={{ gap: theme.spacing.sm }}>
            <View
              style={{
                alignSelf: 'flex-start',
                backgroundColor: theme.colors.peer,
                borderRadius: theme.radius.xl,
                borderBottomLeftRadius: theme.radius.sm,
                paddingHorizontal: theme.spacing.lg,
                paddingVertical: theme.spacing.md,
              }}
            >
              <Text style={{ color: theme.colors.peerText }}>어디쯤이야?</Text>
            </View>

            <View
              style={{
                alignSelf: 'flex-end',
                backgroundColor: theme.colors.me,
                borderRadius: theme.radius.xl,
                borderBottomRightRadius: theme.radius.sm,
                paddingHorizontal: theme.spacing.lg,
                paddingVertical: theme.spacing.md,
              }}
            >
              <Text style={{ color: theme.colors.meText }}>34열 창가</Text>
            </View>
          </View>
        </Card>

        <Card>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: theme.spacing.md,
            }}
          >
            <Text variant="heading">캐릭터</Text>
            <HelpTip topic="character" />
          </View>

          <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
            <Character id={character} expression={expression} level={0.6} size={150} />
            <Text variant="caption" color="textMuted">
              {character} · {expression}
            </Text>
          </View>

          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: theme.spacing.sm,
              marginTop: theme.spacing.md,
            }}
          >
            {selectableCharacters().map(id => (
              <Button
                key={id}
                label={id}
                tone={character === id ? 'primary' : 'ghost'}
                onPress={() => setCharacter(id)}
              />
            ))}
          </View>

          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: theme.spacing.sm,
              marginTop: theme.spacing.sm,
            }}
          >
            {expressions.map(value => (
              <Button
                key={value}
                label={value}
                tone={expression === value ? 'neutral' : 'ghost'}
                onPress={() => setExpression(value)}
              />
            ))}
          </View>
        </Card>

        <Card>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: theme.spacing.md,
            }}
          >
            <Text variant="heading">부품</Text>
            <HelpTip topic="nudge" />
          </View>

          <View
            style={{
              flexDirection: 'row',
              gap: theme.spacing.lg,
              marginBottom: theme.spacing.lg,
            }}
          >
            <Icon name="wifi" color="success" size={24} />
            <Icon name="bluetooth" color="warning" size={24} />
            <Icon name="mic" size={24} />
            <Icon name="checkDouble" color="peer" size={24} />
            <Icon name="plane" color="me" size={24} />
          </View>

          <Button
            label={nudged === 0 ? '콕 찌르기' : `${nudged}번 찔렀어요`}
            tone="neutral"
            fullWidth
            icon={<Icon name="chat" size={18} />}
            onPress={() => setNudged(n => n + 1)}
          />
        </Card>

        <Text variant="caption" color="textFaint" align="center">
          v{version} · T10 캐릭터
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}
