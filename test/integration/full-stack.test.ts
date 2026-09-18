import { HER, ME, makeText } from '@test/support/factories'
import { WiredDevice } from '@test/support/WiredDevice'
import { wiredTransportPair } from '@test/support/WiredTransportPair'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  doodleContent,
  type MessageContent,
  nudgeContent,
  stickerContent,
  textContent,
} from '@/domain/message/MessageContent'

/**
 * 두 기기가 **진짜 부품으로** 대화한다.
 *
 * 실제 SQLite 를 열고, 실제 SQL 로 읽고 쓰고, 오가는 것은 실제 봉투
 * 형식과 바이트 자르기를 거친다. 기기와 Wi-Fi 만 흉내 낸다.
 *
 * **여기서 통과하면 남은 위험은 기기뿐이다.**
 *
 * (docs/09-testing.md 3장)
 */

function must<T>(result: { ok: boolean; value?: T }): T {
  if (!result.ok) throw new Error('만들지 못했다')
  return result.value as T
}

/**
 * 오가던 일이 다 끝나기를 기다린다.
 *
 * **받는 쪽 처리가 비동기다.** 봉투가 도착해도 저장까지는 몇 단계
 * 더 간다. 기다리지 않고 세면 아직 안 들어온 것을 못 봤다고 한다.
 *
 * 실제 앱에서는 사람이 기다리므로 문제가 안 되지만, 시험에서는
 * 여기를 빠뜨리면 **있지도 않은 버그를 봤다고 하거나 있는 버그를
 * 놓친다.**
 */
async function sendAndSettle(
  device: WiredDevice,
  content: MessageContent,
): Promise<void> {
  await device.send(content)
  await settle()
}

async function settle(): Promise<void> {
  for (let i = 0; i < 20; i += 1) {
    await new Promise(resolve => setTimeout(resolve, 0))
  }
}

describe('두 기기가 진짜 부품으로 대화한다', () => {
  let android: WiredDevice
  let iphone: WiredDevice

  beforeEach(async () => {
    const [left, right] = wiredTransportPair()

    android = await WiredDevice.start(ME, left, 1, '나')
    iphone = await WiredDevice.start(HER, right, 2, '지민')

    await left.connect()
    await right.connect()
  })

  afterEach(async () => {
    await android.close()
    await iphone.close()
  })

  it('한쪽에서 보낸 것이 다른 쪽에 남는다', async () => {
    await sendAndSettle(android, makeText('34열 창가야'))

    const arrived = await iphone.stored()

    expect(arrived).toHaveLength(1)
    expect(arrived[0]?.content).toEqual({ kind: 'text', text: '34열 창가야' })
  })

  it('버려진 봉투가 하나도 없다', async () => {
    // **여기 쌓이면 형식 검사에 안 적어둔 것이 있다는 뜻이다.**
    // 보내는 쪽은 잘 보냈다고 믿고 받는 쪽은 말없이 버린다.
    await sendAndSettle(android, makeText('안녕'))
    await sendAndSettle(iphone, makeText('응'))

    expect(android.transport.rejected).toEqual([])
    expect(iphone.transport.rejected).toEqual([])
  })

  it('번갈아 주고받아도 양쪽이 같아진다', async () => {
    for (let i = 0; i < 20; i += 1) {
      await sendAndSettle(android, makeText(`내가 ${i}`))
      await sendAndSettle(iphone, makeText(`상대가 ${i}`))
    }

    expect(await android.count()).toBe(40)
    expect(await iphone.count()).toBe(40)

    const mine = (await android.stored()).map(m => m.id)
    const theirs = (await iphone.stored()).map(m => m.id)

    // **줄 세운 순서까지 같아야 한다.** 다르면 화면이 다르게 보인다.
    expect(mine).toEqual(theirs)
  })

  describe('모든 내용 종류가', () => {
    const kinds: Array<[string, () => MessageContent]> = [
      ['글', () => makeText('기내식 나왔어')],
      ['이모지가 섞인 글', () => makeText('창밖 봐 🛫')],
      ['이모티콘', () => must(stickerContent('aria', 'heart'))],
      [
        '낙서',
        () =>
          must(
            doodleContent([
              {
                points: [
                  { x: 0, y: 0 },
                  { x: 1, y: 1 },
                ],
                color: 'me',
                width: 4,
              },
            ]),
          ),
      ],
      ['콕 찌르기', () => nudgeContent()],
    ]

    it.each(kinds)('%s 이 그대로 건너간다', async (_label, make) => {
      const content = make()

      await sendAndSettle(android, content)

      const arrived = await iphone.stored()
      expect(arrived).toHaveLength(1)
      expect(arrived[0]?.content).toEqual(content)
      expect(iphone.transport.rejected).toEqual([])
    })
  })

  it('아주 긴 글도 건너간다', async () => {
    // 4000자가 한계다. 봉투 하나에 다 들어가야 한다.
    const long = must(textContent('가'.repeat(4000)))

    await sendAndSettle(android, long)

    const arrived = await iphone.stored()
    expect(arrived[0]?.content).toEqual(long)
  })

  it('큰 낙서도 건너간다', async () => {
    // 선 200개, 각 100점. 봉투가 꽤 커진다.
    const strokes = Array.from({ length: 200 }, (_, s) => ({
      points: Array.from({ length: 100 }, (_, p) => ({
        x: (p % 100) / 100,
        y: (s % 100) / 100,
      })),
      color: 'me',
      width: 3,
    }))

    await sendAndSettle(android, must(doodleContent(strokes)))

    expect(await iphone.count()).toBe(1)
    expect(iphone.transport.rejected).toEqual([])
  })
})

