import { describe, expect, it } from 'vitest'
import { ConnectionState } from '@/domain/connection/ConnectionState'
import {
  ANNOUNCE_DISCONNECT_AFTER_MS,
  decidePhase,
  HINT_AFTER_MS,
  onOurNetwork,
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

    it('망을 아직 못 읽었으면 다시 잇는 중이라고 말한다', () => {
      // 읽어보기 전에 꺼졌다고 단정하면, 멀쩡한데 설정을 열라고 하게 된다
      const phase = decidePhase(
        input({ role: 'host', everConnected: true, onPrivateNetwork: null }),
      )

      expect(phase).toBe('recovering')
    })

    it('핫스팟이 꺼졌으면 켜달라고 말한다', () => {
      // 비행기 모드를 켜면 핫스팟이 같이 꺼진다. 자리에 앉은 뒤 가장 흔한 일이다.
      //
      // 여기서 "알아서 다시 이어드릴게요" 라고 하면 **사람이 손을 놓는다.**
      // 아무리 기다려도 저절로 켜지지 않는데 기다리게 된다. 떨어져 앉아
      // 물어볼 수도 없으니, 사람이 켜야 풀리는 일은 사람에게 말해야 한다.
      const phase = decidePhase(
        input({ role: 'host', everConnected: true, onPrivateNetwork: false }),
      )

      expect(phase).toBe('need-hotspot')
    })

    it('상대 Wi-Fi 에서 빠졌으면 다시 들어가라고 말한다', () => {
      // 붙는 쪽도 마찬가지다. 상대가 핫스팟을 껐다 켜면 아이폰이
      // 다른 Wi-Fi 로 옮겨가 있기도 한다.
      const phase = decidePhase(
        input({ role: 'guest', everConnected: true, onPrivateNetwork: false }),
      )

      expect(phase).toBe('need-wifi')
    })
  })
})

describe('우리 망에 있나', () => {
  it('여는 쪽은 집 Wi-Fi 에 있는 것만으로는 켠 것이 아니다', () => {
    // 집에서 확인해볼 때가 바로 이 경우다. 사설망이긴 하지만
    // 핫스팟은 꺼져 있다. 여기서 참이라고 하면 검사 자체가 무의미해진다.
    const answer = onOurNetwork('host', { onPrivateNetwork: true, isGateway: false })

    expect(answer).toBe(false)
  })

  it('여는 쪽은 그 망의 주인일 때만 켠 것으로 본다', () => {
    // 핫스팟을 연 폰이 그 망의 주인이 된다
    const answer = onOurNetwork('host', { onPrivateNetwork: true, isGateway: true })

    expect(answer).toBe(true)
  })

  it('붙는 쪽은 사설망에 들어와 있으면 된다', () => {
    // 어느 Wi-Fi 인지는 앱이 알 길이 없다. 잘못 들어갔으면 도움말이 알려준다.
    const answer = onOurNetwork('guest', { onPrivateNetwork: true, isGateway: false })

    expect(answer).toBe(true)
  })

  it('아직 못 읽었으면 모른다고 답한다', () => {
    // 모르는 것을 "꺼졌다"로 바꾸면 멀쩡한 사람에게 설정을 열라고 하게 된다
    const answer = onOurNetwork('host', { onPrivateNetwork: null, isGateway: false })

    expect(answer).toBeNull()
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
