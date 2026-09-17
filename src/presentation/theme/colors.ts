/**
 * 색.
 *
 * 화면 코드에 `#RRGGBB` 를 직접 적지 않는다. 반드시 여기를 거친다.
 * 그래야 밝은 화면과 어두운 화면이 어긋나지 않는다.
 *
 * 어두운 쪽을 먼저 그리고 밝은 쪽을 맞췄다. 이 앱은 대부분
 * 어두운 기내에서 쓰이기 때문이다. (docs/07-design-system.md 2장)
 */

export interface ColorTokens {
  /** 화면 바탕 */
  readonly bg: string
  /** 카드, 말풍선 바탕 */
  readonly surface: string
  /** 떠 있는 것. 시트, 메뉴 */
  readonly surfaceRaised: string
  readonly border: string

  readonly text: string
  /** 시각, 보조 설명 */
  readonly textMuted: string
  readonly textFaint: string

  /** 내 말. 기내 조명 */
  readonly me: string
  readonly meText: string
  /** 상대 말. 창밖 하늘 */
  readonly peer: string
  readonly peerText: string

  /** 연결됨 */
  readonly success: string
  /** 블루투스로 연결됨, 곧 만료됨 */
  readonly warning: string
  /** 끊김, 실패 */
  readonly danger: string
  /** 상태 색 위에 얹는 글자 */
  readonly onStatus: string

  /** 뒤를 가리는 막 */
  readonly overlay: string
}

export const darkColors: ColorTokens = {
  bg: '#0B1020',
  surface: '#151B2E',
  surfaceRaised: '#1E2740',
  border: '#2A3450',

  text: '#E8ECF5',
  textMuted: '#8B95AD',
  textFaint: '#5C6780',

  me: '#FF9D5C',
  meText: '#2A1408',
  peer: '#5CC8FF',
  peerText: '#04283D',

  success: '#4ADE80',
  warning: '#FBBF24',
  danger: '#F87171',
  onStatus: '#0B1020',

  overlay: 'rgba(4, 8, 20, 0.72)',
}

export const lightColors: ColorTokens = {
  bg: '#F6F8FC',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  border: '#E3E8F2',

  text: '#121826',
  textMuted: '#5D6A85',
  textFaint: '#737E92',

  // 밝은 화면에서는 말풍선 색을 어두운 쪽보다 진하게 쓴다.
  // 흰 글자가 얹히므로 연한 주황·하늘색으로는 글자가 안 읽힌다.
  // (colors.test.ts 가 이 값을 지킨다)
  me: '#C2410C',
  meText: '#FFFFFF',
  peer: '#0369A1',
  peerText: '#FFFFFF',

  success: '#16A34A',
  warning: '#C2600A',
  danger: '#DC2626',
  onStatus: '#FFFFFF',

  overlay: 'rgba(18, 24, 38, 0.4)',
}
