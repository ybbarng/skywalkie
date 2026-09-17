import { NodeSqlDatabase } from '@test/fakes/NodeSqlDatabase'
import { HER, ME, makeReceived, ulidSequence } from '@test/support/factories'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SqliteConversationRepository } from '@/infrastructure/persistence/SqliteConversationRepository'
import { metaKeys, SCHEMA_VERSION } from '@/infrastructure/persistence/schema'
import { migrate } from './index'

/**
 * 표를 고칠 때 대화가 날아가면 이 앱을 만든 이유가 없어진다.
 * 아이폰 앱이 7일마다 만료되고 그때마다 덮어쓰기로 다시 깐다.
 */
describe('표 만들고 올리기', () => {
  let db: NodeSqlDatabase

  beforeEach(() => {
    db = new NodeSqlDatabase()
  })

  afterEach(async () => {
    await db.close()
  })

  it('빈 데이터베이스에 표를 만든다', async () => {
    const result = await migrate(db)

    expect(result.ok && result.value.from).toBe(0)
    expect(result.ok && result.value.to).toBe(SCHEMA_VERSION)
  })

  it('두 번 돌려도 안전하다', async () => {
    // 앱을 켤 때마다 부른다
    await migrate(db)

    const second = await migrate(db)

    expect(second.ok && second.value.applied).toBe(0)
  })

  it('올린 버전을 적어둔다', async () => {
    await migrate(db)

    const row = await db.get<{ value: string }>(
      'SELECT value FROM schema_meta WHERE key = ?',
      [metaKeys.schemaVersion],
    )

    expect(row.ok && row.value?.value).toBe(String(SCHEMA_VERSION))
  })

  it('표를 올려도 메시지가 그대로다', async () => {
    await migrate(db)
    const repository = new SqliteConversationRepository(db)
    const nextId = ulidSequence()
    const message = makeReceived({ id: nextId(), author: HER, seq: 1 })
    await repository.save(message)

    // 앱을 다시 깔았다고 치고 한 번 더 올린다
    await migrate(db)

    const found = await repository.findById(message.id)

    expect(found.ok && found.value?.id).toBe(message.id)
  })

  it('중복을 막는 규칙이 실제로 걸려 있다', async () => {
    await migrate(db)

    const duplicate = await db.run(
      `INSERT INTO messages (id, author_id, content_kind, content_body, sent_at, seq, delivery)
       VALUES ('01K5F8ZPXQ0000000000000000', 'peer-her000', 'text', '{}', 1, 1, 'delivered')`,
    )
    const again = await db.run(
      `INSERT INTO messages (id, author_id, content_kind, content_body, sent_at, seq, delivery)
       VALUES ('01K5F8ZPXQ0000000000000000', 'peer-her000', 'text', '{}', 1, 2, 'delivered')`,
    )

    expect(duplicate.ok).toBe(true)
    expect(!again.ok && again.error.code).toBe('duplicate')
  })

  it('만들어진 표에 화면용 색인이 있다', async () => {
    await migrate(db)

    const indexes = await db.all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'messages'",
    )

    const names = indexes.ok ? indexes.value.map(i => i.name) : []

    expect(names).toContain('idx_messages_ordered')
    expect(names).toContain('idx_messages_waiting')
  })
})

describe('많은 메시지', () => {
  let db: NodeSqlDatabase
  let repository: SqliteConversationRepository

  beforeEach(async () => {
    db = new NodeSqlDatabase()
    await migrate(db)
    repository = new SqliteConversationRepository(db)
  })

  afterEach(async () => {
    await db.close()
  })

  it('만 건이 있어도 첫 화면과 마지막 화면 꺼내는 시간이 비슷하다', async () => {
    // OFFSET 을 썼다면 뒤로 갈수록 느려진다.
    // 비행기에서 몇 시간 대화한 뒤에도 화면이 버벅이면 안 된다.
    const nextId = ulidSequence()
    const messages = Array.from({ length: 10_000 }, (_, i) =>
      makeReceived({
        id: nextId(),
        author: HER,
        seq: i + 1,
        now: new Date(1758000000000 + i * 1000),
      }),
    )
    await repository.saveMany(messages)

    const firstStart = performance.now()
    const first = await repository.loadPage({ limit: 50 })
    const firstMs = performance.now() - firstStart

    if (!first.ok) throw new Error('앞선 단계가 실패했다')
    const oldest = first.value[0]
    if (oldest === undefined) throw new Error('메시지가 없다')

    // 아주 옛날 지점에서 꺼내본다
    const deepStart = performance.now()
    const deep = await repository.loadPage({
      before: { orderedAt: 1758000000000 + 100 * 1000, id: nextId() },
      limit: 50,
    })
    const deepMs = performance.now() - deepStart

    expect(deep.ok && deep.value.length).toBeGreaterThan(0)
    // 넉넉하게 잡는다. 열 배 넘게 차이 나면 색인이 안 먹고 있는 것이다.
    expect(deepMs).toBeLessThan(Math.max(firstMs * 10, 50))
  })

  it('만 건에서도 대화를 빠르게 되살린다', async () => {
    const nextId = ulidSequence()
    const messages = Array.from({ length: 10_000 }, (_, i) =>
      makeReceived({ id: nextId(), author: HER, seq: i + 1 }),
    )
    await repository.saveMany(messages)

    const start = performance.now()
    const conversation = await repository.load(ME)
    const elapsed = performance.now() - start

    expect(conversation.ok && conversation.value.highestSeqFrom(HER)).toBe(10_000)
    expect(elapsed).toBeLessThan(2000)
  })
})
