import { router } from 'expo-router'
import { useCallback, useEffect, useRef } from 'react'
import { FlatList, KeyboardAvoidingView, Platform, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { createContainer } from '@/composition/container'
import type { Message } from '@/domain/message/Message'
import { nudgeContent } from '@/domain/message/MessageContent'
import type { PeerId } from '@/domain/peer/PeerId'
import { peerId } from '@/domain/peer/PeerId'
import { Character } from '@/presentation/characters/Character'
import { ConnectionBar } from '@/presentation/components/ConnectionBar'
import { MessageBubble } from '@/presentation/components/chat/MessageBubble'
import { MessageInput } from '@/presentation/components/chat/MessageInput'
import { TypingIndicator } from '@/presentation/components/chat/TypingIndicator'
import { Text } from '@/presentation/components/Text'
import { useChatStore } from '@/presentation/stores/useChatStore'
import { useSetupStore } from '@/presentation/stores/useSetupStore'
import { useTheme } from '@/presentation/theme/ThemeProvider'

/**
 * 대화 화면.
 *
 * 이 화면이 되면 **글로 대화하는 앱이 완성된다.** 목적의 절반이다.
 */
export default function Chat() {
  const theme = useTheme()
  const profile = useSetupStore(s => s.profile)
  const peer = useSetupStore(s => s.peer)

  const ready = useChatStore(s => s.ready)
  const messages = useChatStore(s => s.messages)
  const connection = useChatStore(s => s.connection)
  const peerTyping = useChatStore(s => s.peerTyping)
  const pendingCount = useChatStore(s => s.pendingCount)
  const start = useChatStore(s => s.start)
  const stop = useChatStore(s => s.stop)
  const send = useChatStore(s => s.send)
  const loadOlder = useChatStore(s => s.loadOlder)
  const markVisibleAsRead = useChatStore(s => s.markVisibleAsRead)

  const me = useMe(profile?.peerId)
  const listRef = useRef<FlatList<Message>>(null)

  useEffect(() => {
    if (profile === null || me === null) return

    let cancelled = false

    void (async () => {
      const container = await createContainer({ role: profile.role })
      if (!container.ok || cancelled) return

      await start({
        me,
        transport: container.value.transport,
        repository: container.value.repository,
      })

      // 연결은 실패해도 화면은 뜬다. 쓴 메시지는 쌓였다가 나중에 나간다.
      void container.value.transport.connect()
    })()

    return () => {
      cancelled = true
      stop()
    }
  }, [profile, me, start, stop])

  // 화면에 보이는 동안 읽음으로 친다
  useEffect(() => {
    if (!ready) return
    void markVisibleAsRead()
  }, [ready, markVisibleAsRead])

  const renderItem = useCallback(
    ({ item, index }: { item: Message; index: number }) => {
      if (me === null) return null

      const previous = messages[index - 1]
      const next = messages[index + 1]
      const grouped = previous !== undefined && previous.author === item.author
      const showTime = next === undefined || next.author !== item.author

      return (
        <MessageBubble message={item} me={me} grouped={grouped} showTime={showTime} />
      )
    },
    [me, messages],
  )

  if (profile === null || me === null) {
    return <Redirecting />
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <ConnectionBar
        state={connection}
        pendingCount={pendingCount}
        onPress={() => router.push('/connection-detail')}
      />

      <PeerHeader
        peerCharacter={peer?.character ?? 'aria'}
        typing={peerTyping}
        connected={connection?.isUsable() ?? false}
        name={peer?.displayName ?? '상대'}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.lg,
            paddingBottom: theme.spacing.lg,
            flexGrow: 1,
            justifyContent: 'flex-end',
          }}
          onEndReachedThreshold={0.2}
          ListHeaderComponent={<LoadMore onPress={() => void loadOlder()} />}
          ListEmptyComponent={<EmptyState />}
          ListFooterComponent={peerTyping ? <TypingIndicator /> : null}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />

        <MessageInput
          onSend={text => void send(text)}
          onNudge={() => void sendNudge()}
          offline={!(connection?.isUsable() ?? false)}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

/** 상대 캐릭터와 이름. 글씨를 안 읽어도 상태를 알 수 있어야 한다 */
function PeerHeader({
  peerCharacter,
  typing,
  connected,
  name,
}: {
  peerCharacter: Parameters<typeof Character>[0]['id']
  typing: boolean
  connected: boolean
  name: string
}) {
  const theme = useTheme()

  const expression = !connected ? 'disconnected' : typing ? 'typing' : 'idle'

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
      }}
    >
      <Character id={peerCharacter} expression={expression} size={40} />
      <View>
        <Text variant="bodyStrong">{name}</Text>
        <Text variant="caption" color="textMuted">
          {!connected ? '연결을 기다리는 중' : typing ? '입력 중...' : '연결됨'}
        </Text>
      </View>
    </View>
  )
}

function EmptyState() {
  const theme = useTheme()

  return (
    <View
      style={{
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing['3xl'],
      }}
    >
      <Text variant="heading" color="textMuted">
        아직 주고받은 말이 없어요
      </Text>
      <Text variant="caption" color="textFaint" align="center">
        연결되지 않았어도 괜찮아요.{'\n'}써두면 연결될 때 전해집니다.
      </Text>
    </View>
  )
}

function LoadMore({ onPress }: { onPress: () => void }) {
  const theme = useTheme()

  return (
    <View style={{ alignItems: 'center', paddingVertical: theme.spacing.md }}>
      <Text variant="caption" color="textFaint" onPress={onPress}>
        위로 올려 옛 메시지 보기
      </Text>
    </View>
  )
}

function Redirecting() {
  const theme = useTheme()

  useEffect(() => {
    router.replace('/onboarding/welcome')
  }, [])

  return <View style={{ flex: 1, backgroundColor: theme.colors.bg }} />
}

/** 저장된 식별자를 도메인 값으로 바꾼다 */
function useMe(raw: string | undefined): PeerId | null {
  if (raw === undefined) return null
  const parsed = peerId(raw)
  return parsed.ok ? parsed.value : null
}

/** T24 에서 실제로 진동을 보낸다 */
async function sendNudge(): Promise<void> {
  const content = nudgeContent()
  void content
}
