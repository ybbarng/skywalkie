import Constants from 'expo-constants'
import { router } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { createContainer, currentContainer } from '@/composition/container'
import type { Message } from '@/domain/message/Message'
import type { PeerId } from '@/domain/peer/PeerId'
import { peerId } from '@/domain/peer/PeerId'
import { Character } from '@/presentation/characters/Character'
import { ConnectingView } from '@/presentation/components/ConnectingView'
import { ConnectionBar } from '@/presentation/components/ConnectionBar'
import { CallOverlay } from '@/presentation/components/call/CallOverlay'
import { MessageBubble } from '@/presentation/components/chat/MessageBubble'
import { MessageInput } from '@/presentation/components/chat/MessageInput'
import { TypingIndicator } from '@/presentation/components/chat/TypingIndicator'
import { Icon } from '@/presentation/components/Icon'
import { Text } from '@/presentation/components/Text'
import { useNetworkWatch } from '@/presentation/hooks/useNetworkWatch'
import { useReconnectOnForeground } from '@/presentation/hooks/useReconnectOnForeground'
import { decidePhase, onOurNetwork } from '@/presentation/stores/connectPhase'
import { useCallStore } from '@/presentation/stores/useCallStore'
import { useChatStore } from '@/presentation/stores/useChatStore'
import { useSetupStore } from '@/presentation/stores/useSetupStore'
import { useTheme } from '@/presentation/theme/ThemeProvider'

