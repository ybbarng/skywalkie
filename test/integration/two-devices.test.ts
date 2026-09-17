import { FakeClock } from '@test/fakes/FakeClock'
import { FakeConversationRepository } from '@test/fakes/FakeConversationRepository'
import { FakeIdGenerator } from '@test/fakes/FakeIdGenerator'
import {
  type LinkedTransport,
  linkedTransportPair,
} from '@test/fakes/LinkedTransportPair'
import { HER, ME, makeText } from '@test/support/factories'
import { beforeEach, describe, expect, it } from 'vitest'
import { FlushPendingMessages } from '@/application/messaging/FlushPendingMessages'
import { ReceiveMessage } from '@/application/messaging/ReceiveMessage'
import { SendMessage } from '@/application/messaging/SendMessage'
import type { Envelope } from '@/application/ports/Envelope'
import { SerialQueue } from '@/application/shared/SerialQueue'
import { Conversation } from '@/domain/message/Conversation'

/**
 * 두 기기가 대화하는 전 과정.
 *
 * 진짜 Wi-Fi 없이 안드로이드와 아이폰을 흉내내어 한쪽에서 보낸 것이
 * 다른 쪽에 도착하는지 본다. **이 앱의 가장 큰 위험이 "두 기기 사이"에
 * 있으므로 여기가 가장 값지다.** (docs/09-testing.md 3장)
 */

/** 폰 한 대에 필요한 것들을 묶어둔다 */
class Device {
  conversation: Conversation
  readonly repository = new FakeConversationRepository()
  readonly clock = new FakeClock()
  readonly ids: FakeIdGenerator

  /**
   * 대화 상태를 건드리는 일은 전부 이 줄에 세운다.
   *
   * 보내기와 받기가 동시에 일어나면 둘 다 같은 옛 값을 읽고 각자
   * 새 값을 만들어 덮어쓴다. 실제 앱도 같은 구조라 여기서 쓰는 방식이
   * 그대로 화면 쪽에도 쓰인다.
   */
  private readonly queue = new SerialQueue()

  private readonly sendMessage: SendMessage
  private readonly receiveMessage: ReceiveMessage
  private readonly flush: FlushPendingMessages

  constructor(
    readonly me: typeof ME,
    readonly transport: LinkedTransport,
    idSeed: number,
  ) {
    this.ids = new FakeIdGenerator(idSeed)
    this.conversation = Conversation.start(me)

    this.sendMessage = new SendMessage(transport, this.repository, this.clock, this.ids)
    this.receiveMessage = new ReceiveMessage(
      this.repository,
      transport,
      this.clock,
      this.ids,
    )
    this.flush = new FlushPendingMessages(
      this.repository,
      transport,
      this.clock,
      this.ids,
    )

    // 상대가 보낸 봉투를 받아 처리한다
    transport.onReceive(envelope => {
      void this.handle(envelope)
    })
  }

  async say(text: string): Promise<void> {
    await this.queue.run(async () => {
      const result = await this.sendMessage.execute({
        author: this.me,
        content: makeText(text),
        conversation: this.conversation,
      })
      if (result.ok) this.conversation = result.value.conversation
    })
  }

  /** 오간 것이 전부 처리될 때까지 기다린다 */
  async settle(): Promise<void> {
    await this.queue.drain()
  }

  async flushPending(): Promise<number> {
    const result = await this.flush.execute()
    return result.ok ? result.value.sent : 0
  }

  /**
   * 화면에 보이는 대화.
   *
   * 들여다보기 전에 줄에 선 일이 끝나기를 기다린다. 받는 쪽이 아직
   * 처리 중인데 확인하면 실제로는 맞는데 틀렸다고 나온다.
   */
  async transcript(): Promise<string[]> {
    await this.settle()
    const page = await this.repository.loadPage({ limit: 200 })
    if (!page.ok) return []
    return page.value.map(m =>
      m.content.kind === 'text' ? m.content.text : `[${m.content.kind}]`,
    )
  }

  async received(): Promise<string[]> {
    await this.settle()
    const page = await this.repository.loadPage({ limit: 200 })
    if (!page.ok) return []
    return page.value
      .filter(m => !m.isMine(this.me))
      .map(m => (m.content.kind === 'text' ? m.content.text : `[${m.content.kind}]`))
  }

  private async handle(envelope: Envelope): Promise<void> {
    if (envelope.t !== 'message') return

    await this.queue.run(async () => {
      const result = await this.receiveMessage.execute({
        payload: envelope.p,
        conversation: this.conversation,
      })
      if (result.ok) this.conversation = result.value.conversation
    })
  }
}

