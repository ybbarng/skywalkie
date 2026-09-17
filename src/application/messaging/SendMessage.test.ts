import { FakeClock } from '@test/fakes/FakeClock'
import { FakeConversationRepository } from '@test/fakes/FakeConversationRepository'
import { FakeIdGenerator } from '@test/fakes/FakeIdGenerator'
import { FakeMessageTransport } from '@test/fakes/FakeMessageTransport'
import { ME, makeText } from '@test/support/factories'
import { beforeEach, describe, expect, it } from 'vitest'
import { Conversation } from '@/domain/message/Conversation'
import { domainError } from '@/domain/shared/DomainError'
import { SendMessage } from './SendMessage'

describe('SendMessage', () => {
  let transport: FakeMessageTransport
  let repository: FakeConversationRepository
  let clock: FakeClock
  let ids: FakeIdGenerator
  let sendMessage: SendMessage
  let conversation: Conversation

  beforeEach(() => {
    transport = new FakeMessageTransport()
    repository = new FakeConversationRepository()
    clock = new FakeClock()
    ids = new FakeIdGenerator()
    sendMessage = new SendMessage(transport, repository, clock, ids)
    conversation = Conversation.start(ME)
  })

  function send(text = '34열 창가야') {
    return sendMessage.execute({
      author: ME,
      content: makeText(text),
      conversation,
    })
  }

  it('메시지를 보내고 저장한다', async () => {
    const result = await send()

    expect(result.ok).toBe(true)
    expect(repository.all()).toHaveLength(1)
    expect(transport.sentOfType('message')).toHaveLength(1)
  })

  it('보낸 내용이 봉투에 그대로 들어간다', async () => {
    await send('기내식 나왔어')

    const [envelope] = transport.sentOfType('message')

    expect(envelope?.p.content).toEqual({ kind: 'text', text: '기내식 나왔어' })
  })

  describe('보내기 전에 저장한다', () => {
    it('전송에 실패해도 메시지가 남는다', async () => {
      // 이 순서가 이 유스케이스의 핵심이다. 반대로 하면
      // 전송 도중 앱이 죽었을 때 메시지가 사라진다.
      transport.failCount = -1

      const result = await send()

      expect(result.ok).toBe(true)
      expect(repository.all()).toHaveLength(1)
    })

    it('저장에 실패하면 보내지 않는다', async () => {
      repository.failNextSave = domainError('invalid-value', '저장소가 고장났다')

      const result = await send()

      expect(result.ok).toBe(false)
      expect(transport.sent).toHaveLength(0)
    })
  })

  describe('전송에 실패했을 때', () => {
    beforeEach(() => {
      transport.failCount = -1
    })

    it('실패가 아니라 대기 중으로 둔다', async () => {
      // 연결이 끊기는 건 이 앱에서 예외가 아니라 늘 있는 일이다.
      // 실패로 두면 사용자가 손으로 다시 보내야 한다.
      const result = await send()

      expect(result.ok && result.value.message.delivery).toBe('pending')
    })

    it('지금 못 나갔다고 알려준다', async () => {
      const result = await send()

      expect(result.ok && result.value.sentNow).toBe(false)
    })

    it('연결이 돌아오면 자동으로 나갈 수 있는 상태다', async () => {
      await send()

      const waiting = await repository.findWaitingToSend()

      expect(waiting.ok && waiting.value).toHaveLength(1)
    })
  })

  describe('순번', () => {
    it('1부터 시작한다', async () => {
      const result = await send()

      expect(result.ok && result.value.message.seq).toBe(1)
    })

    it('보낼 때마다 하나씩 오른다', async () => {
      const first = await send('하나')
      if (!first.ok) throw new Error('앞선 단계가 실패했다')

      conversation = first.value.conversation
      const second = await send('둘')

      expect(second.ok && second.value.message.seq).toBe(2)
    })

    it('전송에 실패해도 순번을 쓴 것으로 친다', async () => {
      // 순번을 되돌리면 나중에 보낸 메시지와 겹쳐서
      // 상대가 하나를 버린다
      transport.failCount = -1

      const result = await send()

      expect(result.ok && result.value.conversation.nextOutgoingSeq).toBe(2)
    })
  })

  describe('잘못된 내용', () => {
    it('빈 메시지는 만들어지지 않는다', () => {
      expect(() => makeText('   ')).toThrow()
    })
  })

  it('보낸 시각은 주입받은 시계를 쓴다', async () => {
    clock.set(1758000123000)

    const result = await send()

    expect(result.ok && result.value.message.sentAt.getTime()).toBe(1758000123000)
  })
})
