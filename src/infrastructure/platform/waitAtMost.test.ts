import { describe, expect, it } from 'vitest'
import { valueAtMost, waitAtMost } from './waitAtMost'

/**
 * 답이 없어도 넘어가는가.
 *
 * **예외보다 답이 없는 쪽이 나쁘다.** 예외는 잡으면 되는데 답이 없는 것은
 * 잡을 수가 없다. 화면이 그대로 멎고 오류도 안 뜬다.
 *
 * 실제로 첫 실행 안내를 못 넘어가 앱을 통째로 못 쓴 일이 있었다.
 */

/** 영영 안 끝나는 일 */
const never = () => new Promise<never>(() => undefined)

describe('제때 안 끝나면 포기한다', () => {
  it('끝나면 끝난 것으로 본다', async () => {
    expect(await waitAtMost(Promise.resolve('됐다'), 50)).toBe(true)
  })

  it('영영 안 끝나면 포기한다', async () => {
    // **여기가 핵심이다.** 이게 없으면 화면이 멎는다.
    expect(await waitAtMost(never(), 20)).toBe(false)
  })

  it('실패해도 던지지 않는다', async () => {
    // 부르는 쪽이 try 를 잊어도 안전해야 한다
    expect(await waitAtMost(Promise.reject(new Error('저장소가 깨졌다')), 50)).toBe(false)
  })

  it('늦게 끝나는 것도 포기한다', async () => {
    const slow = new Promise(resolve => setTimeout(resolve, 200))

    expect(await waitAtMost(slow, 20)).toBe(false)
  })
})

describe('값도 제때 안 오면 포기한다', () => {
  it('오면 그 값을 준다', async () => {
    expect(await valueAtMost(Promise.resolve('값'), '기본', 50)).toBe('값')
  })

  it('영영 안 오면 기본값을 준다', async () => {
    expect(await valueAtMost(never(), '기본', 20)).toBe('기본')
  })

  it('실패해도 기본값을 준다', async () => {
    const broken = Promise.reject(new Error('못 읽는다'))

    expect(await valueAtMost(broken, '기본', 50)).toBe('기본')
  })

  it('null 도 값으로 본다', async () => {
    // 저장소에 없는 것과 못 읽은 것을 같이 본다. 할 일이 같다.
    expect(await valueAtMost<string | null>(Promise.resolve(null), null, 50)).toBeNull()
  })
})
