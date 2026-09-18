import { describe, expect, it } from 'vitest'
import { ConnectionState } from '@/domain/connection/ConnectionState'
import {
  ANNOUNCE_DISCONNECT_AFTER_MS,
  decidePhase,
  HINT_AFTER_MS,
  type PhaseInput,
  shouldAnnounceDisconnect,
  shouldShowHint,
} from './connectPhase'

function input(overrides: Partial<PhaseInput> = {}): PhaseInput {
  return {
    role: 'guest',
    connection: null,
    onPrivateNetwork: null,
    peerFound: false,
    everConnected: false,
    ...overrides,
  }
}

describe('사람에게 보여줄 단계 정하기', () => {
  describe('아직 망에 못 붙었을 때', () => {
    it('핫스팟을 여는 쪽에게는 핫스팟을 켜라고 한다', () => {
      const phase = decidePhase(input({ role: 'host', onPrivateNetwork: false }))

      expect(phase).toBe('need-hotspot')
    })

    it('붙는 쪽에게는 Wi-Fi 를 고르라고 한다', () => {
      const phase = decidePhase(input({ role: 'guest', onPrivateNetwork: false }))

      expect(phase).toBe('need-wifi')
    })
  })

  describe('망에 붙었을 때', () => {
    it('여는 쪽은 상대를 기다린다', () => {
      const phase = decidePhase(input({ role: 'host', onPrivateNetwork: true }))

      expect(phase).toBe('waiting-for-peer')
    })

    it('붙는 쪽은 상대를 찾는다', () => {
      const phase = decidePhase(input({ role: 'guest', onPrivateNetwork: true }))

      expect(phase).toBe('looking')
    })

    it('아직 모를 때도 기다리는 쪽으로 말한다', () => {
      // 주소를 못 읽었다고 "설정 가세요"라고 하면 잘못된 안내가 된다
      const phase = decidePhase(input({ role: 'guest', onPrivateNetwork: null }))

      expect(phase).toBe('looking')
    })
  })

  it('상대를 찾으면 찾았다고 말한다', () => {
    const phase = decidePhase(input({ onPrivateNetwork: true, peerFound: true }))

    expect(phase).toBe('found')
  })

  it('붙는 중에는 이어지는 중이라고 말한다', () => {
    const connected = ConnectionState.idle().startSearching()
    if (!connected.ok) throw new Error('앞선 단계가 실패했다')
    const handshaking = connected.value.startHandshake('wifi')
    if (!handshaking.ok) throw new Error('앞선 단계가 실패했다')

    const phase = decidePhase(input({ connection: handshaking.value }))

    expect(phase).toBe('joining')
  })

  describe('한 번 붙었다가 끊겼을 때', () => {
    it('찾는 중이 아니라 다시 잇는 중이라고 말한다', () => {
      // "찾는 중"과 "잠깐 멀어졌어요"는 사람에게 전혀 다른 느낌이다
      const phase = decidePhase(input({ everConnected: true, onPrivateNetwork: true }))

      expect(phase).toBe('recovering')
    })

    it('망이 끊겼어도 설정으로 보내지 않는다', () => {
      // 이미 한 번 됐던 사람에게 처음부터 다시 하라고 하면 혼란스럽다
      const phase = decidePhase(
        input({ role: 'host', everConnected: true, onPrivateNetwork: false }),
      )

      expect(phase).toBe('recovering')
    })
  })
})

describe('도움말을 언제 보여줄까', () => {
  it('처음에는 안 보여준다', () => {
    // 바로 띄우면 "안 되나 보다" 싶어진다
    expect(shouldShowHint('looking', 0)).toBe(false)
  })

  it('한참 지나면 보여준다', () => {
    expect(shouldShowHint('looking', HINT_AFTER_MS)).toBe(true)
  })

  it('사람이 할 일이 남아 있으면 안 보여준다', () => {
    // 이미 버튼이 있는데 도움말까지 띄우면 화면이 시끄럽다
    expect(shouldShowHint('need-hotspot', 60_000)).toBe(false)
    expect(shouldShowHint('need-wifi', 60_000)).toBe(false)
  })

  it('찾은 뒤에는 안 보여준다', () => {
    expect(shouldShowHint('found', 60_000)).toBe(false)
    expect(shouldShowHint('joining', 60_000)).toBe(false)
  })
})

describe('끊김을 언제 알릴까', () => {
  it('짧은 끊김은 알리지 않는다', () => {
    // 비행기에서는 신호가 자주 흔들린다.
    // 그때마다 빨간 띠가 뜨면 사람이 불안해진다.
    expect(shouldAnnounceDisconnect(1000)).toBe(false)
    expect(shouldAnnounceDisconnect(3000)).toBe(false)
  })

  it('오래 끊기면 알린다', () => {
    expect(shouldAnnounceDisconnect(ANNOUNCE_DISCONNECT_AFTER_MS)).toBe(true)
  })

  it('알리기까지 다시 붙을 시간을 준다', () => {
    // 다시 붙는 첫 시도가 1초 뒤다. 그 안에 되면 아무 일도 없던 셈이다.
    expect(ANNOUNCE_DISCONNECT_AFTER_MS).toBeGreaterThan(2000)
  })
})
