import { describe, expect, it } from 'vitest'
import { type ColorTokens, darkColors, lightColors } from './colors'
import { contrastRatio, hueDistance } from './contrast'

/**
 * 색을 바꿀 때 눈대중으로 판단하지 않기 위한 테스트.
 * 어두운 기내에서 화면 밝기를 낮춰도 읽혀야 한다.
 */

/** 본문 글자에 요구하는 대비 */
const BODY = 4.5
/** 장식이나 보조 정보에 요구하는 대비 */
const DECORATIVE = 3

const themes: Array<[name: string, colors: ColorTokens]> = [
  ['어두운 화면', darkColors],
  ['밝은 화면', lightColors],
]

describe.each(themes)('%s 색 대비', (_name, colors) => {
  const bodyPairs: Array<[label: string, fg: string, bg: string]> = [
    ['본문 글자 / 화면 바탕', colors.text, colors.bg],
    ['본문 글자 / 카드', colors.text, colors.surface],
    ['본문 글자 / 떠 있는 것', colors.text, colors.surfaceRaised],
    ['보조 글자 / 화면 바탕', colors.textMuted, colors.bg],
    ['보조 글자 / 카드', colors.textMuted, colors.surface],
    ['내 말풍선 글자 / 내 말풍선', colors.meText, colors.me],
    ['상대 말풍선 글자 / 상대 말풍선', colors.peerText, colors.peer],
  ]

  it.each(bodyPairs)('%s 대비가 4.5 이상이다', (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(BODY)
  })

  it('아주 옅은 글자도 화면 바탕 위에서 알아볼 수 있다', () => {
    expect(contrastRatio(colors.textFaint, colors.bg)).toBeGreaterThanOrEqual(DECORATIVE)
  })

  it('경계선이 바탕과 구분된다', () => {
    // 경계선은 글자가 아니라 장식이다. 있다는 걸 알아볼 정도면 된다.
    // 여기에 글자와 같은 기준을 들이대면 선이 지나치게 진해져서
    // 어두운 화면이 그물처럼 보인다.
    expect(contrastRatio(colors.border, colors.bg)).toBeGreaterThanOrEqual(1.1)
  })

  const statePairs: Array<[label: string, fg: string]> = [
    ['연결됨', colors.success],
    ['주의', colors.warning],
    ['끊김', colors.danger],
  ]

  it.each(statePairs)('상태 색 "%s" 이 화면 바탕 위에서 읽힌다', (_label, fg) => {
    expect(contrastRatio(fg, colors.bg)).toBeGreaterThanOrEqual(DECORATIVE)
  })

  it('내 말과 상대 말이 색으로 구분된다', () => {
    // 두 말풍선을 가르는 건 밝기가 아니라 색이다. 주황과 파랑은
    // 밝기가 비슷해도 헷갈리지 않는다. 그래서 대비가 아니라
    // 색상환에서 얼마나 떨어져 있는지로 잰다.
    expect(hueDistance(colors.me, colors.peer)).toBeGreaterThan(120)
  })
})

describe('대비 계산', () => {
  it('검정과 흰색이 가장 큰 값을 낸다', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1)
  })

  it('같은 색끼리는 1이다', () => {
    expect(contrastRatio('#3366AA', '#3366AA')).toBeCloseTo(1, 5)
  })

  it('순서를 바꿔도 같은 값이다', () => {
    expect(contrastRatio('#123456', '#EEEEEE')).toBeCloseTo(
      contrastRatio('#EEEEEE', '#123456'),
      5,
    )
  })

  it('세 자리로 줄여 쓴 색도 읽는다', () => {
    expect(contrastRatio('#FFF', '#000')).toBeCloseTo(
      contrastRatio('#FFFFFF', '#000000'),
      5,
    )
  })
})

describe('색상 거리', () => {
  it('마주 보는 색은 180 만큼 떨어져 있다', () => {
    expect(hueDistance('#FF0000', '#00FFFF')).toBeCloseTo(180, 5)
  })

  it('같은 색은 0 이다', () => {
    expect(hueDistance('#3366AA', '#3366AA')).toBe(0)
  })

  it('색상환을 넘어가도 가까운 쪽으로 잰다', () => {
    // 빨강(0도)과 자주(300도)는 360을 넘어 도는 쪽이 더 가깝다
    expect(hueDistance('#FF0000', '#FF00FF')).toBeCloseTo(60, 5)
  })

  it('회색끼리는 색이 없으므로 0 이다', () => {
    expect(hueDistance('#333333', '#CCCCCC')).toBe(0)
  })
})
