import { NodeSqlDatabase } from '@test/fakes/NodeSqlDatabase'
import { ME, makeDraft, ulidSequence } from '@test/support/factories'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  doodleContent,
  type MessageContent,
  nudgeContent,
  photoContent,
  stickerContent,
  systemContent,
  textContent,
} from '@/domain/message/MessageContent'
import { migrate } from './migrations'
import { SqliteConversationRepository } from './SqliteConversationRepository'

/**
 * 모든 내용 종류가 진짜 SQLite 를 거쳐 그대로 돌아오나.
 *
 * **여기가 이 앱에서 조용히 무너지기 가장 쉬운 자리다.** 새 내용
 * 종류를 더할 때마다 저장은 되는데 읽을 때 걸리는 일이 생긴다.
 * 그러면 그 메시지들이 **아무 소리 없이 사라진다.** 앱을 껐다 켜기
 * 전까지는 멀쩡해 보여서 더 늦게 안다.
 *
 * 가짜 저장소로는 못 잡는다. 실제 SQL 과 형식 검사를 다 거쳐야 한다.
 */

function must<T>(result: { ok: boolean; value?: T; error?: unknown }): T {
  if (!result.ok) throw new Error(`만들지 못했다: ${JSON.stringify(result.error)}`)
  return result.value as T
}

const everyKind: Array<[string, MessageContent]> = [
  ['글', must(textContent('34열 창가야'))],
  ['이모지가 섞인 글', must(textContent('기내식 나왔어 🛫 맛있다'))],
  [
    '낙서',
    must(
      doodleContent([
        {
          points: [
            { x: 0, y: 0 },
            { x: 0.5, y: 0.25 },
            { x: 1, y: 1 },
          ],
          color: 'me',
          width: 4,
        },
        { points: [{ x: 0.2, y: 0.8 }], color: 'peer', width: 2 },
      ]),
    ),
  ],
  ['이모티콘', must(stickerContent('aria', 'heart'))],
  [
    '사진',
    must(
      photoContent({
        assetId: '01JABCDEFGHJKMNPQRSTVWXYZ0',
        width: 1600,
        height: 1200,
        byteLength: 204_800,
        preview: 'bWlsbGlvbg==',
        caption: '창밖 좀 봐',
      }),
    ),
  ],
  ['콕 찌르기', nudgeContent()],
  ['앱이 끼워 넣은 알림', systemContent('link-lost')],
]

describe('모든 내용이 저장소를 거쳐도 그대로다', () => {
  let db: NodeSqlDatabase
  let repository: SqliteConversationRepository
  let nextId: ReturnType<typeof ulidSequence>

  beforeEach(async () => {
    db = new NodeSqlDatabase()
    const migrated = await migrate(db)
    if (!migrated.ok) throw new Error('표를 만들지 못했다')

    repository = new SqliteConversationRepository(db)
    nextId = ulidSequence()
  })

  afterEach(async () => {
    await db.close()
  })

  it.each(everyKind)('%s 이 그대로 돌아온다', async (_label, content) => {
    const message = makeDraft({ id: nextId(), content, seq: 1 })

    const saved = await repository.save(message)
    expect(saved.ok).toBe(true)

    const found = await repository.findById(message.id)

    expect(found.ok).toBe(true)
    if (!found.ok || found.value === null) {
      throw new Error('저장했는데 못 찾았다')
    }

    // **깊은 곳까지 같아야 한다.** 낙서의 점 하나, 사진의 미리보기까지.
    expect(found.value.content).toEqual(content)
  })

  it('여러 종류가 섞여 있어도 한 번에 다 읽힌다', async () => {
    // 화면은 목록으로 읽는다. 하나가 걸리면 그 뒤가 통째로 안 나온다.
    for (const [index, [, content]] of everyKind.entries()) {
      await repository.save(makeDraft({ id: nextId(), content, seq: index + 1 }))
    }

    const page = await repository.loadPage({ limit: 100 })

    expect(page.ok).toBe(true)
    if (!page.ok) return
    expect(page.value).toHaveLength(everyKind.length)
  })

  it('흘려 읽을 때도 다 나온다', async () => {
    // 대화 꺼내기가 이 길로 읽는다. 여기서 걸리면 꺼내다 만 파일이 된다.
    for (const [index, [, content]] of everyKind.entries()) {
      await repository.save(makeDraft({ id: nextId(), content, seq: index + 1 }))
    }

    let seen = 0
    for await (const batch of repository.streamAll(2)) {
      seen += batch.length
    }

    expect(seen).toBe(everyKind.length)
  })

  it('앱을 껐다 켠 것처럼 다시 열어도 남아 있다', async () => {
    // 같은 파일을 새 연결로 다시 연다
    for (const [index, [, content]] of everyKind.entries()) {
      await repository.save(makeDraft({ id: nextId(), content, seq: index + 1 }))
    }

    const reopened = new SqliteConversationRepository(db)
    const conversation = await reopened.load(ME)

    expect(conversation.ok).toBe(true)

    const count = await reopened.count()
    expect(count.ok).toBe(true)
    if (!count.ok) return
    expect(count.value).toBe(everyKind.length)
  })
})
