import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 한쪽으로 안 되면 반대쪽으로 돌아서는가.
 *
 * **알리는 장치가 없는 안드로이드가 있다.** 아이폰도 다른 앱이 이미
 * 알리고 있으면 자리를 못 잡는다. 그때 가만히 있으면 대화를 통째로 못
 * 한다. 비행기에서는 이것뿐이라 더 그렇다.
 *
 * 무전기 자체는 시험할 수 없지만 **어느 쪽을 어떤 차례로 해보는지**는
 * 여기서 확인할 수 있다.
 */

const peripheral = vi.hoisted(() => ({ available: false, why: '알리는 장치가 없다' }))
const central = vi.hoisted(() => ({ available: false, why: '찾는 모듈이 없다' }))
const asked = vi.hoisted(() => ({ allowed: true }))

vi.mock('@ble/index', () => ({
  loadBlePeripheral: () => peripheral,
}))

vi.mock('./bleModule', () => ({
  loadBle: () => central,
  BLE_UUIDS: {
    service: 'F7D5061F-298D-46DB-BE86-D1E0C757AB23',
    inbox: '0F52C6B6-FDDA-4E0C-886A-0BB1CA261494',
    outbox: '8966097A-CE16-4B4B-99C4-5DD2409FC9F7',
    status: 'F9F2387C-9014-4C34-AB13-EC01330DB314',
    control: '57998665-F536-4E22-BBE8-0302580269C6',
  },
}))

vi.mock('./blePermission', () => ({
  askForBluetooth: async () =>
    asked.allowed
      ? { ok: true as const, value: undefined }
      : {
          ok: false as const,
          error: { code: 'not-allowed', detail: '근처 기기를 못 쓴다', field: 'ble' },
        },
}))

const { BleMessageTransport } = await import('./BleMessageTransport')

/** 알리기가 되는 척한다. 붙었다는 신호까지 흉내 낸다 */
function peripheralWorks(): void {
  peripheral.available = true
  // biome-ignore lint/suspicious/noExplicitAny: 네이티브 모듈 흉내다
  ;(peripheral as any).module = {
    addListener: () => ({ remove: () => undefined }),
    start: async () => true,
    stop: async () => true,
    send: async () => true,
  }
}

beforeEach(() => {
  peripheral.available = false
  central.available = false
  asked.allowed = true
})

describe('여는 쪽은 알리기부터 해본다', () => {
  it('알리기가 되면 찾기는 안 해본다', async () => {
    peripheralWorks()
    const started = vi.fn()
    central.available = true
    // biome-ignore lint/suspicious/noExplicitAny: 위와 같다
    ;(central as any).module = {
      BleManager: class {
        startDeviceScan = started
        stopDeviceScan = () => undefined
        destroy = () => undefined
      },
    }

    const link = new BleMessageTransport('host')
    const opened = await link.connect()

    expect(opened.ok).toBe(true)
    // **첫 시도가 되면 거기서 멈춘다.** 둘 다 켜두면 연결이 두 개 생긴다.
    expect(started).not.toHaveBeenCalled()
  })

  it('알리기가 안 되면 찾기로 돌아선다', async () => {
    // 알리는 장치가 없는 안드로이드다
    const started = vi.fn()
    central.available = true
    // biome-ignore lint/suspicious/noExplicitAny: 위와 같다
    ;(central as any).module = {
      BleManager: class {
        startDeviceScan = started
        stopDeviceScan = () => undefined
        destroy = () => undefined
      },
    }

    const link = new BleMessageTransport('host')
    void link.connect()

    // 찾기를 시작했는지만 본다. 끝까지 가려면 20초를 기다려야 한다.
    await vi.waitFor(() => expect(started).toHaveBeenCalled())
  })
})

describe('붙는 쪽은 찾기부터 해본다', () => {
  it('찾기가 안 되면 알리기로 돌아선다', async () => {
    peripheralWorks()

    const link = new BleMessageTransport('guest')
    const opened = await link.connect()

    // 찾는 모듈이 없어서 알리기로 넘어갔고, 그쪽은 된다
    expect(opened.ok).toBe(true)
  })
})

describe('둘 다 안 될 때', () => {
  it('먼저 해본 쪽의 까닭을 올린다', async () => {
    // 제자리가 알리기인데 그것도 없고 찾기도 없다
    const link = new BleMessageTransport('host')
    const opened = await link.connect()

    expect(opened.ok).toBe(false)
    if (opened.ok) return

    // **화면에 띄울 말로는 제자리 쪽 까닭이 맞다.** 반대쪽은
    // 어차피 덤으로 해본 것이다.
    expect(opened.error.detail).toContain('알리는 장치가 없다')
  })

  it('권한을 안 주면 찾기를 시작하지도 않는다', async () => {
    asked.allowed = false
    const started = vi.fn()
    central.available = true
    // biome-ignore lint/suspicious/noExplicitAny: 위와 같다
    ;(central as any).module = {
      BleManager: class {
        startDeviceScan = started
        stopDeviceScan = () => undefined
        destroy = () => undefined
      },
    }

    const link = new BleMessageTransport('guest')
    const opened = await link.connect()

    expect(opened.ok).toBe(false)
    // 권한 없이 시작하면 오류도 안 나고 결과만 영영 안 온다
    expect(started).not.toHaveBeenCalled()
  })
})
