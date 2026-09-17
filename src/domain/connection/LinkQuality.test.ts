import { describe, expect, it } from 'vitest'
import {
  canCarryDoodle,
  canCarryPhoto,
  canCarryVideo,
  canCarryVoice,
  capabilityOf,
  linkKinds,
} from './LinkKind'
import { bestOf, LinkQuality, SWITCH_MARGIN, shouldSwitch } from './LinkQuality'

function quality(
  kind: 'wifi' | 'ble' | 'web',
  signal: number,
  latencyMs: number,
  lossRate = 0,
): LinkQuality {
  const result = LinkQuality.of({ kind, signal, latencyMs, lossRate })
  if (!result.ok) throw new Error(`테스트용 품질을 만들지 못했다: ${result.error.detail}`)
  return result.value
}

describe('길이 무엇을 나를 수 있나', () => {
  it('Wi-Fi 는 전부 나른다', () => {
    expect(canCarryVoice('wifi')).toBe(true)
    expect(canCarryVideo('wifi')).toBe(true)
    expect(canCarryDoodle('wifi')).toBe(true)
  })

  it('블루투스로는 목소리를 나를 수 없다', () => {
    // 대역폭이 백분의 일이다
    expect(canCarryVoice('ble')).toBe(false)
    expect(canCarryVideo('ble')).toBe(false)
  })

  it('웹으로도 목소리를 나를 수 없다', () => {
    // 브라우저는 인터넷 없는 환경에서 마이크를 열어주지 않는다
    expect(canCarryVoice('web')).toBe(false)
  })

  it('모든 길이 글은 나른다', () => {
    // 무슨 일이 있어도 글은 주고받을 수 있어야 한다. 그게 이 앱의 바닥이다.
    for (const kind of linkKinds) {
      expect(capabilityOf(kind).text).toBe(true)
    }
  })

  it('목소리를 나르는 길은 영상도 나른다', () => {
    for (const kind of linkKinds) {
      if (canCarryVoice(kind)) expect(canCarryVideo(kind)).toBe(true)
    }
  })

  it('낙서와 사진은 Wi-Fi 에서만 보낸다', () => {
    expect(canCarryDoodle('wifi')).toBe(true)
    expect(canCarryPhoto('wifi')).toBe(true)
    expect(canCarryDoodle('ble')).toBe(false)
    expect(canCarryPhoto('ble')).toBe(false)
  })

  it('블루투스가 Wi-Fi 보다 훨씬 좁다', () => {
    const wifi = capabilityOf('wifi').roughBytesPerSecond
    const ble = capabilityOf('ble').roughBytesPerSecond

    expect(ble * 100).toBeLessThan(wifi)
  })
})

describe('값 검사', () => {
  it.each([
    ['신호가 1을 넘으면', 1.5, 50, 0],
    ['신호가 음수면', -0.1, 50, 0],
    ['응답 시간이 음수면', 1, -10, 0],
    ['유실률이 1을 넘으면', 1, 50, 1.5],
  ])('%s 거절한다', (_label, signal, latencyMs, lossRate) => {
    const result = LinkQuality.of({ kind: 'wifi', signal, latencyMs, lossRate })

    expect(result.ok).toBe(false)
  })

  it('아직 재보지 않았으면 일단 좋다고 본다', () => {
    const unknown = LinkQuality.unknown('wifi')

    expect(unknown.factor()).toBe(1)
  })
})

describe('점수', () => {
  it('좋은 Wi-Fi 가 좋은 블루투스보다 높다', () => {
    const wifi = quality('wifi', 1, 20)
    const ble = quality('ble', 1, 20)

    expect(wifi.score()).toBeGreaterThan(ble.score())
  })

  it('신호가 약하면 점수가 깎인다', () => {
    const strong = quality('wifi', 1, 50)
    const weak = quality('wifi', 0.2, 50)

    expect(weak.score()).toBeLessThan(strong.score())
  })

  it('응답이 느리면 점수가 깎인다', () => {
    const fast = quality('wifi', 1, 20)
    const slow = quality('wifi', 1, 1500)

    expect(slow.score()).toBeLessThan(fast.score())
  })

  it('많이 잃어버리면 점수가 깎인다', () => {
    const clean = quality('wifi', 1, 50, 0)
    const lossy = quality('wifi', 1, 50, 0.5)

    expect(lossy.score()).toBeLessThan(clean.score())
  })

  it('아무리 나빠도 점수가 0이 되지는 않는다', () => {
    // 느리더라도 연결은 살아 있다. 아예 못 쓴다고 판단하면 안 된다.
    const terrible = quality('wifi', 0, 5000, 1)

    expect(terrible.score()).toBeGreaterThan(0)
  })

  it('아주 나쁜 Wi-Fi 가 멀쩡한 블루투스보다 낮아질 수 있다', () => {
    const badWifi = quality('wifi', 0, 5000, 1)
    const goodBle = quality('ble', 1, 30)

    expect(badWifi.score()).toBeLessThan(goodBle.score())
  })
})

