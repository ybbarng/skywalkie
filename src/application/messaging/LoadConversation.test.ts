import { FakeConversationRepository } from '@test/fakes/FakeConversationRepository'
import { HER, ME, makeDraft, makeReceived, ulidSequence } from '@test/support/factories'
import { beforeEach, describe, expect, it } from 'vitest'
import { LoadConversation, PAGE_SIZE } from './LoadConversation'

describe('LoadConversation', () => {
  let repository: FakeConversationRepository
  let loadConversation: LoadConversation

  beforeEach(() => {
    repository = new FakeConversationRepository()
    loadConversation = new LoadConversation(repository)
  })

  async function fill(count: number): Promise<void> {
    const nextId = ulidSequence()
    for (let seq = 1; seq <= count; seq += 1) {
      await repository.save(
        makeReceived({
          id: nextId(),
          author: HER,
          seq,
          now: new Date(1758000000000 + seq * 1000),
        }),
      )
    }
  }

  it('메시지가 없어도 대화를 되살린다', async () => {
    const result = await loadConversation.initial(ME)

    expect(result.ok && result.value.messages).toHaveLength(0)
    expect(result.ok && result.value.hasMore).toBe(false)
  })

  it(`한 번에 ${PAGE_SIZE}건까지 꺼낸다`, async () => {
    await fill(PAGE_SIZE + 20)

    const result = await loadConversation.initial(ME)

    expect(result.ok && result.value.messages).toHaveLength(PAGE_SIZE)
  })

  it('더 있으면 더 있다고 알려준다', async () => {
    await fill(PAGE_SIZE + 1)

    const result = await loadConversation.initial(ME)

    expect(result.ok && result.value.hasMore).toBe(true)
  })

  it('가장 최근 것들을 꺼낸다', async () => {
    await fill(PAGE_SIZE + 10)

    const result = await loadConversation.initial(ME)
    if (!result.ok) throw new Error('앞선 단계가 실패했다')

    const last = result.value.messages.at(-1)

    expect(last?.seq).toBe(PAGE_SIZE + 10)
  })

  it('최신이 마지막에 오도록 줄 세운다', async () => {
    await fill(5)

    const result = await loadConversation.initial(ME)
    if (!result.ok) throw new Error('앞선 단계가 실패했다')

    const seqs = result.value.messages.map(m => m.seq)

    expect(seqs).toEqual([1, 2, 3, 4, 5])
  })

  describe('옛 메시지 더 보기', () => {
    it('앞의 것들을 꺼낸다', async () => {
      await fill(PAGE_SIZE + 10)
      const first = await loadConversation.initial(ME)
      if (!first.ok) throw new Error('앞선 단계가 실패했다')
      const oldest = first.value.messages[0]
      if (oldest === undefined) throw new Error('메시지가 없다')

      const older = await loadConversation.older(oldest)

      expect(older.ok && older.value.messages).toHaveLength(10)
      expect(older.ok && older.value.hasMore).toBe(false)
    })

    it('겹치지 않는다', async () => {
      await fill(PAGE_SIZE + 10)
      const first = await loadConversation.initial(ME)
      if (!first.ok) throw new Error('앞선 단계가 실패했다')
      const oldest = first.value.messages[0]
      if (oldest === undefined) throw new Error('메시지가 없다')

      const older = await loadConversation.older(oldest)
      if (!older.ok) throw new Error('앞선 단계가 실패했다')

      const firstIds = new Set(first.value.messages.map(m => m.id))
      const overlap = older.value.messages.filter(m => firstIds.has(m.id))

      expect(overlap).toHaveLength(0)
    })
  })

  it('앱을 껐다 켜도 내 순번을 이어간다', async () => {
    // 순번이 1로 돌아가면 상대가 중복으로 보고 메시지를 버린다
    const nextId = ulidSequence()
    await repository.save(makeDraft({ id: nextId(), author: ME, seq: 1 }))
    await repository.save(makeDraft({ id: nextId(), author: ME, seq: 2 }))

    const result = await loadConversation.initial(ME)

    expect(result.ok && result.value.conversation.nextOutgoingSeq).toBe(3)
  })

  it('앱을 껐다 켜도 못 받은 순번을 기억한다', async () => {
    const nextId = ulidSequence()
    await repository.save(makeReceived({ id: nextId(), author: HER, seq: 3 }))

    const result = await loadConversation.initial(ME)

    expect(result.ok && result.value.conversation.missingSeqs(HER)).toEqual([1, 2])
  })
})
