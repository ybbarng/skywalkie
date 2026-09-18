import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { Stroke } from '@/domain/message/MessageContent'
import { Button } from '@/presentation/components/Button'
import { DoodleCanvas } from '@/presentation/components/doodle/DoodleCanvas'
import { colorOf, doodleColors } from '@/presentation/components/doodle/DoodleRenderer'
import { Text } from '@/presentation/components/Text'
import { useChatStore } from '@/presentation/stores/useChatStore'
import { useTheme } from '@/presentation/theme/ThemeProvider'

/**
 * 낙서 그리기.
 *
 * 그림 파일이 아니라 **선의 좌표**로 보낸다. 작고 선명하다.
 * (docs/05-messaging-spec.md 2장 · T24)
 */

const PEN_WIDTHS = [2, 4, 8] as const

export default function DoodleScreen() {
  const theme = useTheme()
  const sendDoodle = useChatStore(s => s.sendDoodle)

  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [color, setColor] = useState<string>('me')
  const [penWidth, setPenWidth] = useState<number>(4)

  const empty = strokes.length === 0

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ flex: 1, padding: theme.spacing.lg, gap: theme.spacing.md }}>
        <Text variant="heading">낙서</Text>

        <DoodleCanvas
          color={color}
          width={penWidth}
          strokes={strokes}
          onChange={setStrokes}
        />

        {/* 색 고르기 */}
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          {doodleColors.map(token => (
            <Pressable
              key={token}
              onPress={() => setColor(token)}
              accessibilityRole="radio"
              accessibilityState={{ selected: color === token }}
              accessibilityLabel={`${token} 색`}
              hitSlop={6}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: colorOf(token, theme.colors),
                borderWidth: color === token ? 3 : 0,
                borderColor: theme.colors.text,
              }}
            />
          ))}
        </View>

        {/* 굵기 고르기 */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
          }}
        >
          {PEN_WIDTHS.map(value => (
            <Pressable
              key={value}
              onPress={() => setPenWidth(value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: penWidth === value }}
              accessibilityLabel={`굵기 ${value}`}
              hitSlop={8}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor:
                  penWidth === value ? theme.colors.surfaceRaised : 'transparent',
              }}
            >
              <View
                style={{
                  width: value * 3,
                  height: value * 3,
                  borderRadius: value * 1.5,
                  backgroundColor: theme.colors.text,
                }}
              />
            </Pressable>
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <Button
            label="한 획 지우기"
            tone="neutral"
            onPress={() => setStrokes(now => now.slice(0, -1))}
            disabled={empty}
          />
          <Button
            label="다 지우기"
            tone="neutral"
            onPress={() => setStrokes([])}
            disabled={empty}
          />
        </View>

        <Button
          label="보내기"
          disabled={empty}
          onPress={() => {
            void sendDoodle(strokes)
            router.back()
          }}
        />

        <Button label="그만두기" tone="neutral" onPress={() => router.back()} />
      </View>
    </SafeAreaView>
  )
}
