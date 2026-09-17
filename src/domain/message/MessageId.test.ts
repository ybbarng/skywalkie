import { makeUlid, ulidSequence } from '@test/support/factories'
import { describe, expect, it } from 'vitest'
import { compareIds, messageId, timeOf } from './MessageId'

describe('MessageId', () => {
  it('올바른 ULID 를 받아들인다', () => {
    const result = messageId('01K5F8ZPXQ0000000000000000')

    expect(result.ok).toBe(true)
  })

  it('소문자로 와도 대문자로 맞춰 둔다', () => {
    // 보관 파일을 손으로 고쳤거나 다른 도구를 거쳐 올 수 있다
    const result = messageId('01k5f8zpxq0000000000000000')

    expect(result.ok && result.value).toBe('01K5F8ZPXQ0000000000000000')
  })

  it('빈 값을 거절한다', () => {
    const result = messageId('')

    expect(!result.ok && result.error.code).toBe('empty')
  })

  it.each([
    ['짧으면', '01K5F8ZPXQ'],
    ['길면', '01K5F8ZPXQ00000000000000000'],
    ['헷갈리는 글자 I 가 들어 있으면', '01K5F8ZPXI0000000000000000'],
    ['헷갈리는 글자 L 이 들어 있으면', '01K5F8ZPXL0000000000000000'],
    ['헷갈리는 글자 O 가 들어 있으면', '01K5F8ZPXO0000000000000000'],
    ['헷갈리는 글자 U 가 들어 있으면', '01K5F8ZPXU0000000000000000'],
    ['붙임표가 섞여 있으면', '01K5F8ZPXQ-000000000000000'],
    ['다른 형식이면', 'msg_12345'],
  ])('%s 거절한다', (_label, value) => {
    const result = messageId(value)

    expect(result.ok).toBe(false)
  })

  it('아주 긴 값을 넣어도 오류 설명이 짧게 잘린다', () => {
    // 오류 내용을 기록할 때 화면과 로그가 통째로 묻히지 않게 한다
    const result = messageId('x'.repeat(5000))

    expect(!result.ok && result.error.detail.length).toBeLessThan(80)
  })
})

describe('식별자에 담긴 시각', () => {
  it('만들 때 넣은 시각을 그대로 꺼낼 수 있다', () => {
    const when = 1758000000000

    const id = makeUlid(when)

    expect(timeOf(id).getTime()).toBe(when)
  })

  it('나중에 만든 식별자가 더 늦은 시각을 갖는다', () => {
    const earlier = makeUlid(1758000000000)
    const later = makeUlid(1758000005000)

    expect(timeOf(later).getTime()).toBeGreaterThan(timeOf(earlier).getTime())
  })
})

describe('줄 세우기', () => {
  it('글자순으로 정렬하면 시간순이 된다', () => {
    // 이 성질 덕에 보관 파일을 합칠 때 따로 시각을 비교하지 않아도 된다
    const nextId = ulidSequence(1758000000000)
    const first = nextId()
    const second = nextId()
    const third = nextId()
    const fourth = nextId()

    const shuffled = [fourth, second, first, third]
    const sorted = [...shuffled].sort(compareIds)

    expect(sorted).toEqual([first, second, third, fourth])
  })

  it('같은 식별자끼리는 0 이다', () => {
    const id = makeUlid(1758000000000)

    expect(compareIds(id, id)).toBe(0)
  })
})
