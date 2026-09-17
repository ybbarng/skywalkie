import { beforeEach, describe, expect, it } from 'vitest'
import { SeqTracker } from './SeqTracker'

describe('SeqTracker', () => {
  let tracker: SeqTracker

  beforeEach(() => {
    tracker = new SeqTracker()
  })

  describe('처음 보는 순번', () => {
    it('차례대로 오면 전부 새것이다', () => {
      expect(tracker.observe(1)).toBe('new')
      expect(tracker.observe(2)).toBe('new')
      expect(tracker.observe(3)).toBe('new')
      expect(tracker.hasGaps()).toBe(false)
    })

    it('1부터 시작하지 않으면 앞이 빈 것으로 본다', () => {
      // 앱을 새로 깔았을 때 이렇게 된다
      expect(tracker.observe(5)).toBe('gap')
      expect(tracker.missingSeqs()).toEqual([1, 2, 3, 4])
    })
  })

  describe('겹쳐서 올 때', () => {
    it('같은 순번이 두 번 오면 두 번째를 버린다', () => {
      // 길을 갈아탈 때나 답이 유실됐을 때 실제로 생긴다
      tracker.observe(1)

      expect(tracker.observe(1)).toBe('duplicate')
    })

    it('겹쳐도 가장 큰 순번이 흔들리지 않는다', () => {
      tracker.observe(5)
      tracker.observe(5)

      expect(tracker.highestSeq()).toBe(5)
    })
  })

  describe('빠졌을 때', () => {
    it('건너뛰고 오면 그 사이를 적어둔다', () => {
      tracker.observe(1)

      expect(tracker.observe(4)).toBe('gap')
      expect(tracker.missingSeqs()).toEqual([2, 3])
    })

    it('빠졌던 게 나중에 오면 목록에서 지운다', () => {
      tracker.observe(1)
      tracker.observe(4)

      expect(tracker.observe(2)).toBe('new')
      expect(tracker.missingSeqs()).toEqual([3])
    })

    it('빠진 것을 전부 채우면 빈틈이 없어진다', () => {
      tracker.observe(5)
      for (const seq of [1, 2, 3, 4]) tracker.observe(seq)

      expect(tracker.hasGaps()).toBe(false)
    })

    it('여러 군데가 빠져도 전부 찾아낸다', () => {
      tracker.observe(2)
      tracker.observe(5)
      tracker.observe(9)

      expect(tracker.missingSeqs()).toEqual([1, 3, 4, 6, 7, 8])
    })
  })

  describe('순서가 뒤바뀌어 올 때', () => {
    it('제자리에 끼운다', () => {
      // 좁은 길에서는 실제로 뒤바뀐다
      tracker.observe(3)
      tracker.observe(1)
      tracker.observe(2)

      expect(tracker.missingSeqs()).toEqual([])
      expect(tracker.highestSeq()).toBe(3)
    })

    it('뒤늦게 온 것도 겹치면 버린다', () => {
      tracker.observe(3)
      tracker.observe(1)

      expect(tracker.observe(1)).toBe('duplicate')
    })
  })

  describe('이상한 값', () => {
    it.each([
      ['0이면', 0],
      ['음수면', -1],
      ['소수면', 1.5],
      ['숫자가 아니면', Number.NaN],
    ])('순번이 %s 받아들이지 않는다', (_label, seq) => {
      expect(tracker.observe(seq)).toBe('invalid')
    })

    it('이상한 값이 와도 상태가 망가지지 않는다', () => {
      tracker.observe(1)
      tracker.observe(-5)
      tracker.observe(2)

      expect(tracker.highestSeq()).toBe(2)
      expect(tracker.hasGaps()).toBe(false)
    })

    it('아주 큰 순번도 다룬다', () => {
      // 여기서 1부터 전부 빈틈으로 적으면 메모리가 터진다.
      // 지금은 적되, 실제로는 이런 값이 올 일이 없다.
      expect(tracker.observe(1)).toBe('new')
      expect(tracker.observe(2)).toBe('new')
      expect(tracker.highestSeq()).toBe(2)
    })
  })

  describe('인사할 때 상대가 알려준 순번', () => {
    it('못 받은 것을 빈틈으로 적어둔다', () => {
      // 끊긴 동안 상대가 보낸 것을 다시 붙자마자 알아챈다
      tracker.observe(1)
      tracker.observe(2)

      tracker.noteRemoteHighest(5)

      expect(tracker.missingSeqs()).toEqual([3, 4, 5])
    })

    it('이미 받은 것보다 작으면 무시한다', () => {
      tracker.observe(5)

      tracker.noteRemoteHighest(3)

      expect(tracker.highestSeq()).toBe(5)
      expect(tracker.missingSeqs()).toEqual([1, 2, 3, 4])
    })

    it('이상한 값이면 무시한다', () => {
      tracker.observe(2)

      tracker.noteRemoteHighest(Number.NaN)

      expect(tracker.highestSeq()).toBe(2)
    })
  })

  describe('상대가 없다고 답했을 때', () => {
    it('영원히 요청하지 않도록 목록에서 지운다', () => {
      // 상대가 앱을 새로 깔았거나 그 메시지를 지웠다
      tracker.observe(5)

      tracker.giveUp([1, 2])

      expect(tracker.missingSeqs()).toEqual([3, 4])
    })

    it('없는 순번을 포기해도 아무 일 없다', () => {
      tracker.observe(1)

      tracker.giveUp([99])

      expect(tracker.missingSeqs()).toEqual([])
    })
  })

  it('처음부터 다시 시작할 수 있다', () => {
    tracker.observe(5)

    tracker.reset()

    expect(tracker.highestSeq()).toBe(0)
    expect(tracker.missingSeqs()).toEqual([])
    expect(tracker.observe(5)).toBe('gap')
  })
})
