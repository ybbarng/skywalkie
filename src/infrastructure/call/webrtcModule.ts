/**
 * WebRTC 모듈을 **안전하게** 들여온다.
 *
 * ## 왜 이렇게까지 하나
 *
 * 이 앱에서 절대 깨지면 안 되는 것은 **글로 주고받는 일**이다. 통화는
 * 되면 좋은 것이다. 그런데 `react-native-webrtc` 는 네이티브 모듈이라
 * 빌드가 어긋나거나 권한이 없으면 불러오는 순간 터진다.
 *
 * 맨 위에서 `import` 하면 그 순간 **앱이 통째로 안 켜진다.** 메시지도
 * 못 보낸다. 비행기에서 그러면 고칠 방법이 없다.
 *
 * 그래서 쓸 때가 되어서야 불러오고, 실패하면 "통화는 못 한다"고만
 * 답한다. 앱은 그대로 돈다.
 *
 * ## 한 번만 시도한다
 *
 * 실패한 결과를 기억해 둔다. 통화 버튼을 누를 때마다 다시 불러오려
 * 하면 그때마다 시간이 걸리고 기록만 쌓인다.
 */

export interface WebRtcModule {
  // biome-ignore lint/suspicious/noExplicitAny: 네이티브 모듈이라 타입을 우리가 정하지 않는다
  readonly RTCPeerConnection: any
  // biome-ignore lint/suspicious/noExplicitAny: 위와 같다
  readonly RTCSessionDescription: any
  // biome-ignore lint/suspicious/noExplicitAny: 위와 같다
  readonly RTCIceCandidate: any
  // biome-ignore lint/suspicious/noExplicitAny: 위와 같다
  readonly mediaDevices: any
  // biome-ignore lint/suspicious/noExplicitAny: 위와 같다
  readonly RTCView?: any
}

type LoadResult =
  | { readonly available: true; readonly module: WebRtcModule }
  | { readonly available: false; readonly why: string }

let cached: LoadResult | null = null

export function loadWebRtc(): LoadResult {
  if (cached !== null) return cached

  cached = attempt()
  return cached
}

function attempt(): LoadResult {
  try {
    // 일부러 정적 import 를 쓰지 않는다. 위 주석을 보라.
    // biome-ignore lint/style/useNodejsImportProtocol: 네이티브 모듈이다
    // biome-ignore lint/correctness/noUndeclaredVariables: react-native 의 require
    const loaded = require('react-native-webrtc')

    if (
      loaded === null ||
      typeof loaded !== 'object' ||
      typeof loaded.RTCPeerConnection !== 'function'
    ) {
      return { available: false, why: '통화 모듈이 제대로 들어 있지 않다' }
    }

    return { available: true, module: loaded as WebRtcModule }
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause)
    return { available: false, why: `통화 모듈을 불러오지 못했다: ${detail}` }
  }
}

/** 이 기기에서 통화를 할 수 있나. 화면이 버튼을 보일지 정하는 데 쓴다 */
export function canCall(): boolean {
  return loadWebRtc().available
}

/** 시험에서 쓴다. 기억해 둔 결과를 지운다 */
export function resetWebRtcCache(): void {
  cached = null
}