const APP_VERSION = Constants.expoConfig?.version ?? '0.1.0'

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
  const rememberPeer = useSetupStore(s => s.rememberPeer)
  const codeMismatch = useChatStore(s => s.codeMismatch)
  const stop = useChatStore(s => s.stop)
  const send = useChatStore(s => s.send)
  const loadOlder = useChatStore(s => s.loadOlder)
  const markVisibleAsRead = useChatStore(s => s.markVisibleAsRead)
  const sendTyping = useChatStore(s => s.sendTyping)
  const sendNudgeToPeer = useChatStore(s => s.sendNudge)
  const searchingTooLong = useChatStore(s => s.searchingTooLong)
  const everConnected = useChatStore(s => s.everConnected)
  const announceDisconnect = useChatStore(s => s.announceDisconnect)
  const peerFound = useChatStore(s => s.peerFound)

  const me = useMe(profile?.peerId)
  const listRef = useRef<FlatList<Message>>(null)

  const call = useCallStore()
  const preferences = useSetupStore(s => s.preferences)

  // 이어져 있는 동안은 지켜볼 필요가 없다. 핫스팟이 꺼지면 어차피 끊긴다.
  // 끊겼을 때만 보면서 **왜 끊겼는지**를 알아낸다.
  const connected = connection?.isUsable() ?? false
  const network = useNetworkWatch(!connected)

  useEffect(() => {
    if (profile === null || me === null) return

    let cancelled = false

    void (async () => {
      const container = await createContainer({
        role: profile.role,
        pairingCode: profile.pairingCode,
      })
      if (!container.ok || cancelled) return

      await start({
        me,
        transport: container.value.transport,
        repository: container.value.repository,
        profile: {
          displayName: profile.displayName,
          character: profile.character,
          pairingCode: profile.pairingCode,
          appVersion: APP_VERSION,
        },
        // 상대를 알게 되면 기억해 둔다. 다음에 켤 때 이름과 캐릭터가 바로 뜬다.
        onPeerKnown: peer => {
          void rememberPeer(peer)
        },
        // 통화 봉투는 통화 쪽으로 넘긴다
        onCallSignal: payload => useCallStore.getState().handleSignal(payload),
      })

      // 통화를 쓸 수 있게 붙여둔다. 모듈이 없으면 available 이 false 다.
      useCallStore.getState().attach({
        transport: container.value.transport,
        voice: container.value.voice,
        audio: container.value.audio,
        audioMode: preferences?.audioMode ?? 'push-to-talk-brief',
      })

      // 연결은 실패해도 화면은 뜬다. 쓴 메시지는 쌓였다가 나중에 나간다.
      void container.value.transport.connect()
    })()

    return () => {
      cancelled = true
      useCallStore.getState().detach()
      stop()
    }
  }, [profile, me, start, stop, rememberPeer, preferences?.audioMode])

  // 앱이 앞으로 돌아오면 바로 다시 붙는다.
  // 아이폰은 앱을 닫으면 몇 초 안에 소켓이 끊긴다.
  useReconnectOnForeground(() => {
    const container = currentContainer()
    if (container === null) return

    const transport = container.transport as {
      reconnectNow?: () => Promise<unknown>
    }
    void transport.reconnectNow?.()
  })

  // 아직 안 읽은 상대 메시지가 몇 건인가.
  //
  // **이 수가 바뀔 때마다 읽음으로 친다.** 예전에는 화면을 켤 때
  // 한 번만 했는데, 그러면 보고 있는 동안 새로 온 것이 읽음으로
  // 안 바뀌어 상대 쪽에 ✓✓ 가 영영 안 떴다.
  //
  // 건수를 세는 이유는 `messages` 를 그대로 보면 글자 하나 바뀐
  // 것에도 다시 돌기 때문이다. 다 읽으면 0 이 되어 저절로 멎는다.
  const unread = useUnreadCount(messages, me)
  const appActive = useAppActive()

  useEffect(() => {
    // 앱이 뒤에 있으면 읽은 게 아니다. 알림만 보고 안 열었을 수 있다.
    if (!ready || !appActive || unread === 0) return
    void markVisibleAsRead()
  }, [ready, appActive, unread, markVisibleAsRead])

  const renderItem = useCallback(
    ({ item, index }: { item: Message; index: number }) => {
      if (me === null) return null

      const previous = messages[index - 1]
      const next = messages[index + 1]
      const grouped = previous !== undefined && previous.author === item.author
      const showTime = next === undefined || next.author !== item.author

      // 날이 바뀌면 사이에 날짜를 넣는다. 비행기가 날짜선을 넘거나
      // 밤 비행이면 어제 말과 오늘 말이 붙어 버린다.
      const showDate =
        previous === undefined || !isSameDay(previous.orderedAt(), item.orderedAt())

      return (
        <>
          {showDate && <DateDivider at={item.orderedAt()} />}
          <MessageBubble message={item} me={me} grouped={grouped} showTime={showTime} />
        </>
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
        announceDisconnect={announceDisconnect}
        onPress={() => router.push('/connection-detail')}
      />

      {codeMismatch && <CodeMismatchNotice />}

      <PeerHeader
        peerCharacter={peer?.character ?? 'aria'}
        typing={peerTyping}
        connected={connected}
        name={peer?.displayName ?? '상대'}
        canCall={call.available && connected}
        onCall={() => void call.call('voice')}
        onVideoCall={() => void call.call('video')}
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
          ListEmptyComponent={
            connected ? (
              <EmptyState />
            ) : (
              <ConnectingView
                phase={decidePhase({
                  role: profile.role,
                  connection,
                  onPrivateNetwork: onOurNetwork(profile.role, network),
                  peerFound,
                  everConnected,
                })}
                role={profile.role}
                peerName={peer?.displayName ?? '상대'}
                peerCharacter={peer?.character ?? 'aria'}
                showHint={searchingTooLong}
              />
            )
          }
          ListFooterComponent={peerTyping ? <TypingIndicator /> : null}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />

        <MessageInput
          onSend={text => void send(text)}
          onTyping={typing => sendTyping(typing)}
          onNudge={() => void sendNudgeToPeer()}
          offline={!connected}
        />
      </KeyboardAvoidingView>

      <CallOverlay
        state={call.state}
        peerName={peer?.displayName ?? '상대'}
        peerCharacter={peer?.character ?? 'aria'}
        talking={call.talking}
        locked={call.locked}
        muted={call.muted}
        notice={call.notice}
        onAccept={() => void call.accept()}
        onDecline={() => void call.decline()}
        onHangUp={() => void call.hangUp()}
        onTalkStart={call.startTalking}
        onTalkEnd={call.stopTalking}
        onToggleLock={call.toggleLock}
        onToggleMute={call.toggleMute}
        onRetry={() => void call.call('voice')}
        onDismissNotice={call.dismissNotice}
        onClose={() => void call.hangUp()}
      />
    </SafeAreaView>
  )
}

/** 아직 안 읽은 상대 메시지 수. 다 읽으면 0 이 되어 읽음 처리가 멎는다 */
function useUnreadCount(messages: readonly Message[], me: PeerId | null): number {
  if (me === null) return 0

  let count = 0
  for (const message of messages) {
    if (!message.isMine(me) && message.delivery !== 'read') count += 1
  }
  return count
}

/** 앱이 앞에 있나. 뒤에 있는 동안 읽었다고 치면 안 된다 */
function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active')

  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => {
      setActive(next === 'active')
    })
    return () => subscription.remove()
  }, [])

  return active
}

