/**
 * 우리가 늘 쓰는 핫스팟.
 *
 * **알고 있으면 붙는 쪽이 물어볼 일이 없다.**
 *
 * 떨어져 앉으면 이름도 비밀번호도 물어볼 수 없다. 그래서 앱이 미리
 * 알고 있다가 각자에게 자기가 할 말을 보여준다.
 *
 *   · 여는 쪽: "핫스팟 이름을 이걸로 맞춰두세요"
 *   · 붙는 쪽: "Wi-Fi 목록에서 이걸 고르고 이 비밀번호를 넣으세요"
 *
 * **앱이 대신 켜주거나 대신 붙어줄 수는 없다.** 안드로이드는 앱이
 * 핫스팟을 켜는 길이 10부터 막혔고, 아이폰에서 지정한 Wi-Fi 에 붙는
 * `NEHotspotConfiguration` 은 유료 개발자 계정의 권한이 있어야 한다.
 * 무료 서명으로는 쓸 수 없어서 알려주는 데까지가 앱이 할 수 있는 전부다.
 * (docs/02-tech-decisions.md D10)
 *
 * ## 값은 `.env` 에 둔다
 *
 * 저장소가 공개라 비밀번호를 코드에 적어두면 누구나 읽는다. `.env` 는
 * 무시 목록에 있어서 올라가지 않는다. `.env.example` 를 베껴 쓰면 된다.
 *
 * **다만 빌드하면 값이 앱 안에 박힌다.** `EXPO_PUBLIC_` 로 시작하는
 * 값은 번들에 그대로 들어가므로, 앱 파일을 뜯으면 보인다. 저장소에서
 * 빼는 데까지가 여기서 얻는 것이고, 앱 안에서까지 숨기려면 설정
 * 화면에서 손으로 넣게 만들어야 한다. 둘만 쓰는 핫스팟이라 거기까지는
 * 하지 않는다.
 *
 * `process.env.EXPO_PUBLIC_...` 를 **글자 그대로 적어야 한다.**
 * 변수에 담아 돌려 읽으면 빌드할 때 값이 안 박힌다.
 */

export interface HomeHotspot {
  readonly ssid: string
  readonly password: string
}

const ssid = process.env.EXPO_PUBLIC_HOTSPOT_SSID ?? ''
const password = process.env.EXPO_PUBLIC_HOTSPOT_PASSWORD ?? ''

/**
 * 안 적어뒀으면 `null` 이다.
 *
 * 값이 없다고 앱이 멈추면 안 된다. 그때는 이름을 알려주는 안내만
 * 빠지고, 예전처럼 **상대 화면을 보고 들어가는** 길로 되돌아간다.
 * 화면에 `undefined` 를 띄우는 것보다 낫다.
 */
export const homeHotspot: HomeHotspot | null = ssid.length > 0 ? { ssid, password } : null