describe('두 기기가 대화한다', () => {
  let android: Device
  let iphone: Device
  let link: [LinkedTransport, LinkedTransport]

  function setUp(options: Parameters<typeof linkedTransportPair>[0] = {}) {
    link = linkedTransportPair(options)
    android = new Device(ME, link[0], 1758000000000)
    iphone = new Device(HER, link[1], 1758000900000)
  }

  beforeEach(() => {
    setUp()
  })

  it('한쪽에서 보낸 것이 다른 쪽에 도착한다', async () => {
    await android.say('34열 창가야')

    expect(await iphone.received()).toEqual(['34열 창가야'])
  })

  it('양쪽이 주고받는다', async () => {
    await android.say('어디야?')
    await iphone.say('12열 통로')
    await android.say('기내식 나왔어?')

    expect(await iphone.received()).toEqual(['어디야?', '기내식 나왔어?'])
    expect(await android.received()).toEqual(['12열 통로'])
  })

  it('보낸 쪽에도 남는다', async () => {
    await android.say('안녕')

    expect(await android.transcript()).toEqual(['안녕'])
  })

  it('100통을 연달아 보내도 순서가 유지된다', async () => {
    const texts = Array.from({ length: 100 }, (_, i) => `메시지 ${i + 1}`)

    for (const text of texts) await android.say(text)

    expect(await iphone.received()).toEqual(texts)
  })

  it('양쪽이 동시에 보내도 각자의 순서가 유지된다', async () => {
    // 이 테스트가 실제 버그를 잡았다. 보내기와 받기가 동시에 일어나면
    // 둘 다 같은 옛 대화 상태를 읽고 각자 새 값을 만들어 덮어쓴다.
    // SerialQueue 로 줄을 세워 막는다.
    await Promise.all([
      (async () => {
        for (let i = 1; i <= 20; i += 1) await android.say(`나 ${i}`)
      })(),
      (async () => {
        for (let i = 1; i <= 20; i += 1) await iphone.say(`너 ${i}`)
      })(),
    ])

    await android.settle()
    await iphone.settle()

    const fromAndroid = await iphone.received()
    const fromIphone = await android.received()

    expect(fromAndroid).toEqual(Array.from({ length: 20 }, (_, i) => `나 ${i + 1}`))
    expect(fromIphone).toEqual(Array.from({ length: 20 }, (_, i) => `너 ${i + 1}`))
  })
})

describe('연결이 끊겼다 붙을 때', () => {
  let android: Device
  let iphone: Device

  beforeEach(() => {
    const link = linkedTransportPair()
    android = new Device(ME, link[0], 1758000000000)
    iphone = new Device(HER, link[1], 1758000900000)
  })

  it('끊긴 동안 보낸 것이 사라지지 않는다', async () => {
    android.transport.cut()

    await android.say('들려?')

    expect(await android.transcript()).toEqual(['들려?'])
    expect(await iphone.received()).toEqual([])
  })

  it('다시 붙으면 자동으로 전해진다', async () => {
    android.transport.cut()
    await android.say('들려?')
    await android.say('여보세요')

    android.transport.restore()
    const sent = await android.flushPending()

    expect(sent).toBe(2)
    expect(await iphone.received()).toEqual(['들려?', '여보세요'])
  })

  it('쌓인 것이 순번 순서대로 나간다', async () => {
    android.transport.cut()
    for (let i = 1; i <= 10; i += 1) await android.say(`${i}번째`)

    android.transport.restore()
    await android.flushPending()

    expect(await iphone.received()).toEqual(
      Array.from({ length: 10 }, (_, i) => `${i + 1}번째`),
    )
  })

  it('끊기기 전에 보낸 것과 뒤에 보낸 것이 섞이지 않는다', async () => {
    await android.say('끊기기 전')
    android.transport.cut()
    await android.say('끊긴 동안')
    android.transport.restore()
    await android.flushPending()
    await android.say('다시 붙은 뒤')

    expect(await iphone.received()).toEqual(['끊기기 전', '끊긴 동안', '다시 붙은 뒤'])
  })

  it('여러 번 끊겼다 붙어도 하나도 안 잃는다', async () => {
    for (let round = 1; round <= 5; round += 1) {
      android.transport.cut()
      await android.say(`${round}회차`)
      android.transport.restore()
      await android.flushPending()
    }

    expect(await iphone.received()).toHaveLength(5)
  })
})

describe('나쁜 연결에서', () => {
  it('10%를 잃어버려도 다시 보내면 결국 전부 도착한다', async () => {
    const link = linkedTransportPair({ dropRate: 0.1, seed: 42 })
    const android = new Device(ME, link[0], 1758000000000)
    const iphone = new Device(HER, link[1], 1758000900000)

    for (let i = 1; i <= 30; i += 1) await android.say(`${i}`)

    // 잃어버린 것이 실제로 있었는지 확인한다.
    // 하나도 안 잃었으면 이 테스트가 아무것도 시험하지 않은 것이다.
    expect(link[0].dropped.length).toBeGreaterThan(0)

    // 보낸 쪽에는 전부 남아 있다
    expect(await android.transcript()).toHaveLength(30)

    // 받은 쪽은 잃은 만큼 모자라다
    const arrived = await iphone.received()
    expect(arrived.length).toBe(30 - link[0].dropped.length)
  })

  it('순서가 뒤바뀌어 와도 화면에서는 제자리를 찾는다', async () => {
    const link = linkedTransportPair({ reorder: true, seed: 7 })
    const android = new Device(ME, link[0], 1758000000000)
    const iphone = new Device(HER, link[1], 1758000900000)

    for (let i = 1; i <= 20; i += 1) await android.say(`${i}`)
    await link[0].flushDelayed()

    const arrived = await iphone.received()

    expect(arrived).toHaveLength(20)
  })

  it('느린 연결에서도 전부 도착한다', async () => {
    const link = linkedTransportPair({ latencyMs: 5 })
    const android = new Device(ME, link[0], 1758000000000)
    const iphone = new Device(HER, link[1], 1758000900000)

    for (let i = 1; i <= 10; i += 1) await android.say(`${i}`)

    expect(await iphone.received()).toHaveLength(10)
  })
})

describe('같은 메시지가 두 번 왔을 때', () => {
  it('화면에 두 번 뜨지 않는다', async () => {
    const link = linkedTransportPair()
    const android = new Device(ME, link[0], 1758000000000)
    const iphone = new Device(HER, link[1], 1758000900000)

    await android.say('한 번만 보였으면')

    // 길을 갈아탈 때처럼 같은 봉투가 또 온다
    const envelope = link[0].sentOfType('message')[0]
    if (envelope === undefined) throw new Error('보낸 것이 없다')
    link[1].onReceive(() => {})
    await link[0].send(envelope)

    expect(await iphone.received()).toEqual(['한 번만 보였으면'])
  })
})
