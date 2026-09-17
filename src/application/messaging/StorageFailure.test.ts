import { FakeClock } from '@test/fakes/FakeClock'
import { FakeConversationRepository } from '@test/fakes/FakeConversationRepository'
import { FakeIdGenerator } from '@test/fakes/FakeIdGenerator'
import { FakeMessageTransport } from '@test/fakes/FakeMessageTransport'
import { HER, ME, makeReceived, makeText, ulidSequence } from '@test/support/factories'
import { beforeEach, describe, expect, it } from 'vitest'
import { Conversation } from '@/domain/message/Conversation'
import { domainError } from '@/domain/shared/DomainError'
import { FlushPendingMessages } from './FlushPendingMessages'
import { LoadConversation } from './LoadConversation'
import { MarkAsRead } from './MarkAsRead'
import { SendMessage } from './SendMessage'

/**
 * 저장소가 고장났을 때.
 *
 * 기기 저장 공간이 꽉 차면 실제로 이런 일이 생긴다. 비행기에서 사진을
 * 잔뜩 찍은 뒤라면 더 그렇다. 이때 앱이 죽지 않고, 무엇이 잘못됐는지
 * 화면에 알릴 수 있어야 한다.
 */
describe('저장소가 실패할 때', () => {
  let transport: FakeMessageTransport
  let repository: FakeConversationRepository
  let clock: FakeClock
  let ids: FakeIdGenerator

  const diskFull = domainError('invalid-value', '저장 공간이 부족하다')

  beforeEach(() => {
    transport = new FakeMessageTransport()
    repository = new FakeConversationRepository()
    clock = new FakeClock()
    ids = new FakeIdGenerator()
  })

  describe('메시지를 보낼 때', () => {
    it('저장에 실패하면 보내지 않고 실패를 알린다', async () => {
      repository.failNextSave = diskFull
      const sendMessage = new SendMessage(transport, repository, clock, ids)

      const result = await sendMessage.execute({
        author: ME,
        content: makeText('안녕'),
        conversation: Conversation.start(ME),
      })

      expect(result.ok).toBe(false)
      expect(transport.sent).toHaveLength(0)
    })

    it('상태를 고치는 데 실패해도 앱이 죽지 않는다', async () => {
      const sendMessage = new SendMessage(transport, repository, clock, ids)
      repository.failNextUpdate = diskFull

      const result = await sendMessage.execute({
        author: ME,
        content: makeText('안녕'),
        conversation: Conversation.start(ME),
      })

      // 실패를 값으로 돌려준다. 예외를 던지지 않는다.
      expect(result.ok).toBe(false)
    })
  })

  describe('대화를 되살릴 때', () => {
    it('실패하면 그대로 알린다', async () => {
      repository.failNextLoad = diskFull
      const loadConversation = new LoadConversation(repository)

      const result = await loadConversation.initial(ME)

      expect(result.ok).toBe(false)
      expect(!result.ok && result.error.detail).toContain('저장 공간')
    })
  })

  describe('쌓인 메시지를 내보낼 때', () => {
    it('목록을 못 읽으면 그대로 알린다', async () => {
      repository.failNextFindWaiting = diskFull
      const flush = new FlushPendingMessages(repository, transport, clock, ids)

      const result = await flush.execute()

      expect(result.ok).toBe(false)
    })

    it('상태를 못 고쳐도 보내기는 끝까지 한다', async () => {
      // 상태를 못 고친 건 화면 표시가 어긋나는 정도의 문제다.
      // 그것 때문에 메시지를 못 보내면 훨씬 나쁘다.
      const sendMessage = new SendMessage(transport, repository, clock, ids)
      transport.failCount = -1
      const sent = await sendMessage.execute({
        author: ME,
        content: makeText('안녕'),
        conversation: Conversation.start(ME),
      })
      if (!sent.ok) throw new Error('앞선 단계가 실패했다')
      transport.failCount = 0
      transport.sent.length = 0

      repository.failNextUpdate = diskFull
      const flush = new FlushPendingMessages(repository, transport, clock, ids)
      const result = await flush.execute()

      expect(result.ok && result.value.sent).toBe(1)
      expect(transport.sentOfType('message')).toHaveLength(1)
    })
  })

  describe('읽음으로 바꿀 때', () => {
    it('실패하면 그대로 알린다', async () => {
      const nextId = ulidSequence()
      const message = makeReceived({ id: nextId(), author: HER, seq: 1 })
      await repository.save(message)
      const conversation = Conversation.start(ME).accept(message).conversation

      repository.failNextUpdate = diskFull
      const markAsRead = new MarkAsRead(repository, transport, clock, ids)

      const result = await markAsRead.execute({
        me: ME,
        messages: [message],
        conversation,
      })

      expect(result.ok).toBe(false)
    })
  })
})
