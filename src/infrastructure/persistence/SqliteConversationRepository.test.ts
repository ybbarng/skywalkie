import { NodeSqlDatabase } from '@test/fakes/NodeSqlDatabase'
import {
  HER,
  ME,
  makeDraft,
  makeReceived,
  makeText,
  ulidSequence,
} from '@test/support/factories'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Message } from '@/domain/message/Message'
import { migrate } from './migrations'
import { SqliteConversationRepository } from './SqliteConversationRepository'

/**
 * 진짜 SQLite 로 시험한다. 가짜로 대신하지 않는 이유는
 * **SQL 자체가 맞는지를 확인하는 게 목적**이기 때문이다.
 */
describe('SqliteConversationRepository', () => {
  let db: NodeSqlDatabase
  let repository: SqliteConversationRepository
  let nextId: ReturnType<typeof ulidSequence>

  beforeEach(async () => {
    db = new NodeSqlDatabase()
    const migrated = await migrate(db)
    if (!migrated.ok) throw new Error(`표를 만들지 못했다: ${migrated.error.detail}`)

    repository = new SqliteConversationRepository(db)
    nextId = ulidSequence()
  })

  afterEach(async () => {
    await db.close()
  })

  async function saveReceived(
    seq: number,
    at = 1758000000000 + seq * 1000,
  ): Promise<Message> {
    const message = makeReceived({ id: nextId(), author: HER, seq, now: new Date(at) })
    const saved = await repository.save(message)
    if (!saved.ok) throw new Error(`저장하지 못했다: ${saved.error.detail}`)
    return message
  }

  describe('저장소가 중복을 막는다', () => {
    it('같은 식별자를 두 번 넣으면 거절한다', async () => {
      const message = await saveReceived(1)

      const again = await repository.save(message)

      expect(!again.ok && again.error.code).toBe('duplicate')
    })

    it('한 사람의 같은 순번을 두 번 넣으면 거절한다', async () => {
      // 코드에서 순번을 되돌리는 실수를 해도 저장소가 막는다
      await saveReceived(1)

      const another = makeReceived({ id: nextId(), author: HER, seq: 1 })
      const result = await repository.save(another)

      expect(!result.ok && result.error.code).toBe('duplicate')
    })

    it('다른 사람이면 같은 순번을 쓸 수 있다', async () => {
      await saveReceived(1)

      const mine = makeDraft({ id: nextId(), author: ME, seq: 1 })
      const result = await repository.save(mine)

      expect(result.ok).toBe(true)
    })
  })

  describe('꺼내기', () => {
    it('저장한 메시지를 그대로 되살린다', async () => {
      const original = makeReceived({
        id: nextId(),
        author: HER,
        seq: 1,
        content: makeText('창밖에 구름 봐'),
      })
      await repository.save(original)

      const found = await repository.findById(original.id)

      expect(found.ok && found.value?.content).toEqual({
        kind: 'text',
        text: '창밖에 구름 봐',
      })
      expect(found.ok && found.value?.seq).toBe(1)
      expect(found.ok && found.value?.delivery).toBe('delivered')
    })

    it('없는 메시지를 찾으면 없다고 한다', async () => {
      const found = await repository.findById(nextId())

      expect(found.ok && found.value).toBeNull()
    })

    it('순번으로 찾을 수 있다', async () => {
      // 상대가 놓친 것을 달라고 할 때 쓴다
      await saveReceived(1)
      await saveReceived(2)

      const found = await repository.findBySeq(HER, 2)

      expect(found.ok && found.value?.seq).toBe(2)
    })
  })

  describe('화면에 꺼내기', () => {
    it('최신부터 요청한 개수만큼 꺼낸다', async () => {
      for (let seq = 1; seq <= 10; seq += 1) await saveReceived(seq)

      const page = await repository.loadPage({ limit: 3 })

      expect(page.ok && page.value.map(m => m.seq)).toEqual([8, 9, 10])
    })

    it('최신이 마지막에 오도록 줄 세운다', async () => {
      for (let seq = 1; seq <= 5; seq += 1) await saveReceived(seq)

      const page = await repository.loadPage({ limit: 10 })

      expect(page.ok && page.value.map(m => m.seq)).toEqual([1, 2, 3, 4, 5])
    })

    it('마지막으로 본 지점 앞의 것을 꺼낸다', async () => {
      for (let seq = 1; seq <= 10; seq += 1) await saveReceived(seq)
      const first = await repository.loadPage({ limit: 3 })
      if (!first.ok) throw new Error('앞선 단계가 실패했다')
      const oldest = first.value[0]
      if (oldest === undefined) throw new Error('메시지가 없다')

      const older = await repository.loadPage({
        before: { orderedAt: oldest.orderedAt().getTime(), id: oldest.id },
        limit: 3,
      })

      expect(older.ok && older.value.map(m => m.seq)).toEqual([5, 6, 7])
    })

    it('시각이 같아도 순서가 흔들리지 않는다', async () => {
      // 빠르게 주고받으면 같은 밀리초에 여러 건이 들어온다.
      // 이때 식별자로 순서를 확정하지 않으면 화면이 넘길 때마다 달라진다.
      const sameTime = 1758000000000
      for (let seq = 1; seq <= 5; seq += 1) await saveReceived(seq, sameTime)

      const first = await repository.loadPage({ limit: 10 })
      const second = await repository.loadPage({ limit: 10 })

      expect(first.ok && first.value.map(m => m.id)).toEqual(
        second.ok ? second.value.map(m => m.id) : [],
      )
    })

    it('내가 보낸 메시지도 함께 줄 세운다', async () => {
      // 내가 보낸 것은 받은 시각이 없다. 보낸 시각으로 세워야
      // 대화가 뒤죽박죽이 되지 않는다.
      await saveReceived(1, 1758000001000)
      const mine = makeDraft({
        id: nextId(),
        author: ME,
        seq: 1,
        now: new Date(1758000002000),
      })
      await repository.save(mine)
      await saveReceived(2, 1758000003000)

      const page = await repository.loadPage({ limit: 10 })

      expect(page.ok && page.value.map(m => m.author)).toEqual([HER, ME, HER])
    })
  })

  describe('연결이 돌아왔을 때 내보낼 것', () => {
    it('아직 안 보낸 것과 대기 중인 것을 준다', async () => {
      const draft = makeDraft({ id: nextId(), author: ME, seq: 1 })
      await repository.save(draft)
      await saveReceived(1)

      const waiting = await repository.findWaitingToSend()

      expect(waiting.ok && waiting.value).toHaveLength(1)
      expect(waiting.ok && waiting.value[0]?.author).toBe(ME)
    })

    it('순번 순서대로 준다', async () => {
      // 순서가 뒤바뀌면 대화가 이상해진다
      for (const seq of [3, 1, 2]) {
        await repository.save(makeDraft({ id: nextId(), author: ME, seq }))
      }

      const waiting = await repository.findWaitingToSend()

      expect(waiting.ok && waiting.value.map(m => m.seq)).toEqual([1, 2, 3])
    })
  })

  describe('상태 고치기', () => {
    it('전달 상태를 바꾼다', async () => {
      const message = await saveReceived(1)
      const read = message.markRead()
      if (!read.ok) throw new Error('앞선 단계가 실패했다')

      await repository.updateDelivery(read.value)
      const found = await repository.findById(message.id)

      expect(found.ok && found.value?.delivery).toBe('read')
    })

    it('없는 메시지를 고치려 하면 알려준다', async () => {
      const ghost = makeReceived({ id: nextId(), author: HER, seq: 99 })

      const result = await repository.updateDelivery(ghost)

      expect(!result.ok && result.error.code).toBe('not-found')
    })
  })

  describe('대화 되살리기', () => {
    it('내 순번을 이어간다', async () => {
      // 1로 돌아가면 상대가 중복으로 보고 메시지를 버린다
      await repository.save(makeDraft({ id: nextId(), author: ME, seq: 1 }))
      await repository.save(makeDraft({ id: nextId(), author: ME, seq: 2 }))

      const conversation = await repository.load(ME)

      expect(conversation.ok && conversation.value.nextOutgoingSeq).toBe(3)
    })

    it('못 받은 순번을 기억한다', async () => {
      await saveReceived(1)
      await saveReceived(4)

      const conversation = await repository.load(ME)

      expect(conversation.ok && conversation.value.missingSeqs(HER)).toEqual([2, 3])
    })

    it('읽지 않은 개수를 표에서 직접 센다', async () => {
      const first = await saveReceived(1)
      await saveReceived(2)
      const read = first.markRead()
      if (!read.ok) throw new Error('앞선 단계가 실패했다')
      await repository.updateDelivery(read.value)

      const conversation = await repository.load(ME)

      expect(conversation.ok && conversation.value.unreadCount).toBe(1)
    })

    it('메시지가 없어도 되살린다', async () => {
      const conversation = await repository.load(ME)

      expect(conversation.ok && conversation.value.nextOutgoingSeq).toBe(1)
      expect(conversation.ok && conversation.value.unreadCount).toBe(0)
    })
  })

  describe('여러 건 한꺼번에', () => {
    it('전부 넣는다', async () => {
      const messages = [1, 2, 3].map(seq =>
        makeReceived({ id: nextId(), author: HER, seq }),
      )

      const result = await repository.saveMany(messages)

      expect(result.ok && result.value.inserted).toBe(3)
    })

    it('이미 있는 것은 건너뛴다', async () => {
      const existing = await saveReceived(1)
      const messages = [existing, makeReceived({ id: nextId(), author: HER, seq: 2 })]

      const result = await repository.saveMany(messages)

      expect(result.ok && result.value.inserted).toBe(1)
      expect(result.ok && result.value.skipped).toBe(1)
    })

    it('도중에 실패하면 전부 되돌린다', async () => {
      // 되돌리기에서 특히 중요하다. 절반만 들어가면
      // 무엇이 빠졌는지 알 수 없다.
      const good = makeReceived({ id: nextId(), author: HER, seq: 1 })
      const broken = makeReceived({ id: nextId(), author: HER, seq: 2 })

      await db.exec('DROP TABLE messages')
      const result = await repository.saveMany([good, broken])

      expect(result.ok).toBe(false)
    })
  })

  describe('흘려가며 읽기', () => {
    it('전부 훑는다', async () => {
      for (let seq = 1; seq <= 25; seq += 1) await saveReceived(seq)

      const seen: number[] = []
      for await (const batch of repository.streamAll(10)) {
        seen.push(batch.length)
      }

      expect(seen).toEqual([10, 10, 5])
    })

    it('한 건도 빠뜨리지 않는다', async () => {
      for (let seq = 1; seq <= 25; seq += 1) await saveReceived(seq)

      const ids = new Set<string>()
      for await (const batch of repository.streamAll(7)) {
        for (const message of batch) ids.add(message.id)
      }

      expect(ids.size).toBe(25)
    })

    it('메시지가 없으면 한 번도 돌지 않는다', async () => {
      let rounds = 0
      for await (const _ of repository.streamAll(10)) rounds += 1

      expect(rounds).toBe(0)
    })
  })

  it('몇 건인지 센다', async () => {
    for (let seq = 1; seq <= 7; seq += 1) await saveReceived(seq)

    const count = await repository.count()

    expect(count.ok && count.value).toBe(7)
  })

  it('메시지가 들어오면 알려준다', async () => {
    let notified = 0
    repository.onChange(() => {
      notified += 1
    })

    await saveReceived(1)

    expect(notified).toBe(1)
  })
})