describe('길 갈아타기 판단', () => {
  it('점수가 충분히 높으면 갈아탄다', () => {
    const current = quality('ble', 1, 30)
    const candidate = quality('wifi', 1, 20)

    expect(shouldSwitch(current, candidate)).toBe(true)
  })

  it('점수가 비슷하면 갈아타지 않는다', () => {
    // 안 그러면 두 길 사이를 계속 오간다
    const current = quality('wifi', 1, 50)
    const candidate = quality('wifi', 0.98, 55)

    expect(shouldSwitch(current, candidate)).toBe(false)
  })

  it('점수가 더 낮으면 갈아타지 않는다', () => {
    const current = quality('wifi', 1, 20)
    const candidate = quality('ble', 1, 20)

    expect(shouldSwitch(current, candidate)).toBe(false)
  })

  it(`차이가 ${SWITCH_MARGIN}점 미만이면 버틴다`, () => {
    const current = quality('ble', 1, 20)
    const candidate = quality('wifi', 0.3, 1900, 0.9)

    const gap = candidate.score() - current.score()

    expect(gap).toBeLessThan(SWITCH_MARGIN)
    expect(shouldSwitch(current, candidate)).toBe(false)
  })

  it('왔다 갔다 하는 상황을 만들어도 한 번만 갈아탄다', () => {
    const ble = quality('ble', 1, 30)
    const wifi = quality('wifi', 1, 25)

    // 블루투스 → Wi-Fi 로는 간다
    expect(shouldSwitch(ble, wifi)).toBe(true)
    // 그 뒤에 다시 블루투스로 돌아가지 않는다
    expect(shouldSwitch(wifi, ble)).toBe(false)
  })
})

describe('가장 좋은 길 고르기', () => {
  it('점수가 가장 높은 것을 고른다', () => {
    const wifi = quality('wifi', 1, 20)
    const ble = quality('ble', 1, 20)
    const web = quality('web', 1, 20)

    expect(bestOf([ble, wifi, web])).toBe(wifi)
  })

  it('후보가 없으면 없다고 한다', () => {
    expect(bestOf([])).toBeNull()
  })

  it('하나뿐이면 그것을 고른다', () => {
    const ble = quality('ble', 1, 20)

    expect(bestOf([ble])).toBe(ble)
  })
})

describe('통화를 실을 만한가', () => {
  it('빠르고 깨끗하면 목소리를 실을 수 있다', () => {
    expect(quality('wifi', 1, 30).isGoodEnoughForVoice()).toBe(true)
  })

  it('응답이 0.4초를 넘으면 목소리를 싣지 않는다', () => {
    expect(quality('wifi', 1, 500).isGoodEnoughForVoice()).toBe(false)
  })

  it('많이 잃어버리면 목소리를 싣지 않는다', () => {
    expect(quality('wifi', 1, 50, 0.2).isGoodEnoughForVoice()).toBe(false)
  })

  it('영상은 목소리보다 까다롭다', () => {
    // 응답과 유실은 아슬아슬하게 통과하지만 신호가 약한 상태.
    // 목소리는 실을 만해도 영상은 끊긴다.
    const marginal = quality('wifi', 0, 399, 0.09)

    expect(marginal.isGoodEnoughForVoice()).toBe(true)
    expect(marginal.isGoodEnoughForVideo()).toBe(false)
  })
})

describe('사람에게 보여줄 등급', () => {
  it.each([
    ['좋음', 1, 20, 0, 'good'],
    ['보통', 0.6, 500, 0.05, 'fair'],
    ['나쁨', 0.1, 1800, 0.4, 'poor'],
  ] as const)('%s 상태는 %s', (_label, signal, latency, loss, expected) => {
    // 숫자 대신 이걸 화면에 띄운다. 23밀리초가 좋은 건지 나쁜 건지 모른다.
    expect(quality('wifi', signal, latency, loss).grade()).toBe(expected)
  })
})
