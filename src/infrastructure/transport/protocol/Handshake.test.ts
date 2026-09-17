import { HER } from '@test/support/factories'
import { describe, expect, it } from 'vitest'
import type { HelloPayload } from '@/application/ports/Envelope'
import { PROTOCOL_VERSION } from '@/application/ports/Envelope'
import { judgeHello, missingAfterHandshake } from './Handshake'

function hello(overrides: Partial<HelloPayload & { v: number }> = {}) {
  return {
    v: PROTOCOL_VERSION,
    peerId: HER,
    displayName: '여자친구',
    character: 'aria' as const,
    pairingCode: 'K7M2PX',
    lastSeenSeq: 0,
    appVersion: '0.1.0',
    ...overrides,
  }
}

describe('상대의 인사 받아들이기', () => {
  it('코드가 맞으면 받아들인다', () => {
    const decision = judgeHello({ hello: hello(), myPairingCode: 'K7M2PX' })

    expect(decision.ok && decision.value.accepted).toBe(true)
  })

  it('코드가 다르면 거절한다', () => {
    // 같은 Wi-Fi 에 다른 사람이 붙어 있을 수 있다
    const decision = judgeHello({ hello: hello(), myPairingCode: 'AAAAAA' })

    expect(decision.ok && decision.value.accepted).toBe(false)
    expect(decision.ok && decision.value.reason).toBe('code-mismatch')
  })

  it('상대 코드 형식이 틀리면 거절한다', () => {
    const decision = judgeHello({
      hello: hello({ pairingCode: '000000' }),
      myPairingCode: 'K7M2PX',
    })

    expect(decision.ok && decision.value.accepted).toBe(false)
  })

  it('대소문자가 달라도 같은 코드로 본다', () => {
    const decision = judgeHello({
      hello: hello({ pairingCode: 'k7m2px' }),
      myPairingCode: 'K7M2PX',
    })

    expect(decision.ok && decision.value.accepted).toBe(true)
  })

  it('내 코드가 올바르지 않으면 실패를 알린다', () => {
    // 우리 앱의 버그다. 상대 탓으로 돌리면 안 된다.
    const decision = judgeHello({ hello: hello(), myPairingCode: '틀림' })

    expect(decision.ok).toBe(false)
  })
})

describe('버전이 다를 때', () => {
  it('상대가 더 새 버전이어도 붙는다', () => {
    // 여기서 끊으면 한쪽만 업데이트했을 때 대화가 통째로 안 된다
    const decision = judgeHello({
      hello: hello({ v: PROTOCOL_VERSION + 5 }),
      myPairingCode: 'K7M2PX',
    })

    expect(decision.ok && decision.value.accepted).toBe(true)
  })

  it('낮은 쪽에 맞춘다', () => {
    const decision = judgeHello({
      hello: hello({ v: PROTOCOL_VERSION + 5 }),
      myPairingCode: 'K7M2PX',
    })

    expect(decision.ok && decision.value.agreedVersion).toBe(PROTOCOL_VERSION)
  })

  it('상대가 더 새 버전이면 그렇다고 알려준다', () => {
    // 화면에 "상대 앱이 더 새 버전이에요"라고 띄울 수 있다
    const decision = judgeHello({
      hello: hello({ v: PROTOCOL_VERSION + 1 }),
      myPairingCode: 'K7M2PX',
    })

    expect(decision.ok && decision.value.peerIsNewer).toBe(true)
  })

  it('너무 낡은 앱이면 거절한다', () => {
    const decision = judgeHello({
      hello: hello({ v: 0 }),
      myPairingCode: 'K7M2PX',
    })

    expect(decision.ok && decision.value.reason).toBe('version-too-old')
  })
})

describe('인사 뒤에 놓친 것 찾기', () => {
  it('끊긴 동안 상대가 보낸 것을 알아챈다', () => {
    // 내가 3번까지 받았는데 상대는 7번까지 보냈다
    const missing = missingAfterHandshake(3, 7, [])

    expect(missing).toEqual([4, 5, 6, 7])
  })

  it('이미 알고 있던 빈틈과 합친다', () => {
    const missing = missingAfterHandshake(5, 7, [2])

    expect(missing).toEqual([2, 6, 7])
  })

  it('놓친 게 없으면 빈 목록이다', () => {
    expect(missingAfterHandshake(7, 7, [])).toEqual([])
  })

  it('상대가 나보다 적게 보냈다고 하면 새로 늘리지 않는다', () => {
    // 상대가 앱을 새로 깔았을 때 이렇게 된다
    const missing = missingAfterHandshake(10, 3, [])

    expect(missing).toEqual([])
  })

  it('순서대로 줄 세운다', () => {
    const missing = missingAfterHandshake(5, 8, [3, 1])

    expect(missing).toEqual([1, 3, 6, 7, 8])
  })
})
