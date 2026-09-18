import type { IdGenerator } from '@/domain/shared/IdGenerator'
import {
  defaultPreferences,
  type KnownPeer,
  type Preferences,
  type Profile,
  settings as settingsImpl,
} from '@/infrastructure/platform/Settings'
import {
  makePeerId as makePeerIdImpl,
  ulidGenerator,
} from '@/infrastructure/platform/UlidGenerator'

/**
 * 화면이 쓰는 것들을 여기서 한 번 거친다.
 *
 * **화면은 구현을 직접 가져오지 않는다.** 층 검사(`pnpm check:deps`)가
 * 이걸 막는다. 조립하는 곳만이 "지금 무엇을 끼웠는지" 안다.
 *
 * 이 파일에는 **조립만 있고 판단이 없다.** 무엇을 할지 정하는 코드가
 * 여기 들어오기 시작하면 층 구분이 의미를 잃는다.
 * (docs/03-architecture.md)
 */

export const ids: IdGenerator = ulidGenerator

export const makePeerId = makePeerIdImpl

export const settings = settingsImpl

/** 이만큼 지나도 상대를 못 찾으면 코드 입력을 권한다 */
export { OFFER_MANUAL_AFTER_MS } from '@/infrastructure/transport/wifi/DiscoveryPlan'

/** 지금 어느 망에 붙어 있나. 핫스팟이 꺼진 것을 알아채는 데 쓴다 */
export { readNetwork } from '@/infrastructure/transport/wifi/NetworkInfo'

export type { KnownPeer, Preferences, Profile }
export { defaultPreferences }
