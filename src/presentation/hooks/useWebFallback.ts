import { useEffect, useRef } from 'react'
import { startWebChat, type WebChatHandle } from '@/composition/services'
import type { Message } from '@/domain/message/Message'
import type { PeerId } from '@/domain/peer/PeerId'

/**
 * 비상용 웹 채팅을 띄운다.
 *
 * **핫스팟을 연 쪽만 띄운다.** 붙는 쪽에서 띄워봐야 아무도 못 들어온다.
 *
 * 아이폰 앱이 7일마다 죽는데, 여행이 그보다 길거나 앱이 어떤 이유로든
 * 안 열리면 여자친구가 사파리로 들어온다. **설치 없이 대화가 이어진다.**
 *
 * 서버가 안 열려도 앱은 그대로 돈다. 덤이기 때문이다.
 * (docs/04-transport-spec.md 5장 · T21)
 */

export interface WebFallbackInput {
  readonly enabled: boolean
  readonly me: PeerId | null
  readonly peerName: string
  readonly messages: readonly Message[]
  onSend(text: string): Promise<void>
}

export function useWebFallback(input: WebFallbackInput): void {
  const handle = useRef<WebChatHandle | null>(null)

  // 최신 값을 서버가 볼 수 있게 담아둔다.
  // 서버를 다시 띄우지 않고도 새 말을 내어줄 수 있다.
  const latest = useRef(input)
  latest.current = input

  useEffect(() => {
    if (!input.enabled) return

    let stopped = false

    void (async () => {
      const started = await startWebChat({
        peerName: () => latest.current.peerName,

        since: at =>
          latest.current.messages
            .filter(message => message.orderedAt().getTime() > at)
            .filter(message => message.content.kind === 'text')
            .map(message => ({
              id: message.id,
              text: message.content.kind === 'text' ? message.content.text : '',
              mine: latest.current.me !== null && message.isMine(latest.current.me),
              at: message.orderedAt().getTime(),
            })),

        onSend: text => latest.current.onSend(text),
      })

      if (stopped) {
        await started?.stop()
        return
      }
      handle.current = started
    })()

    return () => {
      stopped = true
      void handle.current?.stop()
      handle.current = null
    }
  }, [input.enabled])

  // 새 말이 생기면 기다리고 있던 사파리를 깨운다.
  // 안 깨우면 최대 25초 뒤에야 뜬다.
  const count = input.messages.length
  useEffect(() => {
    if (count === 0) return
    handle.current?.notify()
  }, [count])
}
