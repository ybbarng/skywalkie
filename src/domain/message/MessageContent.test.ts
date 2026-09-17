import { describe, expect, it } from 'vitest'
import {
  doodleContent,
  fitsNarrowLink,
  isFromPerson,
  MAX_STROKES,
  MAX_TEXT_LENGTH,
  nudgeContent,
  type Stroke,
  systemContent,
  textContent,
} from './MessageContent'

function stroke(points: Array<[number, number]>): Stroke {
  return {
    points: points.map(([x, y]) => ({ x, y })),
    color: 'me',
    width: 3,
  }
}

describe('글', () => {
  it('보통 메시지를 받아들인다', () => {
    const result = textContent('34열 창가야. 지금 뭐 해?')

    expect(result.ok && result.value.text).toBe('34열 창가야. 지금 뭐 해?')
  })

  it('앞뒤 공백을 떼어낸다', () => {
    const result = textContent('  기내식 나왔어  ')

    expect(result.ok && result.value.text).toBe('기내식 나왔어')
  })

  it('빈 메시지를 거절한다', () => {
    const result = textContent('')

    expect(!result.ok && result.error.code).toBe('empty')
  })

  it('공백만 있는 메시지를 거절한다', () => {
    const result = textContent('   \n  \t ')

    expect(!result.ok && result.error.code).toBe('empty')
  })

  it(`${MAX_TEXT_LENGTH}자까지 받아들인다`, () => {
    const result = textContent('가'.repeat(MAX_TEXT_LENGTH))

    expect(result.ok).toBe(true)
  })

  it('한 자라도 넘으면 거절한다', () => {
    const result = textContent('가'.repeat(MAX_TEXT_LENGTH + 1))

    expect(!result.ok && result.error.code).toBe('too-long')
  })

  it('이모지가 섞여도 받아들인다', () => {
    const result = textContent('창밖 봐 ✈️🌅')

    expect(result.ok).toBe(true)
  })
})

describe('낙서', () => {
  it('선 하나짜리 낙서를 받아들인다', () => {
    const result = doodleContent([
      stroke([
        [0, 0],
        [0.5, 0.5],
        [1, 1],
      ]),
    ])

    expect(result.ok).toBe(true)
  })

  it('빈 낙서를 거절한다', () => {
    const result = doodleContent([])

    expect(!result.ok && result.error.code).toBe('empty')
  })

  it('점이 없는 선을 거절한다', () => {
    const result = doodleContent([stroke([])])

    expect(!result.ok && result.error.code).toBe('empty')
  })

  it.each([
    ['x 가 1을 넘으면', [[1.5, 0.5]]],
    ['y 가 1을 넘으면', [[0.5, 1.5]]],
    ['x 가 음수면', [[-0.1, 0.5]]],
    ['y 가 음수면', [[0.5, -0.1]]],
  ] as const)('%s 거절한다', (_label, points) => {
    // 비율 좌표를 벗어나면 상대 화면 밖에 그려져 아무것도 안 보인다
    const result = doodleContent([stroke([...points] as Array<[number, number]>)])

    expect(!result.ok && result.error.code).toBe('invalid-value')
  })

  it('숫자가 아닌 좌표를 거절한다', () => {
    const result = doodleContent([stroke([[Number.NaN, 0.5]])])

    expect(result.ok).toBe(false)
  })

  it('굵기가 0 이하인 선을 거절한다', () => {
    const result = doodleContent([{ ...stroke([[0, 0]]), width: 0 }])

    expect(!result.ok && result.error.code).toBe('invalid-value')
  })

  it('색 이름이 비어 있으면 거절한다', () => {
    const result = doodleContent([{ ...stroke([[0, 0]]), color: '' }])

    expect(!result.ok && result.error.code).toBe('empty')
  })

  it(`선 ${MAX_STROKES}개까지 받아들인다`, () => {
    const strokes = Array.from({ length: MAX_STROKES }, () =>
      stroke([
        [0, 0],
        [1, 1],
      ]),
    )

    const result = doodleContent(strokes)

    expect(result.ok).toBe(true)
  })

  it('선이 너무 많으면 거절한다', () => {
    const strokes = Array.from({ length: MAX_STROKES + 1 }, () => stroke([[0, 0]]))

    const result = doodleContent(strokes)

    expect(!result.ok && result.error.code).toBe('too-long')
  })

  it('몇 번째 선이 잘못됐는지 알려준다', () => {
    const result = doodleContent([
      stroke([
        [0, 0],
        [1, 1],
      ]),
      stroke([
        [0, 0],
        [1, 1],
      ]),
      stroke([]),
    ])

    expect(!result.ok && result.error.detail).toContain('3번째')
  })
})

describe('내용 묶어 보기', () => {
  it('사람이 보낸 것과 앱이 끼워 넣은 것을 가른다', () => {
    expect(isFromPerson(nudgeContent())).toBe(true)
    expect(isFromPerson(systemContent('link-lost'))).toBe(false)
  })

  it('낙서만 좁은 길로 못 간다', () => {
    const text = textContent('안녕')
    const doodle = doodleContent([
      stroke([
        [0, 0],
        [1, 1],
      ]),
    ])

    expect(text.ok && fitsNarrowLink(text.value)).toBe(true)
    expect(fitsNarrowLink(nudgeContent())).toBe(true)
    expect(doodle.ok && fitsNarrowLink(doodle.value)).toBe(false)
  })
})
