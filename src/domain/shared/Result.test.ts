import { describe, expect, it } from 'vitest'
import { domainError } from './DomainError'
import { all, err, flatMap, isErr, isOk, map, ok, unwrapOr } from './Result'

describe('Result', () => {
  it('성공한 값을 담고 꺼낼 수 있다', () => {
    const result = ok(42)

    expect(isOk(result)).toBe(true)
    expect(result.ok && result.value).toBe(42)
  })

  it('실패한 이유를 담고 꺼낼 수 있다', () => {
    const error = domainError('empty', '내용이 비어 있다', 'content')

    const result = err(error)

    expect(isErr(result)).toBe(true)
    expect(!result.ok && result.error.code).toBe('empty')
  })

  describe('map', () => {
    it('성공한 값을 다른 값으로 바꾼다', () => {
      const result = map(ok(2), n => n * 3)

      expect(result).toEqual(ok(6))
    })

    it('실패는 바꾸지 않고 그대로 흘려보낸다', () => {
      const error = domainError('not-found', '없다')

      const result = map(err(error), (n: number) => n * 3)

      expect(result).toEqual(err(error))
    })
  })

  describe('flatMap', () => {
    it('성공한 값으로 또 실패할 수 있는 일을 이어서 한다', () => {
      const result = flatMap(ok(2), n => ok(n + 1))

      expect(result).toEqual(ok(3))
    })

    it('이어진 일이 실패하면 그 실패가 남는다', () => {
      const error = domainError('invalid-value', '안 된다')

      const result = flatMap(ok(2), () => err(error))

      expect(result).toEqual(err(error))
    })

    it('앞이 이미 실패면 뒤를 실행하지 않는다', () => {
      const error = domainError('not-found', '없다')
      let ran = false

      flatMap(err(error), (n: number) => {
        ran = true
        return ok(n)
      })

      expect(ran).toBe(false)
    })
  })

  describe('unwrapOr', () => {
    it('성공이면 그 값을 준다', () => {
      expect(unwrapOr(ok(7), 0)).toBe(7)
    })

    it('실패면 대신 쓸 값을 준다', () => {
      expect(unwrapOr(err(domainError('not-found', '없다')), 0)).toBe(0)
    })
  })

  describe('all', () => {
    it('전부 성공이면 값들을 모아 준다', () => {
      const result = all([ok(1), ok(2), ok(3)])

      expect(result).toEqual(ok([1, 2, 3]))
    })

    it('하나라도 실패하면 첫 실패를 준다', () => {
      const first = domainError('empty', '첫 번째가 비었다')
      const second = domainError('too-long', '두 번째가 길다')

      const result = all([ok(1), err(first), err(second)])

      expect(result).toEqual(err(first))
    })

    it('빈 목록이면 빈 배열로 성공한다', () => {
      expect(all([])).toEqual(ok([]))
    })
  })
})
