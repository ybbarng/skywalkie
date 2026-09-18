import { NodeSqlDatabase } from '@test/fakes/NodeSqlDatabase'
import { HER, ME, makeDraft, makeText, ulidSequence } from '@test/support/factories'
import { Rng } from '@test/support/random'
import { WiredDevice } from '@test/support/WiredDevice'
import { wiredTransportPair } from '@test/support/WiredTransportPair'
import { describe, expect, it } from 'vitest'
import { Conversation } from '@/domain/message/Conversation'
import { migrate } from '@/infrastructure/persistence/migrations'
import { SqliteConversationRepository } from '@/infrastructure/persistence/SqliteConversationRepository'

/**
 * 험한 조건에서 버티는지.
 *
 * **세 시간 비행에서 실제로 일어날 만한 것보다 더 몰아붙인다.**
 * 여기서 무너지면 실제로도 어딘가에서 무너진다.
 *
 * 비행기에서 버그를 발견하면 그걸로 끝이다. 앱 스토어 업데이트도,
 * 서버 수정도 없다.
 */

async function settle(): Promise<void> {
  for (let i = 0; i < 20; i += 1) {
    await new Promise(resolve => setTimeout(resolve, 0))
  }
}

describe('말이 많이 쌓여도', () => {
  it('천 개를 주고받아도 양쪽이 같다', async () => {
    const [left, right] = wiredTransportPair()

    const android = await WiredDevice.start(ME, left, 1)
    const iphone = await WiredDevice.start(HER, right, 2)
    await left.connect()
    await right.connect()

    for (let i = 0; i < 500; i += 1) {
      await android.send(makeText(`내가 ${i}`))
      await iphone.send(makeText(`상대가 ${i}`))
    }
    await settle()

    expect(await android.count()).toBe(1000)
    expect(await iphone.count()).toBe(1000)

    // **줄 세운 순서까지 같아야 한다.** 다르면 두 화면이 다르게 보인다.
    const mine = (await android.stored()).map(m => m.id)
    const theirs = (await iphone.stored()).map(m => m.id)
    expect(mine).toEqual(theirs)

    await android.close()
    await iphone.close()
  }, 60_000)

  it('만 건이 쌓여도 화면을 여는 속도가 그대로다', async () => {
    // **화면은 마지막 50개만 읽는다.** 쌓인 양과 상관없이 같아야 한다.
    const db = new NodeSqlDatabase()
    const migrated = await migrate(db)
    if (!migrated.ok) throw new Error('표를 만들지 못했다')

    const repository = new SqliteConversationRepository(db)
    const nextId = ulidSequence()

    for (let i = 0; i < 10_000; i += 1) {
      await repository.save(makeDraft({ id: nextId(), seq: i + 1 }))
    }

    const startedAt = Date.now()
    const page = await repository.loadPage({ limit: 50 })
    const took = Date.now() - startedAt

    expect(page.ok).toBe(true)
    if (page.ok) expect(page.value).toHaveLength(50)
    // 넉넉히 잡아도 이 안에 끝나야 한다. 넘으면 SQL 이 훑고 있다는 뜻이다.
    expect(took).toBeLessThan(200)

    await db.close()
  }, 120_000)
})

describe('대화가 아주 길어져도', () => {
  it('기억하는 것이 무한히 늘지 않는다', () => {
    // `Conversation` 은 최근 것만 들고 있다. 안 그러면 세 시간 뒤에
    // **앱이 느려지다 죽는다.**
    const nextId = ulidSequence()
    let conversation = Conversation.start(ME)

    for (let i = 0; i < 20_000; i += 1) {
      const message = makeDraft({ id: nextId(), seq: i + 1 })
      conversation = conversation.accept(message).conversation
    }

    // 안에 든 것을 직접 못 보므로, 오래된 것을 잊었는지로 본다
    const veryOld = makeDraft({ id: ulidSequence()(), seq: 1 })
    expect(conversation.accept(veryOld).accepted).toBe(true)
  })

  it('최근 것은 두 번 안 받는다', () => {
    const nextId = ulidSequence()
    let conversation = Conversation.start(ME)

    const first = makeDraft({ id: nextId(), seq: 1 })
    conversation = conversation.accept(first).conversation

    // 바로 다시 넣으면 걸러야 한다
    expect(conversation.accept(first).accepted).toBe(false)
  })
})

describe('두 폰의 시계가 어긋나도', () => {
  it('내 화면에서 본 순서가 흐트러지지 않는다', async () => {
    // **시차를 넘는 비행에서 실제로 생긴다.** 한쪽이 먼저 시간대를
    // 바꾸면 상대가 보낸 시각이 내 시각보다 앞서거나 뒤선다.
    const [left, right] = wiredTransportPair()

    const android = await WiredDevice.start(ME, left, 1)
    const iphone = await WiredDevice.start(HER, right, 2)
    await left.connect()
    await right.connect()

    // 아이폰 시계를 아홉 시간 뒤로 돌린다
    iphone.clock.set(android.clock.now().getTime() - 9 * 3600 * 1000)

    await android.send(makeText('내가 먼저'))
    await settle()
    await iphone.send(makeText('상대가 나중'))
    await settle()
    await android.send(makeText('내가 마지막'))
    await settle()

    // 안드로이드 화면에서는 받은 시각 기준으로 줄을 선다.
    // 상대 시계가 뒤처져 있어도 순서가 뒤엉키면 안 된다.
    const shown = (await android.stored()).map(m =>
      m.content.kind === 'text' ? m.content.text : '',
    )

    expect(shown).toEqual(['내가 먼저', '상대가 나중', '내가 마지막'])

    await android.close()
    await iphone.close()
  })
})

describe('아무렇게나 주고받아도', () => {
  it('양쪽 대화가 결국 같아진다', async () => {
    // 끊김, 귀 막힘, 인사, 쌓아둔 것 내보내기를 무작위로 섞는다.
    // **실제 비행이 이렇게 생겼다.**
    const rng = new Rng(4242)
    const [left, right] = wiredTransportPair({ splitInto: 5, seed: 99 })

    const android = await WiredDevice.start(ME, left, 1)
    const iphone = await WiredDevice.start(HER, right, 2)
    await left.connect()
    await right.connect()

    let sent = 0

    for (let step = 0; step < 200; step += 1) {
      const who = rng.bool() ? android : iphone
      const link = who === android ? left : right
      const other = who === android ? right : left

      const action = rng.int(10)

      if (action < 6) {
        await who.send(makeText(`${step}번째 말 🛫`))
        sent += 1
      } else if (action === 6) {
        link.loseSignal()
        other.loseSignal()
      } else if (action === 7) {
        await link.connect()
        await other.connect()
      } else if (action === 8) {
        other.deafen()
      } else {
        other.listen()
      }

      await settle()
    }

    // 마지막에는 붙어서 서로 인사하고 쌓인 것을 내보낸다.
    // 실제 앱도 다시 붙으면 이렇게 한다.
    left.listen()
    right.listen()
    await left.connect()
    await right.connect()

    for (let round = 0; round < 3; round += 1) {
      await android.greet()
      await settle()
      await iphone.greet()
      await settle()
      await android.flushPending()
      await settle()
      await iphone.flushPending()
      await settle()
    }

    // **양쪽이 보낸 것을 다 갖고 있어야 한다**
    expect(await android.count()).toBe(sent)
    expect(await iphone.count()).toBe(sent)

    // 형식 검사에 걸린 것이 하나도 없어야 한다
    expect(android.transport.rejected).toEqual([])
    expect(iphone.transport.rejected).toEqual([])

    await android.close()
    await iphone.close()
  }, 120_000)
})
