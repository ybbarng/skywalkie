import { describe, expect, it } from 'vitest'
import { stickerPoses } from '@/domain/message/MessageContent'
import {
  armsInFront,
  CHEST_LEFT,
  CHEST_RIGHT,
  limbsFor,
  lookFor,
  SHOULDER_LEFT,
  SHOULDER_RIGHT,
} from './poses'

/**
 * 이모티콘이 제대로 생겼는지.
 *
 * 그림은 눈으로 봐야 알지만, **몸에서 팔이 떨어지는 것**은 좌표로
 * 잡을 수 있다. 예전에 손만 허공에 뜬 자세가 있었다.
 */

describe('자세마다', () => {
  it.each(stickerPoses)('%s 의 생김새가 정해져 있다', pose => {
    const look = lookFor(pose)

    expect(look.eyes.length).toBeGreaterThan(0)
    expect(look.mouth.length).toBeGreaterThan(0)
  })

  it('서로 다르게 생겼다', () => {
    // 두 자세가 똑같이 생기면 하나는 있을 이유가 없다.
    const seen = new Set(
      stickerPoses.map(pose => {
        const look = lookFor(pose)
        return [
          look.eyes,
          look.brows,
          look.mouth,
          look.blush,
          look.hands,
          look.extra,
        ].join('/')
      }),
    )

    expect(seen.size).toBe(stickerPoses.length)
  })

  it.each(stickerPoses)('%s 가 몸을 너무 많이 기울이지 않는다', pose => {
    // 15도를 넘으면 넘어지는 것처럼 보인다.
    expect(Math.abs(lookFor(pose).tiltDegrees)).toBeLessThanOrEqual(15)
  })
})

describe('팔은 몸에 붙어 있다', () => {
  /** `M78 100Q...` 에서 시작점 (78, 100) 을 꺼낸다 */
  function startOf(path: string): { x: number; y: number } {
    const match = /^M\s*(-?[\d.]+)\s+(-?[\d.]+)/.exec(path)
    if (match === null) throw new Error(`시작점을 못 찾았다: ${path}`)
    return { x: Number(match[1]), y: Number(match[2]) }
  }

  function near(a: { x: number; y: number }, b: { x: number; y: number }): number {
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  it.each(stickerPoses)('%s 의 팔이 몸에서 나온다', pose => {
    for (const limb of limbsFor(lookFor(pose).hands)) {
      const start = startOf(limb.path)
      const toBody = Math.min(
        near(start, SHOULDER_LEFT),
        near(start, SHOULDER_RIGHT),
        near(start, CHEST_LEFT),
        near(start, CHEST_RIGHT),
      )

      // 붙는 자리에서 3 이상 떨어져 시작하면 팔이 몸에서 떨어져 보인다.
      expect(toBody).toBeLessThanOrEqual(3)
    }
  })

  it.each(stickerPoses)('%s 에 팔 없는 손이 없다', pose => {
    // 예전에 엄지척과 먹기가 손만 허공에 떠 있었다.
    const limbs = limbsFor(lookFor(pose).hands)

    for (const limb of limbs) {
      expect(limb.path.length).toBeGreaterThan(0)
      expect(limb.hand.r).toBeGreaterThan(0)
    }
  })

  it.each(stickerPoses)('%s 의 손이 그림 밖으로 나가지 않는다', pose => {
    // 120×120 밖으로 나가면 잘린 손이 된다.
    for (const limb of limbsFor(lookFor(pose).hands)) {
      const { x, y, r } = limb.hand

      expect(x - r).toBeGreaterThanOrEqual(0)
      expect(x + r).toBeLessThanOrEqual(120)
      expect(y - r).toBeGreaterThanOrEqual(0)
      expect(y + r).toBeLessThanOrEqual(120)
    }
  })

  it('손이 없는 자세는 팔도 없다', () => {
    expect(limbsFor('none')).toHaveLength(0)
  })
})

describe('손이 얼굴을 가리지 않는다', () => {
  /**
   * 손은 얼굴 위에 그려지고 테두리가 있어 어디에 놓여도 보인다.
   * 문제는 **무엇을 덮느냐**다.
   *
   * 눈을 덮으면 표정이 통째로 사라진다. 눈이 감정을 다 말하는
   * 그림이라 그러면 무슨 자세인지 알 수 없다. 입은 가려도 되는
   * 자세가 있다(무섭다고 입을 막는 것처럼).
   */
  const EYES = [
    { x: 49, y: 57 },
    { x: 71, y: 57 },
  ]

  it.each(stickerPoses)('%s 의 손이 눈을 덮지 않는다', pose => {
    for (const limb of limbsFor(lookFor(pose).hands)) {
      for (const eye of EYES) {
        const gap = Math.hypot(limb.hand.x - eye.x, limb.hand.y - eye.y)
        expect(gap).toBeGreaterThan(limb.hand.r + 4)
      }
    }
  })

  it('가슴을 가로지르는 팔은 얼굴 앞에 그린다', () => {
    // 뒤에 그리면 가운데가 얼굴에 가려 팔이 끊겨 보인다.
    expect(armsInFront('crossed')).toBe(true)
    expect(armsInFront('hugSelf')).toBe(true)
  })

  it('몸 옆으로 뻗는 팔은 얼굴 뒤에 그린다', () => {
    // 앞에 그리면 얼굴을 가로질러 어색해진다.
    expect(armsInFront('waveRight')).toBe(false)
    expect(armsInFront('bothUp')).toBe(false)
    expect(armsInFront('none')).toBe(false)
  })
})
