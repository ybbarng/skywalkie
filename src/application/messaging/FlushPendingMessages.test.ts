import { FakeClock } from '@test/fakes/FakeClock'
import { FakeConversationRepository } from '@test/fakes/FakeConversationRepository'
import { FakeIdGenerator } from '@test/fakes/FakeIdGenerator'
import { FakeMessageTransport } from '@test/fakes/FakeMessageTransport'
import { ME, makeText } from '@test/support/factories'
import { beforeEach, describe, expect, it } from 'vitest'
import { Conversation } from '@/domain/message/Conversation'
import { DEFAULT_MAX_ATTEMPTS, FlushPendingMessages } from './FlushPendingMessages'
import { SendMessage } from './SendMessage'

describe('FlushPendingMessages', () => {
  let transport: FakeMessageTransport
  let repository: FakeConversationRepository
  let clock: FakeClock
  let ids: FakeIdGenerator
  let flush: FlushPendingMessages

  beforeEach(() => {
    transport = new FakeMessageTransport()
    repository = new FakeConversationRepository()
    clock = new FakeClock()
    ids = new FakeIdGenerator()
    flush = new FlushPendingMessages(repository, transport, clock, ids)
  })

  /** 연결이 끊긴 채로 메시지를 여러 개 쌓아둔다 */
  async function pileUp(texts: readonly string[]): Promise<void> {
    const sendMessage = new SendMessage(transport, repository, clock, ids)
    let conversation = Conversation.start(ME)

    transport.failCount = -1
    for (const text of texts) {
      const result = await sendMessage.execute({
        author: ME,
        content: makeText(text),
        conversation,
      })
      if (!result.ok) throw new Error('앞선 단계가 실패했다')
      conversation = result.value.conversation
    }
    transport.failCount = 0
    transport.sent.length = 0
  }

  it('쌓인 메시지를 내보낸다', async () => {
    await pileUp(['하나', '둘', '셋'])

    const result = await flush.execute()

    expect(result.ok && result.value.sent).toBe(3)
    expect(transport.sentOfType('message')).toHaveLength(3)
  })

  it('순번 순서 그대로 내보낸다', async () => {
    // 한꺼번에 병렬로 보내면 순서가 뒤바뀌어 대화가 이상해진다
    await pileUp(['하나', '둘', '셋', '넷', '다섯'])

    await flush.execute()

    const seqs = transport.sentOfType('message').map(e => e.p.messageSeq)

    expect(seqs).toEqual([1, 2, 3, 4, 5])
  })

  it('보낼 게 없으면 아무 일도 안 한다', async () => {
    const result = await flush.execute()

    expect(result.ok && result.value.total).toBe(0)
    expect(transport.sent).toHaveLength(0)
  })

  it('내보낸 메시지는 대기 줄에서 빠진다', async () => {
    await pileUp(['하나', '둘'])

    await flush.execute()
    const waiting = await repository.findWaitingToSend()

    expect(waiting.ok && waiting.value).toHaveLength(0)
  })

  describe('실패했을 때', () => {
    it(`${DEFAULT_MAX_ATTEMPTS}번까지 다시 보낸다`, async () => {
      await pileUp(['하나'])
      // 마지막 시도만 성공하게 한다
      transport.failCount = DEFAULT_MAX_ATTEMPTS - 1

      const result = await flush.execute()

      expect(result.ok && result.value.sent).toBe(1)
    })

    it('계속 실패하면 실패로 두고 화면에 알린다', async () => {
      await pileUp(['하나'])
      transport.failCount = -1

      const result = await flush.execute()

      expect(result.ok && result.value.failed).toBe(1)
      expect(repository.all()[0]?.delivery).toBe('failed')
    })

    it('실패한 메시지는 대기 줄에서 빠져 나머지를 막지 않는다', async () => {
      await pileUp(['하나'])
      transport.failCount = -1

      await flush.execute()
      const waiting = await repository.findWaitingToSend()

      expect(waiting.ok && waiting.value).toHaveLength(0)
    })

    it('연결이 아예 끊기면 남은 것을 붙들고 있는다', async () => {
      // 하나씩 다 실패시키며 끝까지 가면 시간과 배터리만 쓴다
      await pileUp(['하나', '둘', '셋'])
      transport.failCount = -1
      transport.loseConnection()

      const result = await flush.execute()

      expect(result.ok && result.value.failed).toBe(1)
      const waiting = await repository.findWaitingToSend()
      expect(waiting.ok && waiting.value.length).toBeGreaterThan(0)
    })
  })

  it('두 번 불러도 같은 메시지를 두 번 보내지 않는다', async () => {
    await pileUp(['하나', '둘'])

    await flush.execute()
    await flush.execute()

    expect(transport.sentOfType('message')).toHaveLength(2)
  })
})
