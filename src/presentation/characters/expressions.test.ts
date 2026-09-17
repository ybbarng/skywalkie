import { describe, expect, it } from 'vitest'
import { expressions } from '@/domain/peer/Character'
import {
  BLINK_DURATION_MS,
  blinkAmount,
  nextBlinkGap,
  shapeFor,
  shapeWhileSpeaking,
  smoothLevel,
} from './expressions'

describe('표정마다 얼굴이 다르다', () => {
  it.each(expressions)('%s 표정에 값이 있다', expression => {
    const shape = shapeFor(expression)

    expect(shape.eyeOpen).toBeGreaterThanOrEqual(0)
    expect(shape.mouthOpen).toBeGreaterThanOrEqual(0)
  })

  it('자는 표정은 눈을 감는다', () => {
    expect(shapeFor('sleeping').eyeOpen).toBe(0)
  })

  it('끊긴 표정은 회색이 되고 입꼬리가 내려간다', () => {
    // 글씨를 안 읽어도 뭔가 잘못됐다는 걸 알 수 있어야 한다
    const shape = shapeFor('disconnected')

    expect(shape.desaturate).toBe(1)
    expect(shape.mouthCurve).toBeLessThan(0)
  })

  it('듣는 표정은 고개를 기울인다', () => {
    expect(shapeFor('listening').tiltDegrees).not.toBe(0)
  })

  it('보통 표정은 눈을 뜨고 살짝 웃는다', () => {
    const shape = shapeFor('idle')

    expect(shape.eyeOpen).toBe(1)
    expect(shape.mouthCurve).toBeGreaterThan(0)
    expect(shape.desaturate).toBe(0)
  })

  it('표정마다 서로 구분된다', () => {
    // 두 표정이 똑같으면 상태가 바뀌어도 화면이 안 변한다
    const seen = new Set(expressions.map(e => JSON.stringify(shapeFor(e))))

    expect(seen.size).toBe(expressions.length)
  })
})

describe('말할 때 입 모양', () => {
  it('소리가 클수록 입이 많이 벌어진다', () => {
    const quiet = shapeWhileSpeaking(0.1)
    const loud = shapeWhileSpeaking(0.9)

    expect(loud.mouthOpen).toBeGreaterThan(quiet.mouthOpen)
  })

  it('소리가 없어도 입을 완전히 다물지 않는다', () => {
    // 사람은 말하는 중에 잠깐 쉴 때도 입이 조금 열려 있다
    expect(shapeWhileSpeaking(0).mouthOpen).toBeGreaterThan(0)
  })

  it('가장 클 때도 입이 턱없이 벌어지지 않는다', () => {
    expect(shapeWhileSpeaking(1).mouthOpen).toBeLessThan(1)
  })

  it.each([
    ['1을 넘으면', 5],
    ['음수면', -3],
    ['숫자가 아니면', Number.NaN],
  ])('소리 크기가 %s 깨지지 않는다', (_label, level) => {
    const shape = shapeWhileSpeaking(level)

    expect(shape.mouthOpen).toBeGreaterThanOrEqual(0)
    expect(shape.mouthOpen).toBeLessThanOrEqual(1)
  })
})

describe('입 움직임 부드럽게 하기', () => {
  it('목표 값을 향해 움직인다', () => {
    const next = smoothLevel(0, 1)

    expect(next).toBeGreaterThan(0)
    expect(next).toBeLessThan(1)
  })

  it('여러 프레임을 거치면 목표에 닿는다', () => {
    let value = 0
    for (let frame = 0; frame < 30; frame += 1) value = smoothLevel(value, 1)

    expect(value).toBeGreaterThan(0.99)
  })

  it('벌릴 때가 다물 때보다 빠르다', () => {
    // 말과 입이 맞으려면 벌리는 건 빨라야 하고,
    // 다무는 건 천천히여야 자연스럽다
    const opening = smoothLevel(0, 1) - 0
    const closing = 1 - smoothLevel(1, 0)

    expect(opening).toBeGreaterThan(closing)
  })

  it('한 프레임에 끝까지 가지 않는다', () => {
    // 그러면 부드럽게 만드는 의미가 없다
    expect(smoothLevel(0, 1)).toBeLessThan(1)
  })

  it.each([
    ['지난 값이 범위 밖이면', 5, 0.5],
    ['목표가 범위 밖이면', 0.5, -2],
    ['숫자가 아니면', Number.NaN, 0.5],
  ])('%s 0과 1 사이에 머문다', (_label, previous, target) => {
    const next = smoothLevel(previous, target)

    expect(next).toBeGreaterThanOrEqual(0)
    expect(next).toBeLessThanOrEqual(1)
  })

  it('들쭉날쭉한 소리에도 값이 튀지 않는다', () => {
    // 실제 소리는 한 프레임마다 크게 오르내린다
    const noisy = [0.9, 0.1, 0.8, 0.05, 0.95, 0.2]
    let value = 0
    let biggestJump = 0

    for (const level of noisy) {
      const next = smoothLevel(value, level)
      biggestJump = Math.max(biggestJump, Math.abs(next - value))
      value = next
    }

    expect(biggestJump).toBeLessThan(0.6)
  })
})

describe('눈 깜빡임', () => {
  it('기다리는 동안에는 눈을 뜨고 있다', () => {
    expect(blinkAmount(1000, 4000)).toBe(1)
  })

  it('때가 되면 감았다 뜬다', () => {
    const half = blinkAmount(4000 + BLINK_DURATION_MS / 2, 4000)

    expect(half).toBeLessThan(0.2)
  })

  it('깜빡임이 끝나면 다시 뜬다', () => {
    expect(blinkAmount(4000 + BLINK_DURATION_MS, 4000)).toBe(1)
  })

  it('감았다 뜨는 게 순식간이다', () => {
    // 오래 감고 있으면 조는 것처럼 보인다
    expect(BLINK_DURATION_MS).toBeLessThan(300)
  })

  it('깜빡이는 간격이 규칙적이지 않다', () => {
    // 규칙적으로 깜빡이면 기계처럼 보인다
    const random = seededRandom(7)
    const gaps = Array.from({ length: 20 }, () => nextBlinkGap(random))

    expect(new Set(gaps).size).toBeGreaterThan(15)
  })

  it('간격이 사람이 깜빡이는 정도다', () => {
    const random = seededRandom(7)

    for (let i = 0; i < 50; i += 1) {
      const gap = nextBlinkGap(random)
      expect(gap).toBeGreaterThanOrEqual(3000)
      expect(gap).toBeLessThanOrEqual(6000)
    }
  })
})

function seededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}
