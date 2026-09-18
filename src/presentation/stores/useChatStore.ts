import { create } from 'zustand'
import { ReceiveAsset } from '@/application/assets/ReceiveAsset'
import { SendPhoto } from '@/application/assets/SendPhoto'
import { ConversationSync } from '@/application/messaging/ConversationSync'
import { FlushPendingMessages } from '@/application/messaging/FlushPendingMessages'
import { LoadConversation } from '@/application/messaging/LoadConversation'
import { MarkAsRead } from '@/application/messaging/MarkAsRead'
import { ReceiveMessage } from '@/application/messaging/ReceiveMessage'
import { SendMessage } from '@/application/messaging/SendMessage'
import type {
  AssetStore,
  ImagePicker,
  ImageResizer,
} from '@/application/ports/AssetTransfer'
import type { ConversationRepository } from '@/application/ports/ConversationRepository'
import type { CallSignalPayload, Envelope } from '@/application/ports/Envelope'
import { PROTOCOL_VERSION } from '@/application/ports/Envelope'
import type { MessageTransport } from '@/application/ports/MessageTransport'
import type { DiscoveryProgress } from '@/application/ports/PeerDiscovery'
import { SerialQueue } from '@/application/shared/SerialQueue'
import { ids } from '@/composition/services'
import type { ConnectionState } from '@/domain/connection/ConnectionState'
import type { Conversation } from '@/domain/message/Conversation'
import type { Message } from '@/domain/message/Message'
import {
  nudgeContent,
  type StickerPose,
  stickerContent,
  textContent,
} from '@/domain/message/MessageContent'
import type { CharacterId } from '@/domain/peer/Character'
import type { PeerId } from '@/domain/peer/PeerId'
import { systemClock } from '@/domain/shared/Clock'
import { ANNOUNCE_DISCONNECT_AFTER_MS, HINT_AFTER_MS } from './connectPhase'

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
  /**
   * 사진이 어디까지 왔나. `assetId` 로 찾는다.
   *
   * 0~1 이면 받는 중, 문자열이면 다 받아서 그 자리에 있다.
   */
  assetProgress: Record<string, number>
  assetPaths: Record<string, string>
  /** 사진을 보내는 중인가. 화면이 버튼을 잠글 때 쓴다 */
  sendingPhoto: boolean
  /** 아직 못 보낸 것이 몇 개인가 */
  pendingCount: number
  /** 상대 식별자. 인사하면서 알게 된다 */
  peerId: string | null
  /** 코드가 안 맞는 상대가 붙었다 */
  codeMismatch: boolean
  /** 찾는 중에 무엇을 하고 있나. 화면에 보여준다 */
  discovery: DiscoveryProgress | null
  /** 오래 못 찾았다. 도움말을 보여줄 때가 됐다 */
  searchingTooLong: boolean
  /** 한 번이라도 붙은 적 있나. "찾는 중"과 "다시 잇는 중"을 가른다 */
  everConnected: boolean
  /** 끊긴 지 오래됐나. 짧은 끊김은 화면에 안 알린다 */
  announceDisconnect: boolean
  /** 상대를 찾았나 */
  peerFound: boolean

  start(deps: ChatDeps): Promise<void>
  send(text: string): Promise<void>
  sendTyping(typing: boolean): void
  sendNudge(): Promise<void>
  /** 내 캐릭터가 자세를 취한다. 자세 이름만 나가서 몇십 바이트다 */
  sendSticker(pose: StickerPose): Promise<void>
  /** 앨범에서 고르거나 찍어 보낸다 */
  sendPhoto(from: 'library' | 'camera', caption?: string): Promise<void>
  loadOlder(): Promise<void>
  markVisibleAsRead(): Promise<void>
  stop(): void
}

