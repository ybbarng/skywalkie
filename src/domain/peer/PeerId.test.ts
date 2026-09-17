import { describe, expect, it } from 'vitest'
import { peerId, peerIdLimits, samePeer } from './PeerId'

describe('PeerId', () => {
  it('보통 식별자를 받아들인다', () => {
    const result = peerId('a7Kq2mXp9Lr4')

    expect(result.ok).toBe(true)
  })

  it('붙임표와 밑줄을 받아들인다', () => {
    // 파일 이름과 주소에 그대로 들어갈 수 있어야 한다
    const result = peerId('phone-android_01')

    expect(result.ok).toBe(true)
  })

  it('빈 값을 거절한다', () => {
    const result = peerId('')

    expect(!result.ok && result.error.code).toBe('empty')
  })

  it(`${peerIdLimits.min}자보다 짧으면 거절한다`, () => {
    const result = peerId('a'.repeat(peerIdLimits.min - 1))

    expect(!result.ok && result.error.code).toBe('invalid-value')
  })

  it(`${peerIdLimits.max}자보다 길면 거절한다`, () => {
    const result = peerId('a'.repeat(peerIdLimits.max + 1))

    expect(!result.ok && result.error.code).toBe('invalid-value')
  })

  it('가장 짧은 길이와 가장 긴 길이를 받아들인다', () => {
    expect(peerId('a'.repeat(peerIdLimits.min)).ok).toBe(true)
    expect(peerId('a'.repeat(peerIdLimits.max)).ok).toBe(true)
  })

  it.each([
    ['빈칸이 들어 있으면', 'peer id here'],
    ['한글이 들어 있으면', '내폰입니다123'],
    ['빗금이 들어 있으면', 'peer/android'],
    ['점이 들어 있으면', 'peer.android'],
  ])('%s 거절한다', (_label, value) => {
    const result = peerId(value)

    expect(!result.ok && result.error.code).toBe('invalid-value')
  })

  it('어느 칸이 문제인지 알려준다', () => {
    const result = peerId('짧음')

    expect(!result.ok && result.error.field).toBe('peerId')
  })
})

describe('같은 사람인지', () => {
  it('같은 값이면 같은 사람이다', () => {
    const a = peerId('a7Kq2mXp9Lr4')
    const b = peerId('a7Kq2mXp9Lr4')

    expect(a.ok && b.ok && samePeer(a.value, b.value)).toBe(true)
  })

  it('대소문자가 다르면 다른 사람이다', () => {
    // 무작위로 만든 값이라 대소문자를 구분해야 겹칠 확률이 낮아진다
    const a = peerId('a7Kq2mXp9Lr4')
    const b = peerId('A7kQ2MxP9lR4')

    expect(a.ok && b.ok && samePeer(a.value, b.value)).toBe(false)
  })
})
