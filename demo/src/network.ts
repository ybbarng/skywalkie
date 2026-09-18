/**
 * 가상 사설망.
 *
 * **핫스팟도 Wi-Fi 도 없이 진짜 앱 코드를 돌리려고 만든다.** 브라우저
 * 안에서 안드로이드 핫스팟과 아이폰이 붙는 과정을 그대로 흉내 낸다.
 *
 * 흉내 내는 것은 **선까지만**이다. 그 위에 얹히는 봉투 형식, 바이트
 * 자르기, 대화 상태, 놓친 말 되찾기는 전부 `src/` 의 진짜 코드다.
 *
 * ```
 *  안드로이드                          아이폰
 * ┌──────────────┐                  ┌──────────────┐
 * │ 핫스팟 켜기   │◀── 붙기 ────────│ Wi-Fi 목록에서│
 * │ 192.168.43.1 │                  │ 골라서 붙기   │
 * └──────────────┘                  └──────────────┘
 * ```
 *
 * (docs/04-transport-spec.md 2장)
 */

export const HOTSPOT_SSID = 'ybbarng-hotspot'
export const HOST_ADDRESS = '192.168.43.1'
export const GUEST_ADDRESS = '192.168.43.24'

export type Side = 'host' | 'guest'

export interface NetworkEvent {
  readonly at: number
  readonly side: Side | 'net'
  readonly text: string
  readonly kind: 'info' | 'send' | 'recv' | 'warn'
}

/** 선 한 가닥. 바이트만 나른다 */
export interface Wire {
  send(bytes: Uint8Array): boolean
  close(): void
}

interface Listener {
  readonly side: Side
  onBytes(bytes: Uint8Array): void
  onClosed(): void
}

/**
 * 사설망 하나.
 *
 * 핫스팟이 꺼져 있으면 아무도 못 찾는다. 켜야 붙을 자리가 생긴다.
 */
export class VirtualNetwork {
  /** 핫스팟이 켜져 있나 */
  hotspotOn = false
  /** 아이폰이 그 Wi-Fi 에 붙어 있나 */
  guestJoined = false

  /** 선을 타는 데 걸리는 시간. 사설망은 보통 아주 빠르다 */
  latencyMs = 40
  /** 얼마나 잃어버리나. 0 이면 완벽 */
  lossRate = 0
  /** 바이트를 몇 조각으로 쪼개 보낼까. 실제 소켓이 이렇게 준다 */
  chop = 1

  private readonly listeners = new Map<Side, Listener>()
  private linked = false

  readonly log: NetworkEvent[] = []
  onLog: ((event: NetworkEvent) => void) | null = null
  onChange: (() => void) | null = null

  note(side: Side | 'net', text: string, kind: NetworkEvent['kind'] = 'info'): void {
    const event = { at: Date.now(), side, text, kind }
    this.log.push(event)
    if (this.log.length > 300) this.log.shift()
    this.onLog?.(event)
  }

  /** 안드로이드가 핫스팟을 켠다 */
  setHotspot(on: boolean): void {
    if (this.hotspotOn === on) return
    this.hotspotOn = on

    if (on) {
      this.note('host', `핫스팟을 켰어요 · ${HOTSPOT_SSID} · ${HOST_ADDRESS}`)
    } else {
      this.note('host', '핫스팟을 껐어요', 'warn')
      // 핫스팟이 꺼지면 붙어 있던 것도 떨어진다
      this.setGuestJoined(false)
    }

    this.onChange?.()
  }

  /** 아이폰이 그 Wi-Fi 에 붙거나 떨어진다 */
  setGuestJoined(joined: boolean): void {
    if (this.guestJoined === joined) return

    if (joined && !this.hotspotOn) {
      this.note('guest', '그 Wi-Fi 가 안 보여요. 상대가 안 켰어요', 'warn')
      return
    }

    this.guestJoined = joined
    this.note(
      'guest',
      joined ? `${HOTSPOT_SSID} 에 들어왔어요 · ${GUEST_ADDRESS}` : 'Wi-Fi 에서 나왔어요',
      joined ? 'info' : 'warn',
    )

    if (!joined) this.unlink('망에서 나감')
    this.onChange?.()
  }

  /**
   * 아이폰이 상대를 찾는다.
   *
   * 실제로는 게이트웨이에 걸어보고, 안 되면 소리쳐 부르고, 그래도
   * 안 되면 훑는다. 여기서는 **같은 망에 있고 상대가 듣고 있으면**
   * 찾은 것으로 본다. (docs/04-transport-spec.md 2.3)
   */
  discover(): { found: boolean; address: string | null } {
    if (!this.guestJoined || !this.hotspotOn) {
      this.note('guest', '같은 망에 없어서 못 찾아요', 'warn')
      return { found: false, address: null }
    }

    if (!this.listeners.has('host')) {
      this.note('guest', '상대 앱이 안 열려 있어요', 'warn')
      return { found: false, address: null }
    }

    this.note('guest', `게이트웨이(${HOST_ADDRESS})에 바로 걸었어요 · 찾았어요`)
    return { found: true, address: HOST_ADDRESS }
  }

  /** 앱이 선을 기다리기 시작한다 */
  listen(side: Side, listener: Listener): void {
    this.listeners.set(side, listener)
  }

  stopListening(side: Side): void {
    this.listeners.delete(side)
  }

  /** 아이폰이 찾은 주소로 붙는다 */
  connect(): boolean {
    if (!this.hotspotOn || !this.guestJoined) return false
    if (!this.listeners.has('host') || !this.listeners.has('guest')) return false

    this.linked = true
    this.note('net', '선이 이어졌어요 · TCP 51704')
    this.onChange?.()
    return true
  }

  isLinked(): boolean {
    return this.linked && this.hotspotOn && this.guestJoined
  }

  unlink(why: string): void {
    if (!this.linked) return
    this.linked = false
    this.note('net', `선이 끊겼어요 · ${why}`, 'warn')

    for (const listener of this.listeners.values()) listener.onClosed()
    this.onChange?.()
  }

  /**
   * 바이트를 보낸다.
   *
   * **한 번에 다 가지 않는다.** 실제 소켓이 그렇다. 조각조각 나뉘어
   * 가고, 사이에 시간이 든다.
   */
  send(from: Side, bytes: Uint8Array): boolean {
    if (!this.isLinked()) return false

    const to: Side = from === 'host' ? 'guest' : 'host'
    const listener = this.listeners.get(to)
    if (listener === undefined) return false

    if (this.lossRate > 0 && Math.random() < this.lossRate) {
      this.note('net', `${bytes.byteLength}바이트를 잃어버렸어요`, 'warn')
      return true
    }

    for (const piece of this.chopUp(bytes)) {
      setTimeout(() => {
        if (!this.isLinked()) return
        listener.onBytes(piece)
      }, this.latencyMs)
    }

    return true
  }

  private chopUp(bytes: Uint8Array): Uint8Array[] {
    if (this.chop <= 1 || bytes.byteLength <= 1) return [bytes]

    const size = Math.max(1, Math.ceil(bytes.byteLength / this.chop))
    const pieces: Uint8Array[] = []

    for (let at = 0; at < bytes.byteLength; at += size) {
      pieces.push(bytes.subarray(at, Math.min(at + size, bytes.byteLength)))
    }
    return pieces
  }
}