export interface ChatDeps {
  readonly me: PeerId
  readonly transport: MessageTransport
  readonly repository: ConversationRepository
  /** 사진을 두고 꺼내는 곳 */
  readonly assets: AssetStore
  readonly picker: ImagePicker
  readonly resizer: ImageResizer
  /** 인사할 때 상대에게 알려줄 내 정보 */
  readonly profile: {
    readonly displayName: string
    readonly character: CharacterId
    readonly pairingCode: string
    readonly appVersion: string
  }
  /** 상대를 알게 되면 기억해 둔다 */
  onPeerKnown?(peer: {
    peerId: string
    displayName: string
    character: CharacterId
  }): void
  /**
   * 통화 봉투가 오면 넘긴다.
   *
   * 여기서 통화를 다루지 않는 이유는 **섞이면 안 되기 때문이다.**
   * 통화 쪽이 터져도 글은 그대로 오가야 한다.
   */
  onCallSignal?(payload: CallSignalPayload): Promise<void>
}

export const useChatStore = create<ChatState>((set, get) => {
  const queue = new SerialQueue()
  let deps: ChatDeps | null = null
  let unsubscribes: Array<() => void> = []
  let typingTimer: ReturnType<typeof setTimeout> | null = null
  let receiver: ReceiveAsset | null = null

  /**
   * 사진 조각을 받는 이.
   *
   * 하나만 두고 계속 쓴다. 매번 새로 만들면 **받던 조각을 잊어버려서**
   * 끊겼다 붙을 때마다 처음부터 다시 받는다.
   */
  function assetReceiver(active: ChatDeps | null): ReceiveAsset | null {
    if (active === null) return null
    if (receiver !== null) return receiver

    receiver = new ReceiveAsset(
      {
        assets: active.assets,
        transport: active.transport,
        clock: systemClock,
        ids,
      },
      {
        onProgress: (assetId, ratio) => {
          set({ assetProgress: { ...get().assetProgress, [assetId]: ratio } })
        },
        onComplete: assetId => {
          const { [assetId]: _done, ...rest } = get().assetProgress
          set({
            assetProgress: rest,
            assetPaths: {
              ...get().assetPaths,
              [assetId]: active.assets.pathOf(assetId),
            },
          })
        },
      },
    )
    return receiver
  }
  let lastTypingSentAt = 0
  let searchTimer: ReturnType<typeof setTimeout> | null = null
  let disconnectTimer: ReturnType<typeof setTimeout> | null = null

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

  function syncOf(active: ChatDeps): ConversationSync {
    return new ConversationSync(active.repository, active.transport, systemClock, ids)
  }

  /** 연결되면 인사한다. 이걸 해야 놓친 것을 채울 수 있다 */
  async function greet(): Promise<void> {
    const active = deps
    if (active === null) return
    const conversation = get().conversation
    if (conversation === null) return

    await syncOf(active).greet({
      me: active.me,
      displayName: active.profile.displayName,
      character: active.profile.character,
      pairingCode: active.profile.pairingCode,
      appVersion: active.profile.appVersion,
      conversation,
      peerId: get().peerId ?? undefined,
    })
  }

  async function handle(envelope: Envelope): Promise<void> {
    if (deps === null) return

    // --- 인사와 놓친 것 채우기 ---

    if (envelope.t === 'hello') {
      const conversation = get().conversation
      if (conversation === null) return

      const outcome = await syncOf(deps).onHello({
        me: deps.me,
        displayName: deps.profile.displayName,
        character: deps.profile.character,
        pairingCode: deps.profile.pairingCode,
        appVersion: deps.profile.appVersion,
        conversation,
        hello: envelope.p,
      })

      if (outcome.ok && outcome.value.peer !== null) {
        set({ peerId: outcome.value.peer.peerId, codeMismatch: false })
        deps.onPeerKnown?.(outcome.value.peer)
      }
      if (outcome.ok && !outcome.value.accepted) {
        // 코드가 안 맞는다. 다른 사람이 붙었다는 뜻이다.
        set({ codeMismatch: true })
      }
      return
    }

    if (envelope.t === 'hello_ack') {
      if (!envelope.p.accepted) {
        set({ codeMismatch: true })
        return
      }
      set({ peerId: envelope.p.peerId, codeMismatch: false })
      deps.onPeerKnown?.({
        peerId: envelope.p.peerId,
        displayName: envelope.p.displayName,
        character: envelope.p.character,
      })
      return
    }

    if (envelope.t === 'sync_request') {
      await syncOf(deps).onSyncRequest({ me: deps.me, payload: envelope.p })
      return
    }

    if (envelope.t === 'sync_response') {
      const conversation = get().conversation
      if (conversation === null) return

      const outcome = await syncOf(deps).onSyncResponse({
        payload: envelope.p,
        conversation,
      })
      if (outcome.ok) {
        set({ conversation: outcome.value.conversation })
        if (outcome.value.restored > 0) await refresh()
      }
      return
    }

    if (envelope.t === 'asset_chunk') {
      await assetReceiver(deps)?.onChunk(envelope.p)
      return
    }

    if (envelope.t === 'asset_request') {
      // 상대가 못 받은 조각을 달라고 한다. 그것만 다시 보낸다.
      const photo = deps
      if (photo === null) return
      const sender = new SendPhoto({
        transport: photo.transport,
        repository: photo.repository,
        assets: photo.assets,
        resizer: photo.resizer,
        clock: systemClock,
        ids,
      })
      await sender.sendChunks(envelope.p.assetId, 0, undefined, envelope.p.missing)
      return
    }

    if (envelope.t === 'call_signal') {
      // **통화 쪽으로 넘기고 여기서는 손을 뗀다.**
      // 통화에서 무슨 일이 나든 메시지 쪽이 흔들리면 안 된다.
      try {
        await deps.onCallSignal?.(envelope.p)
      } catch {
        // 통화 쪽이 터졌다. 글은 그대로 오간다.
      }
      return
    }

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

    // 메시지를 받았다는 건 상대를 안다는 뜻이다. 기억해 두어야
    // 다음 인사에서 "네 것을 몇 번까지 받았다"를 제대로 알려준다.
    if (get().peerId === null) set({ peerId: envelope.p.author })

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
    assetProgress: {},
    assetPaths: {},
    sendingPhoto: false,
    pendingCount: 0,
    peerId: null,
    codeMismatch: false,
    discovery: null,
    searchingTooLong: false,
    everConnected: false,
    announceDisconnect: false,
    peerFound: false,

    async start(next) {
      deps = next
      set({ me: next.me, connection: next.transport.currentState() })

      unsubscribes = [
        next.transport.onReceive(envelope => {
          void queue.run(() => handle(envelope))
        }),
        next.transport.onStateChange(state => {
          set({ connection: state })

          if (state.isUsable()) {
            if (disconnectTimer !== null) clearTimeout(disconnectTimer)
            disconnectTimer = null
            set({
              searchingTooLong: false,
              discovery: null,
              everConnected: true,
              announceDisconnect: false,
              peerFound: true,
            })
          } else if (get().everConnected && disconnectTimer === null) {
            // 짧은 끊김은 알리지 않는다. 비행기에서는 신호가 자주
            // 흔들리는데 그때마다 빨간 띠가 뜨면 사람이 불안해진다.
            disconnectTimer = setTimeout(() => {
              if (get().connection?.isUsable() !== true) {
                set({ announceDisconnect: true })
              }
            }, ANNOUNCE_DISCONNECT_AFTER_MS)
          }

          if (!state.isUsable()) return

          // 연결이 돌아왔다. 인사하고 쌓인 것을 내보낸다.
          //
          // 인사가 먼저다. 인사에서 "나는 몇 번까지 받았다"를 주고받아야
          // 끊긴 동안 상대가 보낸 것을 되찾을 수 있다.
          void queue.run(async () => {
            const active = deps
            if (active === null) return

            await greet()

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

      // 찾는 동안 무엇을 하는 중인지 받아 화면에 보여준다.
      // 빙글빙글 도는 표시만 두면 사용자는 앱이 멈춘 줄 안다.
      const watchable = next.transport as {
        onProgress?: (handler: (progress: DiscoveryProgress) => void) => () => void
      }
      if (typeof watchable.onProgress === 'function') {
        unsubscribes.push(
          watchable.onProgress(progress => {
            set({ discovery: progress })
          }),
        )
      }

      // 오래 못 찾으면 코드 입력을 권한다
      if (searchTimer !== null) clearTimeout(searchTimer)
      searchTimer = setTimeout(() => {
        if (get().connection?.isUsable() !== true) set({ searchingTooLong: true })
      }, HINT_AFTER_MS)

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

    /**
     * 입력 중이라고 알린다.
     *
     * 글자마다 보내면 낭비다. 3초에 한 번만 보낸다.
     * 좁은 길(블루투스)에서는 아예 안 보낸다.
     */
    sendTyping(typing: boolean) {
      const active = deps
      if (active === null) return
      if (!active.transport.currentState().isUsable()) return
      if (active.transport.kind !== 'wifi') return

      const now = Date.now()
      if (typing && now - lastTypingSentAt < 3000) return
      lastTypingSentAt = typing ? now : 0

      void active.transport.send({
        v: PROTOCOL_VERSION,
        t: 'typing',
        id: ids.next(),
        seq: 0,
        ts: now,
        p: { typing },
      })
    },

    /** 콕 찌르기. 상대 폰이 짧게 진동한다 */
    async sendNudge() {
      await queue.run(async () => {
        const active = deps
        if (active === null) return
        const conversation = get().conversation
        if (conversation === null) return

        const sender = new SendMessage(
          active.transport,
          active.repository,
          systemClock,
          ids,
        )

        const result = await sender.execute({
          author: active.me,
          content: nudgeContent(),
          conversation,
        })

        if (result.ok) {
          set({ conversation: result.value.conversation })
          await refresh()
        }
      })
    },

    async sendSticker(pose) {
      await queue.run(async () => {
        const active = deps
        if (active === null) return
        const conversation = get().conversation
        if (conversation === null) return

        const content = stickerContent(active.profile.character, pose)
        if (!content.ok) return

        const sender = new SendMessage(
          active.transport,
          active.repository,
          systemClock,
          ids,
        )

        const result = await sender.execute({
          author: active.me,
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

    /**
     * 사진을 보낸다.
     *
     * **줄을 세우지 않는다.** 사진은 오래 걸리는데, 줄을 세우면 그동안
     * 글도 못 보낸다. 대신 한 번에 한 장만 보내게 막는다.
     */
    async sendPhoto(from, caption) {
      const active = deps
      if (active === null || get().sendingPhoto) return

      set({ sendingPhoto: true })

      try {
        const picked =
          from === 'camera'
            ? await active.picker.takePhoto()
            : await active.picker.pickFromLibrary()

        if (!picked.ok || picked.value === null) return

        const conversation = get().conversation
        if (conversation === null) return

        const sender = new SendPhoto({
          transport: active.transport,
          repository: active.repository,
          assets: active.assets,
          resizer: active.resizer,
          clock: systemClock,
          ids,
        })

        const result = await sender.execute({
          author: active.me,
          conversation,
          uri: picked.value.uri,
          ...(caption === undefined ? {} : { caption }),
          onProgress: (sent, total) => {
            set({
              assetProgress: {
                ...get().assetProgress,
                outgoing: total === 0 ? 1 : sent / total,
              },
            })
          },
        })

        if (result.ok) {
          // 내가 보낸 사진은 이미 기기에 있다. 바로 보여준다.
          const { outgoing: _sent, ...rest } = get().assetProgress
          set({
            conversation: result.value.conversation,
            assetProgress: rest,
            assetPaths: {
              ...get().assetPaths,
              [result.value.assetId]: active.assets.pathOf(result.value.assetId),
            },
          })
          await refresh()
        }
      } finally {
        set({ sendingPhoto: false })
      }
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
      if (searchTimer !== null) clearTimeout(searchTimer)
      searchTimer = null
      if (disconnectTimer !== null) clearTimeout(disconnectTimer)
      disconnectTimer = null
      deps = null
      set({ ready: false, messages: [], conversation: null })
    },
  }
})