describe('바이트가 조각조각 와도', () => {
  it('빠짐없이 이어 붙인다', async () => {
    // **실제 소켓이 이렇게 준다.** 한 번에 다 오지 않는다.
    const [left, right] = wiredTransportPair({ splitInto: 20, seed: 7 })

    const android = await WiredDevice.start(ME, left, 1)
    const iphone = await WiredDevice.start(HER, right, 2)
    await left.connect()
    await right.connect()

    for (let i = 0; i < 30; i += 1) {
      await sendAndSettle(android, makeText(`조각난 채로 온 ${i}번째 말 🛫`))
    }

    expect(await iphone.count()).toBe(30)
    expect(iphone.transport.rejected).toEqual([])

    await android.close()
    await iphone.close()
  })

  it('한 바이트씩 와도 된다', async () => {
    const [left, right] = wiredTransportPair({ splitInto: 10_000, seed: 8 })

    const android = await WiredDevice.start(ME, left, 1)
    const iphone = await WiredDevice.start(HER, right, 2)
    await left.connect()
    await right.connect()

    await sendAndSettle(android, makeText('한 바이트씩 온다 🛬'))

    expect(await iphone.count()).toBe(1)

    await android.close()
    await iphone.close()
  })
})

describe('끊겼다 다시 붙으면', () => {
  it('끊긴 동안 쓴 말이 다시 붙을 때 도착한다', async () => {
    // **이 앱에서 가장 중요한 성질이다.** 비행기에서는 계속 끊긴다.
    const [left, right] = wiredTransportPair()

    const android = await WiredDevice.start(ME, left, 1)
    const iphone = await WiredDevice.start(HER, right, 2)
    await left.connect()
    await right.connect()

    await sendAndSettle(android, makeText('처음 말'))
    expect(await iphone.count()).toBe(1)

    // 끊긴다
    left.loseSignal()
    right.loseSignal()

    await sendAndSettle(android, makeText('끊긴 동안 쓴 말'))
    await sendAndSettle(android, makeText('하나 더'))

    // 상대에게는 아직 안 갔지만 내 폰에는 남아 있다
    expect(await android.count()).toBe(3)
    expect(await iphone.count()).toBe(1)

    // 다시 붙는다
    await left.connect()
    await right.connect()
    await android.flushPending()
    await settle()

    expect(await iphone.count()).toBe(3)

    await android.close()
    await iphone.close()
  })

  it('인사를 주고받으면 서로 놓친 것을 되찾는다', async () => {
    // 양쪽이 동시에 끊긴 채로 각자 쓴 경우다
    const [left, right] = wiredTransportPair()

    const android = await WiredDevice.start(ME, left, 1)
    const iphone = await WiredDevice.start(HER, right, 2)
    await left.connect()
    await right.connect()

    // 서로를 알게 한다
    await sendAndSettle(android, makeText('시작'))
    await sendAndSettle(iphone, makeText('응'))

    left.loseSignal()
    right.loseSignal()

    await sendAndSettle(android, makeText('내가 끊긴 동안 쓴 말'))
    await sendAndSettle(iphone, makeText('내가 끊긴 동안 쓴 말 2'))

    await left.connect()
    await right.connect()

    // 양쪽이 인사한다. 실제 앱도 다시 붙으면 이렇게 한다.
    await android.greet()
    await settle()
    await iphone.greet()
    await settle()
    await android.flushPending()
    await settle()
    await iphone.flushPending()
    await settle()

    // **양쪽 다 네 개를 갖고 있어야 한다**
    expect(await android.count()).toBe(4)
    expect(await iphone.count()).toBe(4)

    await android.close()
    await iphone.close()
  })

  it('여러 번 끊겼다 붙어도 말이 안 사라진다', async () => {
    const [left, right] = wiredTransportPair()

    const android = await WiredDevice.start(ME, left, 1)
    const iphone = await WiredDevice.start(HER, right, 2)
    await left.connect()
    await right.connect()

    let expected = 0

    for (let round = 0; round < 5; round += 1) {
      await sendAndSettle(android, makeText(`${round}번째 붙어 있을 때`))
      expected += 1

      left.loseSignal()
      right.loseSignal()

      await sendAndSettle(android, makeText(`${round}번째 끊긴 동안`))
      expected += 1

      await left.connect()
      await right.connect()
      await android.greet()
      await settle()
      await android.flushPending()
      await settle()
    }

    expect(await android.count()).toBe(expected)
    expect(await iphone.count()).toBe(expected)

    await android.close()
    await iphone.close()
  })
})