/**
 * 날짜 구분선.
 *
 * 밤 비행이거나 날짜선을 넘으면 어제 말과 오늘 말이 그냥 붙어 버린다.
 * 나중에 대화를 다시 볼 때 언제 한 말인지 알 수 없다.
 */
function DateDivider({ at }: { at: Date }) {
  const theme = useTheme()

  return (
    <View style={{ alignItems: 'center', marginVertical: theme.spacing.lg }}>
      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.pill,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: 4,
        }}
      >
        <Text variant="caption" color="textMuted">
          {formatDay(at)}
        </Text>
      </View>
    </View>
  )
}

function formatDay(at: Date): string {
  const today = new Date()
  if (isSameDay(at, today)) return '오늘'

  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (isSameDay(at, yesterday)) return '어제'

  const weekday = ['일', '월', '화', '수', '목', '금', '토'][at.getDay()]
  return `${at.getMonth() + 1}월 ${at.getDate()}일 ${weekday}요일`
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** 상대 캐릭터와 이름. 글씨를 안 읽어도 상태를 알 수 있어야 한다 */
function PeerHeader({
  peerCharacter,
  typing,
  connected,
  name,
  canCall,
  onCall,
  onVideoCall,
}: {
  peerCharacter: Parameters<typeof Character>[0]['id']
  typing: boolean
  connected: boolean
  name: string
  canCall: boolean
  onCall: () => void
  onVideoCall: () => void
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
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{name}</Text>
        <Text variant="caption" color="textMuted">
          {!connected ? '연결을 기다리는 중' : typing ? '입력 중...' : '연결됨'}
        </Text>
      </View>

      {/*
        통화 버튼은 **걸 수 있을 때만 보인다.**
        눌러도 안 되는 버튼을 두면 "앱이 고장났나" 싶어진다.
      */}
      {canCall && (
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <Pressable
            onPress={onCall}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="통화 걸기"
          >
            <Icon name="phone" size={22} />
          </Pressable>
          <Pressable
            onPress={onVideoCall}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="영상 통화 걸기"
          >
            <Icon name="video" size={22} />
          </Pressable>
        </View>
      )}
    </View>
  )
}

/** 코드가 안 맞는 상대가 붙었다. 우리 둘이 아니라는 뜻이다 */
function CodeMismatchNotice() {
  const theme = useTheme()

  return (
    <View
      style={{
        backgroundColor: theme.colors.danger,
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.sm,
      }}
    >
      <Text variant="caption" style={{ color: theme.colors.onStatus }}>
        코드가 다른 상대가 붙었어요. 설정 → 코드로 연결하기에서 맞춰주세요.
      </Text>
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
