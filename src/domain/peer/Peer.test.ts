import { ME } from '@test/support/factories'
import { describe, expect, it } from 'vitest'
import { Peer, peerLimits } from './Peer'

function makePeer(displayName = '여자친구'): Peer {
  const result = Peer.create({ id: ME, displayName, character: 'aria' })
  if (!result.ok) throw new Error(`테스트용 상대를 만들지 못했다: ${result.error.detail}`)
  return result.value
}

const STALE_AFTER = 30_000

describe('상대 만들기', () => {
  it('이름과 캐릭터로 만든다', () => {
    const peer = makePeer()

    expect(peer.displayName).toBe('여자친구')
    expect(peer.character).toBe('aria')
  })

  it('앞뒤 공백을 떼어낸다', () => {
    const result = Peer.create({ id: ME, displayName: '  지민  ', character: 'nova' })

    expect(result.ok && result.value.displayName).toBe('지민')
  })

  it('빈 이름을 거절한다', () => {
    const result = Peer.create({ id: ME, displayName: '   ', character: 'nova' })

    expect(!result.ok && result.error.code).toBe('empty')
  })

  it(`${peerLimits.maxNameLength}자를 넘는 이름을 거절한다`, () => {
    const result = Peer.create({
      id: ME,
      displayName: '가'.repeat(peerLimits.maxNameLength + 1),
      character: 'nova',
    })

    expect(!result.ok && result.error.code).toBe('too-long')
  })

  it('처음에는 한 번도 못 본 상태다', () => {
    expect(makePeer().lastSeenAt).toBeNull()
  })
})

describe('소식 듣기', () => {
  it('마지막으로 본 시각을 적어둔다', () => {
    const peer = makePeer()

    const seen = peer.seenAt(new Date(1758000000000))

    expect(seen.ok && seen.value.lastSeenAt?.getTime()).toBe(1758000000000)
  })

  it('늦게 도착한 옛 신호가 시각을 되돌리지 않는다', () => {
    // 길을 갈아탈 때 먼저 보낸 신호가 나중에 도착할 수 있다
    const peer = makePeer()
    const recent = peer.seenAt(new Date(1758000005000))
    if (!recent.ok) throw new Error('앞선 단계가 실패했다')

    const stale = recent.value.seenAt(new Date(1758000000000))

    expect(stale.ok && stale.value.lastSeenAt?.getTime()).toBe(1758000005000)
  })

  it('올바르지 않은 시각을 거절한다', () => {
    const result = makePeer().seenAt(new Date('말도 안 되는 날짜'))

    expect(!result.ok && result.error.code).toBe('invalid-value')
  })
})

describe('지금 상대가 어떤 상태인가', () => {
  it('한 번도 못 봤으면 그렇게 말한다', () => {
    expect(makePeer().presence(new Date(1758000000000), STALE_AFTER)).toBe('never-seen')
  })

  it('앱을 보고 있으면 여기 있다고 한다', () => {
    const seen = makePeer().seenAt(new Date(1758000000000))
    if (!seen.ok) throw new Error('앞선 단계가 실패했다')

    const present = seen.value.withForeground(true)

    expect(present.presence(new Date(1758000001000), STALE_AFTER)).toBe('here')
  })

  it('연결은 살아 있지만 앱이 뒤에 있으면 자는 것으로 본다', () => {
    // 이때 상대 캐릭터가 눈을 감는다
    const seen = makePeer().seenAt(new Date(1758000000000))
    if (!seen.ok) throw new Error('앞선 단계가 실패했다')

    expect(seen.value.presence(new Date(1758000001000), STALE_AFTER)).toBe('background')
  })

  it('한동안 소식이 없으면 떠난 것으로 본다', () => {
    const seen = makePeer().seenAt(new Date(1758000000000))
    if (!seen.ok) throw new Error('앞선 단계가 실패했다')
    const present = seen.value.withForeground(true)

    expect(present.presence(new Date(1758000000000 + STALE_AFTER + 1), STALE_AFTER)).toBe(
      'away',
    )
  })
})

describe('바꾸기', () => {
  it('캐릭터를 바꿔도 마지막으로 본 시각은 남는다', () => {
    const seen = makePeer().seenAt(new Date(1758000000000))
    if (!seen.ok) throw new Error('앞선 단계가 실패했다')

    const changed = seen.value.withCharacter('orion')

    expect(changed.character).toBe('orion')
    expect(changed.lastSeenAt?.getTime()).toBe(1758000000000)
  })

  it('이름을 바꿔도 마지막으로 본 시각은 남는다', () => {
    const seen = makePeer().seenAt(new Date(1758000000000))
    if (!seen.ok) throw new Error('앞선 단계가 실패했다')

    const renamed = seen.value.rename('지민')

    expect(renamed.ok && renamed.value.displayName).toBe('지민')
    expect(renamed.ok && renamed.value.lastSeenAt?.getTime()).toBe(1758000000000)
  })

  it('바꿀 수 없는 이름은 거절하고 원래 값을 지킨다', () => {
    const peer = makePeer()

    const result = peer.rename('')

    expect(result.ok).toBe(false)
    expect(peer.displayName).toBe('여자친구')
  })

  it('바꿔도 원래 객체는 그대로다', () => {
    const peer = makePeer()

    peer.withCharacter('luna')

    expect(peer.character).toBe('aria')
  })
})
