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
  /** 앨범에서 사진을 고른다 */
  onPhoto?(): void
  /** 길게 누르면 카메라를 연다. 지금 찍어 보낼 때 */
  onCamera?(): void
  /** 꾹 누르는 동안 녹음한다 */
  onRecordStart?(): void
  onRecordStop?(): void
  onRecordCancel?(): void
  /** 지금 녹음 중인가 */
  recording?: boolean
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
  onPhoto,
  onCamera,
  onRecordStart,
  onRecordStop,
  onRecordCancel,
  recording = false,
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
      {recording && (
        <Pressable
          onPress={onRecordCancel}
          accessibilityRole="button"
          style={{ paddingHorizontal: theme.spacing.sm }}
        >
          <Text variant="caption" color="danger">
            녹음 중… 손을 떼면 보내져요. 여기를 누르면 버려요.
          </Text>
        </Pressable>
      )}

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
        <SideButton
          icon="photo"
          label="사진"
          hint="길게 누르면 카메라가 열려요"
          onPress={onPhoto}
          onLongPress={onCamera}
        />
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

        {/*
          **쓸 글이 있으면 보내기, 없으면 마이크.**

          자리를 하나만 쓰는 이유는 좁아서다. 글을 쓰다 말고 녹음할
          일은 없으니 둘이 겹쳐도 헷갈리지 않는다.

          녹음은 **꾹 누르는 동안만** 된다. 손을 떼면 바로 나간다.
          눌러서 켜고 다시 눌러 끄는 방식은 켜둔 줄 모르고 있다가
          엉뚱한 소리가 통째로 건너간다.
        */}
        {canSend || onRecordStart === undefined ? (
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
        ) : (
          <Pressable
            onPressIn={onRecordStart}
            onPressOut={onRecordStop}
            accessibilityRole="button"
            accessibilityLabel="음성 메시지"
            accessibilityHint="꾹 누르고 말한 뒤 손을 떼면 보내져요"
            style={{
              width: theme.minTouchSize,
              height: theme.minTouchSize,
              borderRadius: theme.minTouchSize / 2,
              backgroundColor: recording
                ? theme.colors.danger
                : theme.colors.surfaceRaised,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="mic" size={20} color={recording ? 'onStatus' : 'textMuted'} />
          </Pressable>
        )}
      </View>
    </View>
  )
}

function SideButton({
  icon,
  label,
  hint,
  onPress,
  onLongPress,
}: {
  icon: 'alert' | 'chat' | 'heart' | 'photo'
  label: string
  hint?: string
  onPress?: () => void
  onLongPress?: () => void
}) {
  const theme = useTheme()
  if (onPress === undefined) return null

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      {...(hint === undefined ? {} : { accessibilityHint: hint })}
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
