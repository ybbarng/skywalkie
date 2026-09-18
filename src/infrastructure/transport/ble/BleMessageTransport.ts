import { loadBlePeripheral } from '@ble/index'
import { Platform } from 'react-native'
import type { Envelope } from '@/application/ports/Envelope'
import { worthSendingOnNarrowLink } from '@/application/ports/Envelope'
import type { MessageTransport, Unsubscribe } from '@/application/ports/MessageTransport'
import { ConnectionState } from '@/domain/connection/ConnectionState'
import { LinkQuality } from '@/domain/connection/LinkQuality'
import { type DomainError, domainError } from '@/domain/shared/DomainError'
import { err, ok, type Result } from '@/domain/shared/Result'
import { decodeEnvelope, encodeEnvelope } from '../protocol/EnvelopeSchema'
import { base64ToBytes, bytesToBase64 } from './base64'
import { BLE_UUIDS, loadBle } from './bleModule'
import { CONSERVATIVE_MTU, chunk, decodeChunk, encodeChunk } from './chunk/Chunker'
import { Reassembler } from './chunk/Reassembler'

/**
 * 블루투스로 글을 나른다.
 *
 * **핫스팟을 못 쓸 때 남는 마지막 길이다.** 항공사가 개인 핫스팟을
 * 금지할 수 있어서 만든다.
 *
 * 역할이 Wi-Fi 와 반대다. **아이폰이 알리고 안드로이드가 찾는다.**
 * iOS 는 화면이 꺼져도 제한적으로 알림을 이어가고, 안드로이드는 찾는
 * 동작에 제약이 적다. 각 운영체제가 잘하는 쪽에 맞췄다.
 *
 * ## 글만 간다
 *
 * 사진과 낙서는 안 보낸다. 한 번에 185바이트씩 가는 길로 몇백 KB 를
 * 밀어 넣으면 **글이 몇 분 동안 막힌다.** Wi-Fi 가 열릴 때까지 기다린다.
 *
 * ## 없으면 없는 대로 둔다
 *
 * 모듈이 없거나 빌드가 어긋났으면 `connect()` 가 실패할 뿐이다.
 * 여기서 앱이 죽으면 Wi-Fi 로도 못 쓰게 된다.
 *
 * (docs/04-transport-spec.md 4장 · T20)
 */
export class BleMessageTransport implements MessageTransport {
  readonly kind = 'ble' as const

  // biome-ignore lint/suspicious/noExplicitAny: 네이티브 모듈 타입이다
  private manager: any = null
  // biome-ignore lint/suspicious/noExplicitAny: 위와 같다
  private device: any = null

  private state = ConnectionState.idle()
  private readonly receivers = new Set<(envelope: Envelope) => void>()
  private readonly watchers = new Set<(state: ConnectionState) => void>()
  private readonly reassembler = new Reassembler()
  private readonly subscriptions: Array<{ remove(): void }> = []

  private bundle = 0
  private mtu = CONSERVATIVE_MTU

  /** 아이폰은 알리고 안드로이드는 찾는다 */
  private get role(): 'advertiser' | 'scanner' {
    return Platform.OS === 'ios' ? 'advertiser' : 'scanner'
  }

  async connect(): Promise<Result<void, DomainError>> {
    this.moveTo(this.state.startSearching())

    return this.role === 'advertiser' ? this.advertise() : this.scan()
  }

  async disconnect(): Promise<void> {
    for (const subscription of this.subscriptions) {
      try {
        subscription.remove()
      } catch {
        // 이미 떨어졌다
      }
    }
    this.subscriptions.length = 0
    this.reassembler.clear()

    try {
      if (this.role === 'advertiser') {
        const peripheral = loadBlePeripheral()
        if (peripheral.available) await peripheral.module.stop()
      } else {
        await this.device?.cancelConnection?.()
        this.manager?.destroy?.()
      }
    } catch {
      // 이미 끊겼다
    }

    this.device = null
    this.manager = null
    this.moveTo(this.state.stop())
  }

  async send(envelope: Envelope): Promise<Result<void, DomainError>> {
    // **좁은 길을 실제 대화에 양보한다.** 입력 중 표시와 사진 조각은
    // 여기로 안 보낸다.
    if (!worthSendingOnNarrowLink(envelope.t)) return ok(undefined)

    const encoded = encodeEnvelope(envelope)
    if (!encoded.ok) return encoded

    const payload = new TextEncoder().encode(encoded.value)
    const parts = chunk(payload, this.bundle, this.mtu)
    if (!parts.ok) return parts

    this.bundle = (this.bundle + 1) % 256

    for (const part of parts.value) {
      const sent = await this.writeRaw(encodeChunk(part))
      // **하나가 실패하면 멈춘다.** 계속 밀어 넣으면 조용히 버려지고,
      // 상대는 반쪽짜리 묶음을 5초 들고 있다 버린다.
      if (!sent) {
        return err(domainError('not-found', '블루투스로 보내지 못했다', 'ble'))
      }
    }

    return ok(undefined)
  }

  onReceive(handler: (envelope: Envelope) => void): Unsubscribe {
    this.receivers.add(handler)
    return () => this.receivers.delete(handler)
  }

  onStateChange(handler: (state: ConnectionState) => void): Unsubscribe {
    this.watchers.add(handler)
    return () => this.watchers.delete(handler)
  }

  currentState(): ConnectionState {
    return this.state
  }

  quality(): LinkQuality {
    // 블루투스는 늘 좁다. 재보지 않아도 안다.
    return LinkQuality.unknown('ble')
  }

