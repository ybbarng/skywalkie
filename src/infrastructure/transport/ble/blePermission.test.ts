import { describe, expect, it } from 'vitest'
import {
  allGranted,
  BLUETOOTH_PERMISSION_CHANGED,
  BLUETOOTH_PERMISSIONS,
  neededPermissions,
} from './blePermission'

/**
 * 권한을 잘못 물으면 **오류도 없이 결과만 안 온다.** 그래서 여기가
 * 틀리면 비행기 안에서 "상대를 못 찾았다" 만 보고 손쓸 수 없다.
 */

describe('무엇을 물어야 하나', () => {
  it('아이폰은 물어볼 것이 없다', () => {
    expect(neededPermissions('ios', 18)).toEqual([])
  })

  it('안드로이드 12 부터는 근처 기기만 묻는다', () => {
    const needed = neededPermissions('android', BLUETOOTH_PERMISSION_CHANGED)

    expect(needed).toEqual([
      BLUETOOTH_PERMISSIONS.scan,
      BLUETOOTH_PERMISSIONS.connect,
      BLUETOOTH_PERMISSIONS.advertise,
    ])
  })

  it('안드로이드 12 부터는 위치를 묻지 않는다', () => {
    // 위치를 물으면 겁을 먹는다. `neverForLocation` 표시 덕에 안 물어도 된다.
    const needed = neededPermissions('android', 34)

    expect(needed).not.toContain(BLUETOOTH_PERMISSIONS.location)
  })

  it('안드로이드 11 이하는 위치로 찾는다', () => {
    // 옛 안드로이드는 이것 말고 다른 길이 없다
    expect(neededPermissions('android', 30)).toEqual([BLUETOOTH_PERMISSIONS.location])
  })
})

describe('다 받았는지 보기', () => {
  const needed = neededPermissions('android', 34)
  const allYes = Object.fromEntries(needed.map(name => [name, 'granted']))

  it('전부 받으면 시작한다', () => {
    expect(allGranted(needed, allYes)).toBe(true)
  })

  it('하나라도 빠지면 시작하지 않는다', () => {
    // **반쯤 받은 채로 찾기 시작하면 조용히 실패한다.** 오류가 안 나서
    // 왜 안 되는지 알 수 없는 것이 가장 나쁘다.
    const halfway = { ...allYes, [BLUETOOTH_PERMISSIONS.connect]: 'denied' }

    expect(allGranted(needed, halfway)).toBe(false)
  })

  it('다시 묻지 말라고 한 것도 못 받은 것으로 본다', () => {
    const blocked = { ...allYes, [BLUETOOTH_PERMISSIONS.scan]: 'never_ask_again' }

    expect(allGranted(needed, blocked)).toBe(false)
  })

  it('아예 답이 없는 것도 못 받은 것으로 본다', () => {
    expect(allGranted(needed, {})).toBe(false)
  })

  it('물을 것이 없으면 받은 것으로 본다', () => {
    // 아이폰이다. 운영체제가 알아서 묻는다.
    expect(allGranted([], {})).toBe(true)
  })
})
