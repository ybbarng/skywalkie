import { describe, expect, it } from 'vitest'
import {
  type ConnectionPhase,
  ConnectionState,
  canTransition,
  connectionPhases,
  MAX_RETRY_DELAY_MS,
  retryDelayMillis,
} from './ConnectionState'

/** 갈 수 있는 길만 적는다. 여기 없는 조합은 전부 막혀야 한다 */
const allowed: ReadonlyArray<[ConnectionPhase, ConnectionPhase]> = [
  ['idle', 'searching'],
  ['searching', 'handshaking'],
  ['searching', 'idle'],
  ['handshaking', 'connected'],
  ['handshaking', 'searching'],
  ['handshaking', 'idle'],
  ['connected', 'switching'],
  ['connected', 'searching'],
  ['connected', 'idle'],
  ['switching', 'connected'],
  ['switching', 'searching'],
  ['switching', 'idle'],
]

describe('연결 상태 전이표', () => {
  const combinations = connectionPhases.flatMap(from =>
    connectionPhases.map(to => [from, to] as const),
  )

  it('가능한 조합을 빠짐없이 시험한다', () => {
    expect(combinations).toHaveLength(25)
  })

  it.each(combinations)('%s 에서 %s 로', (from, to) => {
    const expected = from === to || allowed.some(([a, b]) => a === from && b === to)

    expect(canTransition(from, to)).toBe(expected)
  })
})

describe('연결 흐름', () => {
  it('찾고 인사하고 연결된다', () => {
    const searching = ConnectionState.idle().startSearching()
    if (!searching.ok) throw new Error('앞선 단계가 실패했다')

    const handshaking = searching.value.startHandshake('wifi')
    if (!handshaking.ok) throw new Error('앞선 단계가 실패했다')

    const connected = handshaking.value.establish()

    expect(connected.ok && connected.value.phase).toBe('connected')
    expect(connected.ok && connected.value.link).toBe('wifi')
  })

  it('찾는 단계에서 곧바로 연결될 수 없다', () => {
    const searching = ConnectionState.idle().startSearching()
    if (!searching.ok) throw new Error('앞선 단계가 실패했다')

    const result = searching.value.establish()

    expect(result.ok).toBe(false)
  })

  it('인사에 실패하면 다시 찾기로 돌아간다', () => {
    const handshaking = buildPhase('handshaking')

    const back = handshaking.startSearching()

    expect(back.ok && back.value.phase).toBe('searching')
    expect(back.ok && back.value.link).toBeNull()
  })

  it('연결되면 시도 횟수가 0으로 돌아간다', () => {
    let state = ConnectionState.idle()
    for (let i = 0; i < 3; i += 1) {
      const next = state.startSearching()
      if (!next.ok) throw new Error('앞선 단계가 실패했다')
      state = next.value
    }

    const handshaking = state.startHandshake('wifi')
    if (!handshaking.ok) throw new Error('앞선 단계가 실패했다')
    const connected = handshaking.value.establish()

    expect(connected.ok && connected.value.retryAttempt).toBe(0)
  })
})

describe('길 갈아타기', () => {
  it('갈아타는 동안에도 옛 길로 메시지를 보낼 수 있다', () => {
    const connected = ConnectionState.connected('ble')

    const switching = connected.startSwitching('wifi')

    expect(switching.ok && switching.value.isUsable()).toBe(true)
    expect(switching.ok && switching.value.link).toBe('ble')
  })

  it('새 길이 열리면 그 길로 옮겨 간다', () => {
    const switching = ConnectionState.connected('ble').startSwitching('wifi')
    if (!switching.ok) throw new Error('앞선 단계가 실패했다')

    const connected = switching.value.establish()

    expect(connected.ok && connected.value.link).toBe('wifi')
    expect(connected.ok && connected.value.pendingLink).toBeNull()
  })

  it('갈아타기에 실패하면 옛 길로 돌아간다', () => {
    const switching = ConnectionState.connected('ble').startSwitching('wifi')
    if (!switching.ok) throw new Error('앞선 단계가 실패했다')

    const back = switching.value.abandonSwitch()

    expect(back.ok && back.value.phase).toBe('connected')
    expect(back.ok && back.value.link).toBe('ble')
  })

  it('이미 쓰고 있는 길로는 갈아타지 않는다', () => {
    const result = ConnectionState.connected('wifi').startSwitching('wifi')

    expect(result.ok).toBe(false)
  })

  it('갈아타는 중이 아닐 때 되돌리기를 부르면 거절한다', () => {
    const result = ConnectionState.connected('wifi').abandonSwitch()

    expect(!result.ok && result.error.code).toBe('invalid-transition')
  })

  it('갈아타는 중에 연결이 끊기면 처음부터 다시 찾는다', () => {
    const switching = ConnectionState.connected('ble').startSwitching('wifi')
    if (!switching.ok) throw new Error('앞선 단계가 실패했다')

    const lost = switching.value.lose()

    expect(lost.ok && lost.value.phase).toBe('searching')
    expect(lost.ok && lost.value.link).toBeNull()
  })
})

