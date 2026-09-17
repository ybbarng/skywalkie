import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { type HelpKey, help } from '../copy/help'
import { useTheme } from '../theme/ThemeProvider'
import { Button } from './Button'
import { Icon } from './Icon'
import { Sheet } from './Sheet'
import { Text } from './Text'

interface HelpTipProps {
  topic: HelpKey
  size?: number
}

/**
 * 물음표.
 *
 * 화면의 중요한 요소 옆에 둔다. 누르면 그게 뭐 하는 건지 설명이 뜬다.
 *
 * 이 앱은 서로 말을 나눌 수 없는 두 사람이 각자 화면만 보고
 * 써야 한다. 그래서 이 작은 버튼이 제품의 핵심 장치다.
 * (docs/07-design-system.md 8장)
 */
export function HelpTip({ topic, size = 18 }: HelpTipProps) {
  const theme = useTheme()
  const [open, setOpen] = useState(false)
  const entry = help[topic]

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={`${entry.title} 설명 보기`}
      >
        <Icon name="help" size={size} color="textMuted" />
      </Pressable>

      <Sheet visible={open} onClose={() => setOpen(false)} title={entry.title}>
        <Text color="textMuted" style={{ marginBottom: theme.spacing.xl }}>
          {entry.body}
        </Text>
        <View>
          <Button
            label="알겠어요"
            tone="neutral"
            fullWidth
            onPress={() => setOpen(false)}
          />
        </View>
      </Sheet>
    </>
  )
}
