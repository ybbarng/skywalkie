import { describe, expect, it } from 'vitest'
import { systemClock } from './Clock'

describe('systemClock', () => {
  it('지금 시각을 준다', () => {
    const before = Date.now()

    const now = systemClock.now().getTime()

    expect(now).toBeGreaterThanOrEqual(before)
    expect(now).toBeLessThanOrEqual(Date.now())
  })

  it('밀리초로도 준다', () => {
    const before = Date.now()

    const millis = systemClock.epochMillis()

    expect(millis).toBeGreaterThanOrEqual(before)
    expect(millis).toBeLessThanOrEqual(Date.now())
  })

  it('두 방식이 같은 시각을 가리킨다', () => {
    const date = systemClock.now().getTime()
    const millis = systemClock.epochMillis()

    expect(Math.abs(millis - date)).toBeLessThan(100)
  })
})