describe('끊기고 다시 붙기', () => {
  it('끊기면 다시 찾기 시작한다', () => {
    const lost = ConnectionState.connected('wifi').lose()

    expect(lost.ok && lost.value.phase).toBe('searching')
  })

  it('붙어 있다가 끊기면 시도 횟수가 1부터 시작한다', () => {
    const lost = ConnectionState.connected('wifi').lose()

    expect(lost.ok && lost.value.retryAttempt).toBe(1)
  })

  it('계속 실패하면 시도 횟수가 쌓인다', () => {
    let state = ConnectionState.connected('wifi')
    const first = state.lose()
    if (!first.ok) throw new Error('앞선 단계가 실패했다')
    state = first.value

    const second = state.startSearching()

    expect(second.ok && second.value.retryAttempt).toBe(2)
  })

  it('사용자가 끄면 처음 상태로 돌아간다', () => {
    const stopped = ConnectionState.connected('wifi').stop()

    expect(stopped.ok && stopped.value.phase).toBe('idle')
    expect(stopped.ok && stopped.value.retryAttempt).toBe(0)
  })
})

describe('다시 시도하기까지 기다리는 시간', () => {
  it.each([
    [1, 1000],
    [2, 2000],
    [3, 4000],
    [4, 8000],
    [5, 16000],
    [6, MAX_RETRY_DELAY_MS],
    [7, MAX_RETRY_DELAY_MS],
    [20, MAX_RETRY_DELAY_MS],
  ])('%d번째 시도는 %d밀리초 뒤', (attempt, expected) => {
    expect(retryDelayMillis(attempt)).toBe(expected)
  })

  it('첫 시도는 기다리지 않는다', () => {
    expect(retryDelayMillis(0)).toBe(0)
  })

  it('30초를 넘기지 않는다', () => {
    // 계속 시도하면 배터리가 준다. 비행 시간 내내 켜둬야 한다.
    for (let attempt = 1; attempt <= 50; attempt += 1) {
      expect(retryDelayMillis(attempt)).toBeLessThanOrEqual(MAX_RETRY_DELAY_MS)
    }
  })
})

describe('메시지를 보낼 수 있는 상태', () => {
  it.each([
    ['idle', false],
    ['searching', false],
    ['handshaking', false],
    ['connected', true],
  ] as const)('%s 에서 보낼 수 있는지는 %s', (phase, expected) => {
    const state =
      phase === 'connected' ? ConnectionState.connected('wifi') : buildPhase(phase)

    expect(state.isUsable()).toBe(expected)
  })

  it('갈아타는 중에도 보낼 수 있다', () => {
    const switching = ConnectionState.connected('ble').startSwitching('wifi')

    expect(switching.ok && switching.value.isUsable()).toBe(true)
  })

  it('갈아타는 중은 아직 자리 잡은 상태가 아니다', () => {
    const switching = ConnectionState.connected('ble').startSwitching('wifi')

    expect(switching.ok && switching.value.isSettled()).toBe(false)
  })
})

function buildPhase(phase: 'idle' | 'searching' | 'handshaking'): ConnectionState {
  if (phase === 'idle') return ConnectionState.idle()

  const searching = ConnectionState.idle().startSearching()
  if (!searching.ok) throw new Error('앞선 단계가 실패했다')
  if (phase === 'searching') return searching.value

  const handshaking = searching.value.startHandshake('wifi')
  if (!handshaking.ok) throw new Error('앞선 단계가 실패했다')
  return handshaking.value
}
