import { describe, expect, it } from 'vitest'
import { fitWithin } from './photoLayout'

/**
 * 사진 크기 맞추기.
 *
 * **찌그러진 사진은 다시 볼 마음이 안 든다.** 비율을 지키는 것이
 * 여기서 가장 중요하다.
 */

describe('사진 크기', () => {
  it('가로로 긴 사진은 너비에 맞춘다', () => {
    const size = fitWithin(1600, 1200, 240)

    expect(size.width).toBe(240)
    expect(size.height).toBe(180)
  })

  it('비율이 그대로다', () => {
    const before = 4032 / 3024
    const after = fitWithin(4032, 3024, 240)

    expect(after.width / after.height).toBeCloseTo(before, 1)
  })

  it('세로로 아주 긴 사진도 화면을 다 먹지 않는다', () => {
    // 파노라마를 세로로 찍으면 화면 열 배 길이가 나온다
    const size = fitWithin(400, 4000, 240)

    expect(size.height).toBeLessThanOrEqual(240 * 1.6)
  })

  it('원본이 작으면 늘리지 않는다', () => {
    // 늘리면 흐려지기만 한다
    const size = fitWithin(120, 90, 240)

    expect(size.width).toBe(120)
    expect(size.height).toBe(90)
  })

  it('아주 작아도 눈에 보일 만큼은 남긴다', () => {
    const size = fitWithin(10, 10, 240)

    expect(size.width).toBeGreaterThanOrEqual(80)
  })

  it('크기를 모를 때도 네모는 그린다', () => {
    // 크기가 0 이면 아무것도 안 그려져서 빈 자리만 남는다
    const size = fitWithin(0, 0, 240)

    expect(size.width).toBeGreaterThan(0)
    expect(size.height).toBeGreaterThan(0)
  })
})
