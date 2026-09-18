import { describe, expect, it } from 'vitest'
import {
  CallState,
  CONNECT_TIMEOUT_MS,
  callEndReasons,
  callPhases,
  RING_TIMEOUT_MS,
} from './CallState'

/**
 * 통화 상태.
 *
 * **한쪽은 끊었다고 아는데 다른 쪽은 통화 중인 것**이 여기서 나올 수 있는
 * 가장 나쁜 버그다. 마이크가 열린 채로 남아 대화가 새어나간다.
 * 그래서 갈 수 있는 길과 없는 길을 전부 못박는다.
 */

const T0 = new Date('2026-09-18T10:00:00Z')
const later = (ms: number) => new Date(T0.getTime() + ms)

function calling(): CallState {
  const result = CallState.idle(T0).start('voice', T0)
  if (!result.ok) throw new Error('걸지 못했다')
  return result.value
}

function ringing(): CallState {
  const result = CallState.idle(T0).receive('voice', T0)
  if (!result.ok) throw new Error('받지 못했다')
  return result.value
}

function active(): CallState {
  const accepted = ringing().accept(T0)
  if (!accepted.ok) throw new Error('수락하지 못했다')
  const connected = accepted.value.connected(T0)
  if (!connected.ok) throw new Error('이어지지 못했다')
  return connected.value
}

describe('통화를 거는 쪽', () => {
  it('아무것도 안 하고 있을 때 걸 수 있다', () => {
    expect(calling().phase).toBe('calling')
    expect(calling().outgoing).toBe(true)
  })

  it('이미 통화 중이면 못 건다', () => {
    const result = active().start('voice', T0)

    expect(result.ok).toBe(false)
  })

  it('끝난 뒤에는 다시 걸 수 있다', () => {
    const ended = active().end('hung-up', T0)

    expect(ended.start('voice', later(1000)).ok).toBe(true)
  })

  it('상대가 받으면 길을 트기 시작한다', () => {
    const result = calling().accept(later(3000))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.phase).toBe('connecting')
    // 내가 건 통화라는 것은 그대로 남는다
    expect(result.value.outgoing).toBe(true)
  })
})

describe('통화를 받는 쪽', () => {
  it('걸려오면 답을 기다린다', () => {
    expect(ringing().phase).toBe('ringing')
    expect(ringing().needsAnswer()).toBe(true)
    expect(ringing().outgoing).toBe(false)
  })

  it('통화 중에는 새 통화를 안 받는다', () => {
    // 받으면 지금 통화가 끊긴다. 그게 더 나쁘다.
    const result = active().receive('voice', T0)

    expect(result.ok).toBe(false)
  })

  it('받으면 길을 트기 시작한다', () => {
    const result = ringing().accept(later(2000))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.phase).toBe('connecting')
  })
})

describe('끝내기는 어디서든 된다', () => {
  // **여기서 막으면 마이크가 열린 채로 남는 길이 생긴다.**
  // 끝내는 것은 언제나 되어야 한다.
  it.each(['calling', 'ringing', 'connecting', 'active'] as const)(
    '%s 에서도 끝낼 수 있다',
    phase => {
      const states: Record<string, CallState> = {
        calling: calling(),
        ringing: ringing(),
        connecting: (() => {
          const r = ringing().accept(T0)
          if (!r.ok) throw new Error('수락하지 못했다')
          return r.value
        })(),
        active: active(),
      }

      const ended = states[phase]?.end('hung-up', later(5000))

      expect(ended?.phase).toBe('ended')
      expect(ended?.isLive()).toBe(false)
    },
  )

  it('처음 끝난 이유가 진짜 이유다', () => {
    // 끊은 뒤에 "연결이 끊겼다"가 또 오면 덮어쓰지 않는다.
    // 사람이 끊은 것과 저절로 끊긴 것은 다르게 보여야 한다.
    const ended = active().end('hung-up', T0)
    const again = ended.end('link-lost', later(1000))

    expect(again.endReason).toBe('hung-up')
  })

  it('끝나면 마이크를 열어둘 상태가 아니다', () => {
    expect(active().isLive()).toBe(true)
    expect(active().end('peer-hung-up', T0).isLive()).toBe(false)
  })
})

describe('마이크를 열어둘 때', () => {
  it('길을 트는 중부터 통화 중까지만이다', () => {
    const connecting = ringing().accept(T0)
    if (!connecting.ok) throw new Error('수락하지 못했다')

    expect(CallState.idle(T0).isLive()).toBe(false)
    expect(calling().isLive()).toBe(false)
    expect(ringing().isLive()).toBe(false)
    expect(connecting.value.isLive()).toBe(true)
    expect(active().isLive()).toBe(true)
  })

  it('벨이 울리는 동안은 열지 않는다', () => {
    // 받기 전에 열면 상대가 내 쪽 소리를 먼저 듣는다
    expect(ringing().isLive()).toBe(false)
  })
})

describe('기다리다 포기하기', () => {
  it('아무도 안 받으면 포기한다', () => {
    expect(calling().hasTimedOut(later(RING_TIMEOUT_MS - 1))).toBe(false)
    expect(calling().hasTimedOut(later(RING_TIMEOUT_MS))).toBe(true)
    expect(calling().timeoutReason()).toBe('unanswered')
  })

  it('길이 안 트이면 더 빨리 포기한다', () => {
    // 같은 사설망이라 10초면 넉넉하다. 더 기다려도 안 된다.
    const connecting = ringing().accept(T0)
    if (!connecting.ok) throw new Error('수락하지 못했다')

    expect(connecting.value.hasTimedOut(later(CONNECT_TIMEOUT_MS - 1))).toBe(false)
    expect(connecting.value.hasTimedOut(later(CONNECT_TIMEOUT_MS))).toBe(true)
    expect(connecting.value.timeoutReason()).toBe('failed')
  })

  it('길 트는 시간이 벨 시간보다 짧다', () => {
    expect(CONNECT_TIMEOUT_MS).toBeLessThan(RING_TIMEOUT_MS)
  })

  it('통화 중에는 포기하지 않는다', () => {
    expect(active().hasTimedOut(later(60 * 60 * 1000))).toBe(false)
  })
})

describe('영상으로 올리고 내리기', () => {
  it('통화 중에만 바꾼다', () => {
    const result = active().switchKind('video')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.kind).toBe('video')
    expect(result.value.phase).toBe('active')
  })

  it('벨이 울리는 중에는 못 바꾼다', () => {
    expect(ringing().switchKind('video').ok).toBe(false)
  })

  it('바꿔도 통화가 언제 시작됐는지는 그대로다', () => {
    // 통화 시간이 0으로 돌아가면 사람이 헷갈린다
    const call = active()
    const switched = call.switchKind('video')

    expect(switched.ok).toBe(true)
    if (!switched.ok) return
    expect(switched.value.since).toEqual(call.since)
  })
})

describe('상태 목록', () => {
  it('빠짐없이 적혀 있다', () => {
    expect(callPhases).toHaveLength(6)
    expect(callEndReasons.length).toBeGreaterThan(0)
  })

  it('통화 창을 띄울 상태를 가른다', () => {
    expect(CallState.idle(T0).isBusy()).toBe(false)
    expect(calling().isBusy()).toBe(true)
    expect(ringing().isBusy()).toBe(true)
    expect(active().isBusy()).toBe(true)
    expect(active().end('hung-up', T0).isBusy()).toBe(false)
  })
})