describe('보낸 쪽은 갔다고 믿는데 상대가 못 받았을 때', () => {
  /**
   * **이게 가장 무서운 경우다.**
   *
   * 아이폰이 앱을 닫으면 소켓은 잠깐 살아 있는데 처리를 못 한다.
   * 보내는 쪽에서는 성공이라 쌓아두지도 않는다. 그래서 다시 붙어도
   * 쌓아뒀다 보내는 것으로는 영영 못 되찾는다.
   *
   * 놓친 쪽은 **자기가 뭘 놓쳤는지 모른다.** 하나도 못 받았으면
   * 빈틈조차 안 보인다. 그래서 인사할 때 "네 것을 몇 번까지 받았다"를
   * 알려주고, **보낸 쪽이 책임지고** 다시 보낸다.
   */
  it('인사할 때 순번을 맞춰보고 다시 보낸다', async () => {
    const [left, right] = wiredTransportPair()

    const android = await WiredDevice.start(ME, left, 1)
    const iphone = await WiredDevice.start(HER, right, 2)
    await left.connect()
    await right.connect()

    // 서로를 알게 한다
    await sendAndSettle(android, makeText('첫 말'))
    await sendAndSettle(iphone, makeText('응'))
    expect(await iphone.count()).toBe(2)

    // 아이폰이 귀를 막는다. 안드로이드는 잘 갔다고 믿는다.
    right.deafen()

    await sendAndSettle(android, makeText('못 받은 말 1'))
    await sendAndSettle(android, makeText('못 받은 말 2'))
    await sendAndSettle(android, makeText('못 받은 말 3'))

    // 안드로이드는 다 갔다고 안다
    expect(await android.count()).toBe(5)
    expect(await iphone.count()).toBe(2)

    // 쌓아둔 것이 없으므로 flush 로는 아무것도 안 나간다
    expect(await android.flushPending()).toBe(0)
    await settle()
    expect(await iphone.count()).toBe(2)

    // 귀를 열고 인사한다. **여기서 되찾아야 한다.**
    right.listen()
    await iphone.greet()
    await settle()

    expect(await iphone.count()).toBe(5)

    await android.close()
    await iphone.close()
  })

  it('하나도 못 받았어도 되찾는다', async () => {
    // 빈틈조차 안 보이는 경우다. 받는 쪽은 아무것도 모른다.
    const [left, right] = wiredTransportPair()

    const android = await WiredDevice.start(ME, left, 1)
    const iphone = await WiredDevice.start(HER, right, 2)
    await left.connect()
    await right.connect()

    right.deafen()

    for (let i = 0; i < 5; i += 1) {
      await sendAndSettle(android, makeText(`아무도 못 본 ${i}번째 말`))
    }

    expect(await iphone.count()).toBe(0)

    right.listen()
    await iphone.greet()
    await settle()

    expect(await iphone.count()).toBe(5)

    await android.close()
    await iphone.close()
  })

  it('되찾은 뒤에 또 인사해도 두 배가 안 된다', async () => {
    const [left, right] = wiredTransportPair()

    const android = await WiredDevice.start(ME, left, 1)
    const iphone = await WiredDevice.start(HER, right, 2)
    await left.connect()
    await right.connect()

    right.deafen()
    await sendAndSettle(android, makeText('놓친 말'))
    right.listen()

    await iphone.greet()
    await settle()
    expect(await iphone.count()).toBe(1)

    // 다시 붙을 때마다 인사한다. 그때마다 늘면 못 쓴다.
    await iphone.greet()
    await settle()
    await iphone.greet()
    await settle()

    expect(await iphone.count()).toBe(1)

    await android.close()
    await iphone.close()
  })
})

describe('같은 말이 두 번 와도', () => {
  it('두 개로 안 늘어난다', async () => {
    // 다시 붙을 때 상대가 겹쳐 보내는 일이 흔하다
    const [left, right] = wiredTransportPair()

    const android = await WiredDevice.start(ME, left, 1)
    const iphone = await WiredDevice.start(HER, right, 2)
    await left.connect()
    await right.connect()

    await sendAndSettle(android, makeText('한 번만 있어야 한다'))

    // 같은 봉투를 그대로 다시 보낸다
    const [first] = android.transport.sentOfType('message')
    if (first === undefined) throw new Error('보낸 것이 없다')
    await android.transport.send(first)
    await android.transport.send(first)

    expect(await iphone.count()).toBe(1)

    await android.close()
    await iphone.close()
  })
})

describe('읽음 표시가', () => {
  it('상대에게 건너간다', async () => {
    const [left, right] = wiredTransportPair()

    const android = await WiredDevice.start(ME, left, 1)
    const iphone = await WiredDevice.start(HER, right, 2)
    await left.connect()
    await right.connect()

    await sendAndSettle(android, makeText('읽어줘'))
    await iphone.readAll()
    await settle()

    expect(iphone.transport.sentOfType('read').length).toBeGreaterThan(0)
    expect(android.transport.rejected).toEqual([])

    await android.close()
    await iphone.close()
  })
})
