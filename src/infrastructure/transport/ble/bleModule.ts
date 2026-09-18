/**
 * 블루투스 모듈을 **안전하게** 들여온다.
 *
 * 통화 모듈과 같은 이유다. 네이티브라 빌드가 어긋나면 불러오는 순간
 * 터지는데, 맨 위에서 `import` 하면 **앱이 통째로 안 켜진다.**
 * 블루투스는 핫스팟을 못 쓸 때만 쓰는 보조 길인데, 그것 때문에 글도
 * 못 쓰게 되면 앞뒤가 안 맞는다.
 *
 * (docs/04-transport-spec.md 4장 · T20)
 */

export const BLE_UUIDS = {
  service: 'F7D5061F-298D-46DB-BE86-D1E0C757AB23',
  /** 내가 쓰는 자리. 상대가 읽는다 */
  inbox: '0F52C6B6-FDDA-4E0C-886A-0BB1CA261494',
  /** 상대가 알려주는 자리. 내가 듣는다 */
  outbox: '8966097A-CE16-4B4B-99C4-5DD2409FC9F7',
  status: 'F9F2387C-9014-4C34-AB13-EC01330DB314',
  control: '57998665-F536-4E22-BBE8-0302580269C6',
} as const

type LoadResult =
  // biome-ignore lint/suspicious/noExplicitAny: 네이티브 모듈이라 타입을 우리가 정하지 않는다
  | { readonly available: true; readonly module: any }
  | { readonly available: false; readonly why: string }

let cached: LoadResult | null = null

export function loadBle(): LoadResult {
  if (cached !== null) return cached

  try {
    const loaded = require('react-native-ble-plx')

    if (loaded === null || typeof loaded.BleManager !== 'function') {
      cached = {
        available: false,
        why: '블루투스 모듈이 제대로 안 들어 있다',
      }
      return cached
    }

    cached = { available: true, module: loaded }
    return cached
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause)
    cached = {
      available: false,
      why: `블루투스 모듈을 불러오지 못했다: ${detail}`,
    }
    return cached
  }
}

/** 이 기기에서 블루투스로 찾을 수 있나 */
export function canScan(): boolean {
  return loadBle().available
}

/** 시험에서 쓴다 */
export function resetBleCache(): void {
  cached = null
}