  /** 아이폰: 자기를 알린다 */
  private async advertise(): Promise<Result<void, DomainError>> {
    const peripheral = loadBlePeripheral()
    if (!peripheral.available) {
      return err(domainError('not-found', peripheral.why, 'ble'))
    }

    try {
      this.subscriptions.push(
        peripheral.module.addListener('onReceive', event => {
          this.onRaw(base64ToBytes(event.data))
        }),
      )

      this.subscriptions.push(
        peripheral.module.addListener('onSubscribe', event => {
          if (event.subscribed) {
            // 상대가 알려준 크기에 맞춘다. 넘기면 조용히 잘린다.
            if (event.mtu > 0) this.mtu = Math.min(event.mtu, CONSERVATIVE_MTU)
            this.moveTo(this.state.startHandshake('ble'))
            this.moveTo(this.state.establish())
          } else {
            this.moveTo(this.state.lose())
          }
        }),
      )

      await peripheral.module.start('Skywalkie')
      return ok(undefined)
    } catch (cause) {
      return err(wrap(cause, '블루투스로 알리지 못했다'))
    }
  }

  /** 안드로이드: 상대를 찾는다 */
  private async scan(): Promise<Result<void, DomainError>> {
    const ble = loadBle()
    if (!ble.available) return err(domainError('not-found', ble.why, 'ble'))

    try {
      this.manager = new ble.module.BleManager()

      return await new Promise<Result<void, DomainError>>(resolve => {
        let settled = false

        const finish = (result: Result<void, DomainError>) => {
          if (settled) return
          settled = true
          resolve(result)
        }

        this.manager.startDeviceScan(
          [BLE_UUIDS.service],
          null,
          // biome-ignore lint/suspicious/noExplicitAny: 네이티브 모듈 타입이다
          (error: any, device: any) => {
            if (error !== null) {
              finish(err(wrap(error, '블루투스로 찾지 못했다')))
              return
            }
            if (device === null) return

            this.manager.stopDeviceScan()
            void this.attach(device).then(finish)
          },
        )

        // 한참 못 찾으면 접는다. 계속 찾으면 배터리만 준다.
        setTimeout(() => {
          try {
            this.manager?.stopDeviceScan?.()
          } catch {
            // 이미 멈췄다
          }
          finish(err(domainError('not-found', '블루투스로 상대를 못 찾았다', 'ble')))
        }, SCAN_TIMEOUT_MS)
      })
    } catch (cause) {
      return err(wrap(cause, '블루투스를 열지 못했다'))
    }
  }

  // biome-ignore lint/suspicious/noExplicitAny: 네이티브 모듈 타입이다
  private async attach(found: any): Promise<Result<void, DomainError>> {
    try {
      this.moveTo(this.state.startHandshake('ble'))

      this.device = await found.connect()
      await this.device.discoverAllServicesAndCharacteristics()

      const negotiated = await this.device.requestMTU?.(CONSERVATIVE_MTU)
      if (typeof negotiated?.mtu === 'number') {
        this.mtu = Math.min(negotiated.mtu, CONSERVATIVE_MTU)
      }

      this.subscriptions.push(
        this.device.monitorCharacteristicForService(
          BLE_UUIDS.service,
          BLE_UUIDS.outbox,
          // biome-ignore lint/suspicious/noExplicitAny: 네이티브 모듈 타입이다
          (error: any, characteristic: any) => {
            if (error !== null || characteristic?.value == null) return
            this.onRaw(base64ToBytes(characteristic.value))
          },
        ),
      )

      this.moveTo(this.state.establish())
      return ok(undefined)
    } catch (cause) {
      return err(wrap(cause, '블루투스로 잇지 못했다'))
    }
  }

  private async writeRaw(raw: Uint8Array): Promise<boolean> {
    const base64 = bytesToBase64(raw)

    try {
      if (this.role === 'advertiser') {
        const peripheral = loadBlePeripheral()
        if (!peripheral.available) return false
        return await peripheral.module.send(base64)
      }

      if (this.device === null) return false
      await this.device.writeCharacteristicWithoutResponseForService(
        BLE_UUIDS.service,
        BLE_UUIDS.inbox,
        base64,
      )
      return true
    } catch {
      return false
    }
  }

  /** 조각이 왔다. 다 모이면 봉투로 바꿔 올린다 */
  private onRaw(raw: Uint8Array): void {
    const part = decodeChunk(raw)
    // 이상한 조각은 버리되 **연결은 끊지 않는다.** 같은 방의 다른
    // 기기가 보낸 것일 수 있다.
    if (!part.ok) return

    const joined = this.reassembler.accept(part.value, Date.now())
    if (joined === null) return

    const outcome = decodeEnvelope(new TextDecoder().decode(joined))
    // 모르는 봉투가 와도 끊지 않는다. 상대가 새 버전일 수 있다.
    if (outcome.kind !== 'ok') return

    for (const handler of this.receivers) {
      try {
        handler(outcome.envelope)
      } catch {
        // 듣는 쪽 잘못이다. 나머지에게는 계속 알린다.
      }
    }
  }

  private moveTo(result: Result<ConnectionState, DomainError>): void {
    if (!result.ok) return
    this.state = result.value

    for (const watcher of this.watchers) {
      try {
        watcher(result.value)
      } catch {
        // 위와 같다
      }
    }
  }
}

/** 이만큼 못 찾으면 접는다. 계속 찾으면 배터리만 준다 */
const SCAN_TIMEOUT_MS = 20_000

function wrap(cause: unknown, what: string): DomainError {
  const detail = cause instanceof Error ? cause.message : String(cause)
  return domainError('not-found', `${what}: ${detail}`, 'ble')
}
