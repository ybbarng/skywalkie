import { useState } from 'react'
import { Pressable, TextInput, View } from 'react-native'
import { MAX_TEXT_LENGTH } from '@/domain/message/MessageContent'
import { useTheme } from '../../theme/ThemeProvider'
import { Icon } from '../Icon'
import { Text } from '../Text'

interface MessageInputProps {
  onSend(text: string): void
  onTyping?(typing: boolean): void
  onNudge?(): void
  onDoodle?(): void
  /** 이모티콘 서랍을 여닫는다 */
  onStickers?(): void
  /** 끊겨 있으면 알려준다. 입력을 막지는 않는다 */
  offline?: boolean
}

/**
 * 메시지 입력칸.
 *
 * **연결이 끊겨도 입력과 보내기를 막지 않는다.** 쌓아뒀다가 나중에 보낸다.
 * 막아버리면 하고 싶은 말을 잊어버린다.
 */
export function MessageInput({
  onSend,
  onTyping,
  onNudge,
  onDoodle,
  onStickers,
  offline = false,
}: MessageInputProps) {
  const theme = useTheme()
  const [text, setText] = useState('')

  const canSend = text.trim().length > 0

  function submit(): void {
    if (!canSend) return
    onSend(text)
    setText('')
    onTyping?.(false)
  }

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        backgroundColor: theme.colors.bg,
        paddingHorizontal: theme.spacing.md,
        paddingTop: theme.spacing.sm,
        paddingBottom: theme.spacing.sm,
        gap: theme.spacing.xs,
      }}
    >
      {offline && (
        <Text
          variant="caption"
          color="warning"
          style={{ paddingHorizontal: theme.spacing.sm }}
        >
          지금은 끊겨 있어요. 써두면 연결될 때 보낼게요.
        </Text>
      )}

      <View
        style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.sm }}
      >
        <SideButton icon="alert" label="콕 찌르기" onPress={onNudge} />
        <SideButton icon="heart" label="이모티콘" onPress={onStickers} />
        <SideButton icon="chat" label="낙서" onPress={onDoodle} />

        <TextInput
          value={text}
          onChangeText={next => {
            setText(next)
            onTyping?.(next.length > 0)
          }}
          placeholder="메시지"
          placeholderTextColor={theme.colors.textFaint}
          multiline
          maxLength={MAX_TEXT_LENGTH}
          onSubmitEditing={submit}
          style={{
            flex: 1,
            ...theme.typography.body,
            color: theme.colors.text,
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: theme.colors.border,
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.md,
            paddingBottom: theme.spacing.md,
            // 다섯 줄까지만 늘어난다
            maxHeight: 120,
          }}
        />

        <Pressable
          onPress={submit}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="보내기"
          style={{
            width: theme.minTouchSize,
            height: theme.minTouchSize,
            borderRadius: theme.minTouchSize / 2,
            backgroundColor: canSend ? theme.colors.me : theme.colors.surfaceRaised,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: canSend ? 1 : 0.5,
          }}
        >
          <Icon name="send" size={20} color={canSend ? 'meText' : 'textFaint'} />
        </Pressable>
      </View>
    </View>
  )
}

function SideButton({
  icon,
  label,
  onPress,
}: {
  icon: 'alert' | 'chat' | 'heart'
  label: string
  onPress?: () => void
}) {
  const theme = useTheme()
  if (onPress === undefined) return null

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        width: theme.minTouchSize,
        height: theme.minTouchSize,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={icon} size={22} color="textMuted" />
    </Pressable>
  )
}
