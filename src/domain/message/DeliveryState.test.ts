import { describe, expect, it } from 'vitest'
import {
  canTransition,
  type DeliveryState,
  deliveryStates,
  hasReachedPeer,
  isFinal,
  isWaitingToSend,
  transition,
} from './DeliveryState'

/**
 * 상태 전이는 이 앱에서 가장 조용히 어긋나기 쉬운 곳이다.
 * 늦게 도착한 옛 신호 하나가 화면을 뒤로 돌리면, 사용자는 읽은 메시지가
 * 다시 안 읽음으로 바뀌는 걸 보게 된다.
 *
 * 그래서 가능한 모든 조합(6×6=36)을 표로 적어두고 전부 확인한다.
 */

/** 갈 수 있는 길만 적는다. 여기 없는 조합은 전부 막혀야 한다 */
const allowed: ReadonlyArray<[DeliveryState, DeliveryState]> = [
  ['draft', 'sending'],
  ['draft', 'pending'],
  ['sending', 'delivered'],
  ['sending', 'failed'],
  ['sending', 'pending'],
  ['pending', 'sending'],
  ['delivered', 'read'],
  ['failed', 'pending'],
]

function isAllowed(from: DeliveryState, to: DeliveryState): boolean {
  return allowed.some(([a, b]) => a === from && b === to)
}

describe('DeliveryState 전이표', () => {
  const combinations = deliveryStates.flatMap(from =>
    deliveryStates.map(to => [from, to] as const),
  )

  it('가능한 조합을 빠짐없이 시험한다', () => {
    expect(combinations).toHaveLength(36)
  })

  it.each(combinations)('%s 에서 %s 로', (from, to) => {
    if (from === to) {
      // 같은 신호가 두 번 오는 건 흔하다. 오류가 아니라 그대로 둔다.
      const result = transition(from, to)
      expect(result.ok && result.value).toBe(from)
      return
    }

    expect(canTransition(from, to)).toBe(isAllowed(from, to))

    const result = transition(from, to)
    if (isAllowed(from, to)) {
      expect(result.ok && result.value).toBe(to)
    } else {
      expect(result.ok).toBe(false)
      expect(!result.ok && result.error.code).toBe('invalid-transition')
    }
  })
})

describe('되돌아가지 않기', () => {
  it('읽음에서는 어디로도 갈 수 없다', () => {
    for (const to of deliveryStates) {
      if (to === 'read') continue
      expect(canTransition('read', to)).toBe(false)
    }
  })

  it('전달됨에서 보내는 중으로 되돌아가지 않는다', () => {
    // 늦게 도착한 옛 신호가 화면을 흔드는 걸 막는 규칙이다
    expect(canTransition('delivered', 'sending')).toBe(false)
  })

  it('전달됨에서 대기 중으로 되돌아가지 않는다', () => {
    expect(canTransition('delivered', 'pending')).toBe(false)
  })

  it('읽음이 끝 상태다', () => {
    expect(isFinal('read')).toBe(true)
  })

  it('읽음 말고는 끝 상태가 없다', () => {
    const finals = deliveryStates.filter(isFinal)
    expect(finals).toEqual(['read'])
  })
})

describe('다시 보내기', () => {
  it('실패한 메시지는 대기 중으로 되돌릴 수 있다', () => {
    const result = transition('failed', 'pending')

    expect(result.ok && result.value).toBe('pending')
  })

  it('실패에서 곧바로 보내는 중으로 가지 않는다', () => {
    // 대기 줄을 거쳐야 순서가 지켜진다
    expect(canTransition('failed', 'sending')).toBe(false)
  })
})

describe('상태 묶어 보기', () => {
  it.each([
    ['draft', true],
    ['pending', true],
    ['sending', false],
    ['delivered', false],
    ['read', false],
    ['failed', false],
  ] as const)('%s 가 연결을 기다리는 상태인지는 %s', (state, expected) => {
    expect(isWaitingToSend(state)).toBe(expected)
  })

  it.each([
    ['delivered', true],
    ['read', true],
    ['draft', false],
    ['sending', false],
    ['pending', false],
    ['failed', false],
  ] as const)('%s 가 상대에게 닿은 상태인지는 %s', (state, expected) => {
    expect(hasReachedPeer(state)).toBe(expected)
  })
})
