import { create } from 'zustand'
import { FlushPendingMessages } from '@/application/messaging/FlushPendingMessages'
import { LoadConversation } from '@/application/messaging/LoadConversation'
import { MarkAsRead } from '@/application/messaging/MarkAsRead'
import { ReceiveMessage } from '@/application/messaging/ReceiveMessage'
import { SendMessage } from '@/application/messaging/SendMessage'
import type { ConversationRepository } from '@/application/ports/ConversationRepository'
import type { Envelope } from '@/application/ports/Envelope'
import type { MessageTransport } from '@/application/ports/MessageTransport'
import { SerialQueue } from '@/application/shared/SerialQueue'
import { ids } from '@/composition/services'
import type { ConnectionState } from '@/domain/connection/ConnectionState'
import type { Conversation } from '@/domain/message/Conversation'
import type { Message } from '@/domain/message/Message'
import { textContent } from '@/domain/message/MessageContent'
import type { PeerId } from '@/domain/peer/PeerId'
import { systemClock } from '@/domain/shared/Clock'

/**
 * 대화 화면이 보는 상태.
 *
 * **대화 상태를 건드리는 일은 전부 `SerialQueue` 에 세운다.** 보내기와
 * 받기가 동시에 일어나면 둘 다 같은 옛 값을 읽고 덮어쓴다.
 * 두 기기 통합 테스트가 이 문제를 잡았다. (T09)
 */

interface ChatState {
  ready: boolean
  me: PeerId | null
  conversation: Conversation | null
  messages: Message[]
  hasMore: boolean
  connection: ConnectionState | null
  /** 상대가 입력 중인가 */
  peerTyping: boolean
  /** 아직 못 보낸 것이 몇 개인가 */
  pendingCount: number

  start(deps: ChatDeps): Promise<void>
  send(text: string): Promise<void>
  loadOlder(): Promise<void>
  markVisibleAsRead(): Promise<void>
  stop(): void
}

export interface ChatDeps {
  readonly me: PeerId
  readonly transport: MessageTransport
  readonly repository: ConversationRepository
}

export const useChatStore = create<ChatState>((set, get) => {
  const queue = new SerialQueue()
  let deps: ChatDeps | null = null
  let unsubscribes: Array<() => void> = []
  let typingTimer: ReturnType<typeof setTimeout> | null = null

  /** 화면에 보이는 목록을 저장소에서 다시 읽는다 */
  async function refresh(): Promise<void> {
    if (deps === null) return

    const loader = new LoadConversation(deps.repository)
    const page = await loader.initial(deps.me)
    if (!page.ok) return

    set({
      conversation: page.value.conversation,
      messages: [...page.value.messages],
      hasMore: page.value.hasMore,
    })
  }

  async function handle(envelope: Envelope): Promise<void> {
    if (deps === null) return

    if (envelope.t === 'typing') {
      set({ peerTyping: envelope.p.typing })

      // 5초 동안 새 신호가 없으면 표시를 지운다.
      // 상대가 앱을 닫으면 "입력 중"이 영원히 남는다.
      if (typingTimer !== null) clearTimeout(typingTimer)
      typingTimer = setTimeout(() => set({ peerTyping: false }), 5000)
      return
    }

    if (envelope.t !== 'message') return

    const conversation = get().conversation
    if (conversation === null) return

    const receiver = new ReceiveMessage(deps.repository, deps.transport, systemClock, ids)

    const result = await receiver.execute({ payload: envelope.p, conversation })
    if (result.ok) {
      set({ conversation: result.value.conversation, peerTyping: false })
      await refresh()
    }
  }

  return {
    ready: false,
    me: null,
    conversation: null,
    messages: [],
    hasMore: false,
    connection: null,
    peerTyping: false,
    pendingCount: 0,

    async start(next) {
      deps = next
      set({ me: next.me, connection: next.transport.currentState() })

      unsubscribes = [
        next.transport.onReceive(envelope => {
          void queue.run(() => handle(envelope))
        }),
        next.transport.onStateChange(state => {
          set({ connection: state })
          if (!state.isUsable()) return

          // 연결이 돌아왔다. 쌓인 것을 내보낸다.
          void queue.run(async () => {
            const active = deps
            if (active === null) return

            const flush = new FlushPendingMessages(
              active.repository,
              active.transport,
              systemClock,
              ids,
            )
            await flush.execute()
            await refresh()
          })
        }),
        next.repository.onChange(() => {
          void queue.run(refresh)
        }),
      ]

      await queue.run(refresh)
      set({ ready: true })
    },

    async send(text) {
      const content = textContent(text)
      if (!content.ok) return

      await queue.run(async () => {
        if (deps === null) return
        const conversation = get().conversation
        if (conversation === null) return

        const sender = new SendMessage(deps.transport, deps.repository, systemClock, ids)

        const result = await sender.execute({
          author: deps.me,
          content: content.value,
          conversation,
        })

        if (result.ok) {
          set({
            conversation: result.value.conversation,
            pendingCount: result.value.sentNow
              ? get().pendingCount
              : get().pendingCount + 1,
          })
          await refresh()
        }
      })
    },

    async loadOlder() {
      await queue.run(async () => {
        if (deps === null) return
        const oldest = get().messages[0]
        if (oldest === undefined) return

        const loader = new LoadConversation(deps.repository)
        const older = await loader.older(oldest)
        if (!older.ok) return

        set({
          messages: [...older.value.messages, ...get().messages],
          hasMore: older.value.hasMore,
        })
      })
    },

    async markVisibleAsRead() {
      await queue.run(async () => {
        if (deps === null) return
        const conversation = get().conversation
        if (conversation === null) return

        const marker = new MarkAsRead(deps.repository, deps.transport, systemClock, ids)

        const result = await marker.execute({
          me: deps.me,
          messages: get().messages,
          conversation,
        })

        if (result.ok && result.value.readCount > 0) {
          set({ conversation: result.value.conversation })
          await refresh()
        }
      })
    },

    stop() {
      for (const stop of unsubscribes) stop()
      unsubscribes = []
      if (typingTimer !== null) clearTimeout(typingTimer)
      typingTimer = null
      deps = null
      set({ ready: false, messages: [], conversation: null })
    },
  }
})
