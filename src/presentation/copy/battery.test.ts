import { describe, expect, it } from 'vitest'
import {
  myBatteryNote,
  peerBatteryNote,
  SHOW_PEER_BATTERY_BELOW,
  shouldSuggestVideoOff,
  URGE_SAVING_BELOW,
  WARN_MY_BATTERY_BELOW,
} from './battery'

/**
 * 배터리 안내.
 *
 * **비행기에서 폰이 죽으면 대화가 끝난다.** 상대가 갑자기 조용해졌을 때
 * 잠든 것인지 폰이 죽은 것인지 알 수 있어야 한다.
 */

describe('상대 배터리', () => {
  it('넉넉하면 아무 말도 안 한다', () => {
    // 늘 띄워두면 잔소리가 된다. 볼 이유가 없을 때는 안 보인다.
    expect(peerBatteryNote(0.8, '지민')).toBeNull()
    expect(peerBatteryNote(SHOW_PEER_BATTERY_BELOW + 0.01, '지민')).toBeNull()
  })

  it('줄어들면 알려준다', () => {
    const note = peerBatteryNote(0.25, '지민')

    expect(note).not.toBeNull()
    expect(note).toContain('지민')
    expect(note).toContain('25%')
  })

  it('많이 줄면 곧 꺼질 수 있다고 말한다', () => {
    // **그래야 갑자기 조용해져도 놀라지 않는다**
    const note = peerBatteryNote(URGE_SAVING_BELOW, '지민')

    expect(note).toContain('꺼질')
  })
})

describe('내 배터리', () => {
  it('넉넉하면 아무 말도 안 한다', () => {
    expect(myBatteryNote(0.5, 'host', false)).toBeNull()
  })

  it('핫스팟을 켠 쪽에게는 왜 빨리 주는지 알려준다', () => {
    // **끄라고 하지 않는다.** 끄면 대화가 끊긴다.
    const note = myBatteryNote(0.15, 'host', false)

    expect(note).toContain('핫스팟')
    expect(note).toContain('보조 배터리')
    expect(note).not.toContain('끄세요')
  })

  it('통화 중이면 통화를 끊으라고 한다', () => {
    // 통화가 배터리를 가장 많이 먹는다. 글은 거의 안 먹는다.
    const note = myBatteryNote(0.15, 'host', true)

    expect(note).toContain('통화')
  })

  it('붙는 쪽에게는 다른 말을 한다', () => {
    // 핫스팟을 안 켰으니 핫스팟 이야기를 하면 헷갈린다
    const note = myBatteryNote(0.15, 'guest', false)

    expect(note).not.toContain('핫스팟')
  })

  it('알리는 선이 상대에게 보여주는 선보다 낮다', () => {
    // 내 것은 더 급할 때만 말한다. 내 배터리는 내가 이미 본다.
    expect(WARN_MY_BATTERY_BELOW).toBeLessThan(SHOW_PEER_BATTERY_BELOW)
  })
})

describe('영상 통화 접기', () => {
  it('배터리가 줄면 접자고 한다', () => {
    expect(shouldSuggestVideoOff(0.2)).toBe(true)
    expect(shouldSuggestVideoOff(0.1)).toBe(true)
  })

  it('넉넉하면 두고 본다', () => {
    expect(shouldSuggestVideoOff(0.5)).toBe(false)
  })
})
