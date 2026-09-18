import { describe, expect, it } from 'vitest'
import { isPrivateCandidate } from './WebRtcVoiceLink'

/**
 * 주소 후보 거르기.
 *
 * **바깥으로 나가려는 후보는 버린다.** 비행기에는 인터넷이 없어서
 * 어차피 닿지 않는데, 그걸 시험하느라 기다리는 시간만 길어진다.
 * 10초 안에 안 트이면 통화를 접으므로, 그 시간을 헛되이 쓰면 안 된다.
 */

describe('사설망 후보만 쓴다', () => {
  it.each([
    ['핫스팟이 준 주소', 'candidate:1 1 udp 2122260223 192.168.43.5 51703 typ host'],
    ['10 으로 시작하는 망', 'candidate:2 1 udp 2122260223 10.0.0.7 51703 typ host'],
    ['172.16~31 대역', 'candidate:3 1 udp 2122260223 172.20.10.2 51703 typ host'],
    ['주소를 못 받았을 때', 'candidate:4 1 udp 2122260223 169.254.1.1 51703 typ host'],
  ])('%s 는 쓴다', (_label, candidate) => {
    expect(isPrivateCandidate(candidate)).toBe(true)
  })

  it.each([
    ['공인 주소', 'candidate:5 1 udp 2122260223 203.0.113.9 51703 typ srflx'],
    ['172.15 는 사설이 아니다', 'candidate:6 1 udp 2122260223 172.15.0.1 51703 typ host'],
    ['172.32 도 사설이 아니다', 'candidate:7 1 udp 2122260223 172.32.0.1 51703 typ host'],
  ])('%s 는 버린다', (_label, candidate) => {
    expect(isPrivateCandidate(candidate)).toBe(false)
  })

  it('가려진 주소는 쓴다', () => {
    // 요즘 브라우저와 기기는 사설 주소를 .local 이름으로 가린다.
    // 같은 망 안이라 이름으로도 닿는다. 버리면 통화가 아예 안 된다.
    expect(
      isPrivateCandidate(
        'candidate:8 1 udp 2122260223 a1b2c3d4-0000-0000-0000-000000000000.local 51703 typ host',
      ),
    ).toBe(true)
  })

  it('빈 글은 버린다', () => {
    expect(isPrivateCandidate('')).toBe(false)
  })

  it('주소가 없는 글은 버린다', () => {
    expect(isPrivateCandidate('candidate:9 typ host')).toBe(false)
  })
})
