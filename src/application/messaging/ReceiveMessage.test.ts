import { FakeClock } from '@test/fakes/FakeClock'
import { FakeConversationRepository } from '@test/fakes/FakeConversationRepository'
import { FakeIdGenerator } from '@test/fakes/FakeIdGenerator'
import { FakeMessageTransport } from '@test/fakes/FakeMessageTransport'
import { HER, ME, makeUlid } from '@test/support/factories'
import { beforeEach, describe, expect, it } from 'vitest'
import type { MessagePayload } from '@/application/ports/Envelope'
import { Conversation } from '@/domain/message/Conversation'
import { ReceiveMessage } from './ReceiveMessage'

describe('ReceiveMessage', () => {
  let transport: FakeMessageTransport
  let repository: FakeConversationRepository
  let clock: FakeClock
  let receiveMessage: ReceiveMessage
  let conversation: Conversation

  beforeEach(() => {
    transport = new FakeMessageTransport()
    repository = new FakeConversationRepository()
    clock = new FakeClock()
    receiveMessage = new ReceiveMessage(
      repository,
      transport,
      clock,
      new FakeIdGenerator(),
    )
    conversation = Conversation.start(ME)
  })

  function payload(overrides: Partial<MessagePayload> = {}): MessagePayload {
    return {
      messageId: makeUlid(1758000000000),
      author: HER,
      content: { kind: 'text', text: '나는 12열 통로야' },
      sentAt: 1758000000000,
      messageSeq: 1,
      ...overrides,
    }
  }

  it('받은 메시지를 저장한다', async () => {
    const result = await receiveMessage.execute({ payload: payload(), conversation })

    expect(result.ok && result.value.isNew).toBe(true)
    expect(repository.all()).toHaveLength(1)
  })

  it('받았다는 답을 보낸다', async () => {
    await receiveMessage.execute({ payload: payload(), conversation })

    expect(transport.sentOfType('ack')).toHaveLength(1)
  })

  it('읽지 않은 개수가 하나 는다', async () => {
    const result = await receiveMessage.execute({ payload: payload(), conversation })

    expect(result.ok && result.value.conversation.unreadCount).toBe(1)
  })

  describe('같은 메시지가 두 번 왔을 때', () => {
    it('두 번째는 저장하지 않는다', async () => {
      const same = payload()
      const first = await receiveMessage.execute({ payload: same, conversation })
      if (!first.ok) throw new Error('앞선 단계가 실패했다')

      await receiveMessage.execute({
        payload: same,
        conversation: first.value.conversation,
      })

      expect(repository.all()).toHaveLength(1)
    })

    it('답은 다시 보낸다', async () => {
      // 상대가 답을 못 받아서 다시 보낸 것이다.
      // 또 무시하면 상대는 영원히 다시 보낸다.
      const same = payload()
      const first = await receiveMessage.execute({ payload: same, conversation })
      if (!first.ok) throw new Error('앞선 단계가 실패했다')

      await receiveMessage.execute({
        payload: same,
        conversation: first.value.conversation,
      })

      expect(transport.sentOfType('ack')).toHaveLength(2)
    })

    it('읽지 않은 개수가 두 배가 되지 않는다', async () => {
      const same = payload()
      const first = await receiveMessage.execute({ payload: same, conversation })
      if (!first.ok) throw new Error('앞선 단계가 실패했다')

      const second = await receiveMessage.execute({
        payload: same,
        conversation: first.value.conversation,
      })

      expect(second.ok && second.value.conversation.unreadCount).toBe(1)
    })

    it('대화가 잊어버린 뒤에 다시 와도 저장소가 막는다', async () => {
      // Conversation 은 최근 것만 기억한다. 잊은 뒤에 같은 메시지가
      // 또 오면 저장소의 기본 키가 최종 보루가 된다.
      const same = payload()
      await receiveMessage.execute({ payload: same, conversation })

      const withForgotten = Conversation.start(ME)
      const result = await receiveMessage.execute({
        payload: same,
        conversation: withForgotten,
      })

      expect(result.ok && result.value.isNew).toBe(false)
      expect(repository.all()).toHaveLength(1)
    })
  })

  describe('망가진 내용', () => {
    it('식별자 형식이 틀리면 거절한다', async () => {
      const result = await receiveMessage.execute({
        payload: payload({ messageId: 'not-a-ulid' }),
        conversation,
      })

      expect(result.ok).toBe(false)
    })

    it('상대 식별자 형식이 틀리면 거절한다', async () => {
      const result = await receiveMessage.execute({
        payload: payload({ author: 'x' }),
        conversation,
      })

      expect(result.ok).toBe(false)
    })

    it('순번이 0이면 거절한다', async () => {
      const result = await receiveMessage.execute({
        payload: payload({ messageSeq: 0 }),
        conversation,
      })

      expect(result.ok).toBe(false)
    })

    it('거절해도 앱이 죽지 않고 저장소가 깨끗하다', async () => {
      await receiveMessage.execute({
        payload: payload({ messageId: 'not-a-ulid' }),
        conversation,
      })

      expect(repository.all()).toHaveLength(0)
    })
  })

  describe('시각', () => {
    it('받은 시각은 내 시계를 쓴다', async () => {
      clock.set(1758000009000)

      const result = await receiveMessage.execute({
        payload: payload({ sentAt: 1758000000000 }),
        conversation,
      })

      expect(result.ok && result.value.message.receivedAt?.getTime()).toBe(1758000009000)
    })

    it('상대 폰이 앞서 있어도 받아들인다', async () => {
      // 시차를 넘는 비행에서 실제로 생긴다
      clock.set(1758000000000)

      const result = await receiveMessage.execute({
        payload: payload({ sentAt: 1758000005000 }),
        conversation,
      })

      expect(result.ok).toBe(true)
      expect(result.ok && result.value.message.clockSkewMillis()).toBe(-5000)
    })
  })

  it('순번이 건너뛰면 빈틈으로 적어둔다', async () => {
    const result = await receiveMessage.execute({
      payload: payload({ messageSeq: 3 }),
      conversation,
    })

    expect(result.ok && result.value.conversation.missingSeqs(HER)).toEqual([1, 2])
  })
})
