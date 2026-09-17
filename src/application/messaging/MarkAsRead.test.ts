import { FakeClock } from '@test/fakes/FakeClock'
import { FakeConversationRepository } from '@test/fakes/FakeConversationRepository'
import { FakeIdGenerator } from '@test/fakes/FakeIdGenerator'
import { FakeMessageTransport } from '@test/fakes/FakeMessageTransport'
import { HER, ME, makeDraft, makeReceived, ulidSequence } from '@test/support/factories'
import { beforeEach, describe, expect, it } from 'vitest'
import { Conversation } from '@/domain/message/Conversation'
import type { Message } from '@/domain/message/Message'
import { MarkAsRead } from './MarkAsRead'

describe('MarkAsRead', () => {
  let transport: FakeMessageTransport
  let repository: FakeConversationRepository
  let markAsRead: MarkAsRead
  let conversation: Conversation
  let nextId: ReturnType<typeof ulidSequence>

  beforeEach(() => {
    transport = new FakeMessageTransport()
    repository = new FakeConversationRepository()
    markAsRead = new MarkAsRead(
      repository,
      transport,
      new FakeClock(),
      new FakeIdGenerator(),
    )
    conversation = Conversation.start(ME)
    nextId = ulidSequence()
  })

  /** 상대에게서 받은 메시지를 저장해 둔다 */
  async function receive(count: number): Promise<Message[]> {
    const messages: Message[] = []
    for (let seq = 1; seq <= count; seq += 1) {
      const message = makeReceived({ id: nextId(), author: HER, seq })
      await repository.save(message)
      conversation = conversation.accept(message).conversation
      messages.push(message)
    }
    return messages
  }

  it('받은 메시지를 읽음으로 바꾼다', async () => {
    const messages = await receive(3)

    const result = await markAsRead.execute({ me: ME, messages, conversation })

    expect(result.ok && result.value.readCount).toBe(3)
    expect(repository.all().every(m => m.delivery === 'read')).toBe(true)
  })

  it('여러 건을 묶어 한 번에 보낸다', async () => {
    // 건마다 보내면 좁은 길이 막힌다
    const messages = await receive(5)

    await markAsRead.execute({ me: ME, messages, conversation })

    const readSignals = transport.sentOfType('read')

    expect(readSignals).toHaveLength(1)
    expect(readSignals[0]?.p.messageIds).toHaveLength(5)
  })

  it('읽지 않은 개수가 줄어든다', async () => {
    const messages = await receive(3)

    const result = await markAsRead.execute({ me: ME, messages, conversation })

    expect(result.ok && result.value.conversation.unreadCount).toBe(0)
  })

  it('내가 쓴 메시지는 읽음으로 치지 않는다', async () => {
    const mine = makeDraft({ id: nextId(), author: ME, seq: 1 })
    await repository.save(mine)

    const result = await markAsRead.execute({ me: ME, messages: [mine], conversation })

    expect(result.ok && result.value.readCount).toBe(0)
  })

  it('이미 읽은 것은 다시 세지 않는다', async () => {
    const messages = await receive(2)
    const first = await markAsRead.execute({ me: ME, messages, conversation })
    if (!first.ok) throw new Error('앞선 단계가 실패했다')

    const second = await markAsRead.execute({
      me: ME,
      messages: repository.all(),
      conversation: first.value.conversation,
    })

    expect(second.ok && second.value.readCount).toBe(0)
  })

  it('읽을 게 없으면 신호를 보내지 않는다', async () => {
    await markAsRead.execute({ me: ME, messages: [], conversation })

    expect(transport.sentOfType('read')).toHaveLength(0)
  })

  it('신호가 못 가도 읽음 상태는 남는다', async () => {
    // 읽음 신호는 중요도가 낮다. 못 갔다고 되돌리면
    // 다음에 또 읽음으로 바꾸려 하고 신호가 계속 나간다.
    const messages = await receive(2)
    transport.failCount = -1

    const result = await markAsRead.execute({ me: ME, messages, conversation })

    expect(result.ok && result.value.readCount).toBe(2)
    expect(repository.all().every(m => m.delivery === 'read')).toBe(true)
  })
})
