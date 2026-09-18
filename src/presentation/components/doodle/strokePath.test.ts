import { describe, expect, it } from 'vitest'
import type { Stroke } from '@/domain/message/MessageContent'
import { PLAYBACK_MS, strokesAt, thin, toRatio, toSvgPath } from './strokePath'

/**
 * 낙서의 선.
 *
 * **좌표는 0~1 비율이다.** 아이폰과 안드로이드는 화면 비율이 달라서
 * 픽셀로 담으면 상대 화면에서 그림이 어긋난다.
 */

function stroke(count: number, color = 'me'): Stroke {
  return {
    points: Array.from({ length: count }, (_, i) => ({ x: i / count, y: 0.5 })),
    color,
    width: 3,
  }
}

describe('화면 좌표를 비율로', () => {
  it('가운데는 0.5 다', () => {
    expect(toRatio(200, 150, 400, 300)).toEqual({ x: 0.5, y: 0.5 })
  })

  it('밖으로 나간 손가락은 가장자리로 붙인다', () => {
    // 그리다 화면 밖으로 나가는 일이 흔하다.
    // 0~1 을 벗어난 값은 상대 화면 밖에 그려져 아무것도 안 보인다.
    expect(toRatio(-50, 400, 400, 300)).toEqual({ x: 0, y: 1 })
  })

  it('크기를 모를 때도 터지지 않는다', () => {
    expect(toRatio(10, 10, 0, 0)).toEqual({ x: 0, y: 0 })
  })
})

describe('SVG 길 만들기', () => {
  it('빈 선은 빈 길이다', () => {
    expect(toSvgPath([], 100, 100)).toBe('')
  })

  it('톡 찍은 점도 그린다', () => {
    // 점 하나도 그림의 일부다. 버리면 찍은 게 사라진다.
    const path = toSvgPath([{ x: 0.5, y: 0.5 }], 200, 200)

    expect(path).toContain('M100.0 100.0')
  })

  it('비율을 실제 크기로 옮긴다', () => {
    const path = toSvgPath(
      [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      300,
      200,
    )

    expect(path).toContain('M0.0 0.0')
    expect(path).toContain('300.0 200.0')
  })

  it('각지지 않게 곡선으로 잇는다', () => {
    // 손으로 그린 선은 점이 촘촘해서 직선으로 이으면 각져 보인다
    const path = toSvgPath(
      [
        { x: 0, y: 0 },
        { x: 0.5, y: 0.2 },
        { x: 1, y: 0 },
      ],
      100,
      100,
    )

    expect(path).toContain('Q')
  })
})

describe('점 솎아내기', () => {
  it('거의 같은 자리는 버린다', () => {
    // **손가락 하나를 긋는 동안 수백 개가 쌓인다.**
    // 그대로 보내면 봉투가 커지고 그리기도 느려진다.
    const points = Array.from({ length: 100 }, () => ({ x: 0.5, y: 0.5 }))

    expect(thin(points).length).toBeLessThan(5)
  })

  it('떨어진 점은 남긴다', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 0.3, y: 0.3 },
      { x: 0.6, y: 0.6 },
      { x: 1, y: 1 },
    ]

    expect(thin(points)).toHaveLength(4)
  })

  it('첫 점과 끝 점은 늘 남긴다', () => {
    // 끝 점을 버리면 선 끝이 잘린다
    const points = [
      { x: 0, y: 0 },
      { x: 0.0001, y: 0 },
      { x: 0.0002, y: 0 },
      { x: 1, y: 1 },
    ]

    const kept = thin(points)

    expect(kept[0]).toEqual({ x: 0, y: 0 })
    expect(kept[kept.length - 1]).toEqual({ x: 1, y: 1 })
  })

  it('짧은 선은 그대로 둔다', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]

    expect(thin(points)).toEqual(points)
  })
})

describe('그려지는 과정 재생', () => {
  const strokes = [stroke(10), stroke(10), stroke(10)]

  it('처음에는 아무것도 없다', () => {
    expect(strokesAt(strokes, 0)).toEqual([])
  })

  it('끝나면 전부 나온다', () => {
    expect(strokesAt(strokes, 1)).toHaveLength(3)
  })

  it('중간에는 일부만 나온다', () => {
    const drawn = strokesAt(strokes, 0.5)
    const points = drawn.reduce((sum, s) => sum + s.points.length, 0)

    expect(points).toBe(15)
  })

  it('선 하나를 그리다 만 모습도 나온다', () => {
    // 선 단위로만 나오면 뚝뚝 끊겨 보인다
    const drawn = strokesAt(strokes, 0.5)

    expect(drawn).toHaveLength(2)
    expect(drawn[1]?.points).toHaveLength(5)
  })

  it('선이 몇 개든 같은 시간에 끝난다', () => {
    // **선이 많다고 오래 걸리면 기다리다 지친다**
    const many = Array.from({ length: 50 }, () => stroke(20))

    expect(strokesAt(many, 1)).toHaveLength(50)
    expect(strokesAt(many, 0)).toHaveLength(0)
  })

  it('색과 굵기는 그대로 간다', () => {
    const colored = [stroke(10, 'peer')]

    expect(strokesAt(colored, 0.5)[0]?.color).toBe('peer')
    expect(strokesAt(colored, 0.5)[0]?.width).toBe(3)
  })

  it('빈 낙서도 터지지 않는다', () => {
    expect(strokesAt([], 0.5)).toEqual([])
  })

  it('기다릴 만한 길이다', () => {
    // 너무 길면 답답하고, 너무 짧으면 재생하는 의미가 없다
    expect(PLAYBACK_MS).toBeGreaterThan(500)
    expect(PLAYBACK_MS).toBeLessThan(3000)
  })
})
