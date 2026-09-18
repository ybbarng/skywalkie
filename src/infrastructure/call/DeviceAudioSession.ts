import { Platform } from 'react-native'
import type { Unsubscribe } from '@/application/ports/MessageTransport'
import type { AudioMode, AudioRoute, AudioSession } from '@/application/ports/VoiceLink'
import { type DomainError, domainError } from '@/domain/shared/DomainError'
import { err, ok, type Result } from '@/domain/shared/Result'
import { headphonesJustUnplugged, planForAndroid, planForIos } from './audioPlan'
import { loadWebRtc } from './webrtcModule'

/**
 * 기기의 소리 길을 잡는다.
 *
 * 무엇을 요청할지는 `audioPlan` 이 정하고, 여기서는 그걸 기기에 전한다.
 *
 * ## 실패해도 통화를 접지 않는다
 *
 * 소리 설정이 어긋나면 "음악이 멎는다"거나 "음질이 나쁘다" 정도로
 * 끝난다. 그것 때문에 통화 자체를 못 하게 만들면 **얻는 것보다 잃는
 * 것이 크다.** 그래서 여기서 나오는 실패는 대개 위층이 무시한다.
 *
 * ## 기기 모듈이 없어도 앱은 돈다
 *
 * `react-native-webrtc` 가 소리 길 다루는 것까지 들고 있다. 없으면
 * 아무것도 안 하고 성공했다고 답한다. 통화가 어차피 안 되는 상황이라
 * 여기서 시끄럽게 할 이유가 없다.
 */
export class DeviceAudioSession implements AudioSession {
  private routeHandlers = new Set<(route: AudioRoute) => void>()
  private lastRoute: AudioRoute | null = null
  private stopWatching: (() => void) | null = null

  async activate(mode: AudioMode): Promise<Result<void, DomainError>> {
    const loaded = loadWebRtc()
    // 통화를 못 하는 기기다. 소리 길을 잡을 일도 없다.
    if (!loaded.available) return ok(undefined)

    try {
      if (Platform.OS === 'ios') {
        const plan = planForIos(mode)
        // biome-ignore lint/suspicious/noExplicitAny: 네이티브 모듈 타입이다
        const rtc = loaded.module as any
        await rtc.setAudioSessionConfiguration?.({
          category: plan.category,
          mode: plan.mode,
          categoryOptions: plan.options,
        })
      } else {
        const plan = planForAndroid(mode)
        // biome-ignore lint/suspicious/noExplicitAny: 네이티브 모듈 타입이다
        const rtc = loaded.module as any
        rtc.setAudioMode?.({
          usage: plan.usage,
          contentType: plan.contentType,
          focus: plan.focus,
          forceBuiltInMic: plan.forceBuiltInMic,
        })
      }

      this.watch()
      return ok(undefined)
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause)
      return err(
        domainError('invalid-value', `소리 길을 잡지 못했다: ${detail}`, 'audio'),
      )
    }
  }

  async deactivate(): Promise<Result<void, DomainError>> {
    this.stopWatching?.()
    this.stopWatching = null
    this.lastRoute = null

    const loaded = loadWebRtc()
    if (!loaded.available) return ok(undefined)

    try {
      // biome-ignore lint/suspicious/noExplicitAny: 네이티브 모듈 타입이다
      const rtc = loaded.module as any
      if (Platform.OS === 'ios') {
        await rtc.setAudioSessionConfiguration?.({
          category: 'ambient',
          mode: 'default',
          categoryOptions: ['mixWithOthers'],
        })
      } else {
        rtc.setAudioMode?.({ usage: 'USAGE_MEDIA', focus: 'AUDIOFOCUS_NONE' })
      }
      return ok(undefined)
    } catch {
      // 못 되돌렸다. 앱을 껐다 켜면 풀린다. 여기서 더 할 수 있는 게 없다.
      return ok(undefined)
    }
  }

  async currentRoute(): Promise<Result<AudioRoute, DomainError>> {
    const loaded = loadWebRtc()
    if (!loaded.available) return ok(defaultRoute())

    try {
      // biome-ignore lint/suspicious/noExplicitAny: 네이티브 모듈 타입이다
      const rtc = loaded.module as any
      const devices = await rtc.mediaDevices?.enumerateDevices?.()
      return ok(readRoute(devices))
    } catch {
      return ok(defaultRoute())
    }
  }

  onRouteChange(handler: (route: AudioRoute) => void): Unsubscribe {
    this.routeHandlers.add(handler)
    return () => this.routeHandlers.delete(handler)
  }

  /**
   * 소리 길이 바뀌는지 지켜본다.
   *
   * 기기가 알려주는 길이 플랫폼마다 달라서, **어느 쪽에서도 못 받으면
   * 주기적으로 들여다본다.** 이어폰이 빠진 것을 놓치면 스피커로
   * 대화가 새어나간다. 놓치는 것보다 자주 보는 편이 낫다.
   */
  private watch(): void {
    if (this.stopWatching !== null) return

    const timer = setInterval(() => {
      void (async () => {
        const route = await this.currentRoute()
        if (!route.ok) return

        const before = this.lastRoute
        this.lastRoute = route.value

        if (
          headphonesJustUnplugged(before, route.value) ||
          before === null ||
          before.output !== route.value.output
        ) {
          this.emit(route.value)
        }
      })()
    }, ROUTE_CHECK_MS)

    this.stopWatching = () => clearInterval(timer)
  }

  private emit(route: AudioRoute): void {
    for (const handler of this.routeHandlers) {
      try {
        handler(route)
      } catch {
        // 듣는 쪽 잘못이다. 나머지에게는 계속 알린다.
      }
    }
  }
}

/** 이어폰이 빠진 것을 이만큼 안에 알아챈다 */
const ROUTE_CHECK_MS = 1500

function defaultRoute(): AudioRoute {
  return { output: 'speaker', input: 'built-in', headphonesConnected: false }
}

/** 기기 목록에서 지금 어디로 나가는지 읽는다 */
export function readRoute(devices: unknown): AudioRoute {
  if (!Array.isArray(devices)) return defaultRoute()

  let hasBluetooth = false
  let hasWired = false

  for (const device of devices) {
    const label = String((device as { label?: unknown })?.label ?? '').toLowerCase()
    const kind = String((device as { kind?: unknown })?.kind ?? '')

    if (kind !== 'audiooutput' && kind !== 'audioinput') continue

    if (
      label.includes('bluetooth') ||
      label.includes('airpod') ||
      label.includes('buds')
    ) {
      hasBluetooth = true
    }
    if (
      label.includes('wired') ||
      label.includes('headset') ||
      label.includes('headphone')
    ) {
      hasWired = true
    }
  }

  if (hasBluetooth) {
    return { output: 'bluetooth', input: 'bluetooth', headphonesConnected: true }
  }
  if (hasWired) {
    return { output: 'wired', input: 'wired', headphonesConnected: true }
  }
  return defaultRoute()
}
