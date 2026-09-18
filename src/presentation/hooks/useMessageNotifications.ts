import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import { notifier } from '@/composition/services'
import type { Message } from '@/domain/message/Message'
import type { PeerId } from '@/domain/peer/PeerId'
import { notificationBody, worthNotifying } from '../copy/notify'

/**
 * 상대가 말을 걸면 잠금 화면에 띄운다.
 *
 * **앱이 뒤에 있을 때만 띄운다.** 보고 있는 화면에 이미 떠 있는데
 * 또 울리면 시끄럽다.
 *
 * 처음 켤 때 쌓여 있던 것은 안 띄운다. 앱을 여는 순간 예전 대화가
 * 통째로 알림으로 쏟아지면 못 쓴다.
 */

export interface MessageNotificationsInput {
  readonly enabled: boolean
  readonly me: PeerId | null
  readonly peerName: string
  readonly messages: readonly Message[]
}

export function useMessageNotifications(input: MessageNotificationsInput): void {
  /** 이미 알린 것. 같은 메시지를 두 번 띄우지 않는다 */
  const announced = useRef<Set<string>>(new Set())
  const primed = useRef(false)

  useEffect(() => {
    if (!input.enabled) return
    void notifier.prepare()
  }, [input.enabled])

  useEffect(() => {
    if (!input.enabled || input.me === null) return

    // 처음 한 번은 쌓인 것을 전부 "이미 알린 것"으로 친다.
    // 안 그러면 앱을 여는 순간 예전 대화가 알림으로 쏟아진다.
    if (!primed.current) {
      primed.current = true
      for (const message of input.messages) announced.current.add(message.id)
      return
    }

    const active = AppState.currentState === 'active'

    for (const message of input.messages) {
      if (announced.current.has(message.id)) continue
      announced.current.add(message.id)

      // 내가 쓴 것은 안 띄운다
      if (message.isMine(input.me)) continue
      if (!worthNotifying(message.content)) continue
      // 보고 있으면 화면에 이미 떴다
      if (active) continue

      void notifier.show(input.peerName, notificationBody(message.content))
    }
  }, [input.enabled, input.me, input.peerName, input.messages])

  // 앱을 열면 쌓인 알림을 치운다. 이미 다 본 것이다.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active') void notifier.clear()
    })
    return () => subscription.remove()
  }, [])
}
