/**
 * 메시지가 지나가는 길.
 *
 * 세 갈래이고 비행 중에 바뀐다. 이 앱의 구조 전체가 이 사실 하나에서 나왔다.
 * (docs/04-transport-spec.md 1장)
 */

export const linkKinds = [
  /** 안드로이드 핫스팟 위. 글·목소리·얼굴 전부 */
  'wifi',
  /** 블루투스. 글만 */
  'ble',
  /** 아이폰 앱이 만료됐을 때 쓰는 웹. 글만 */
  'web',
] as const

export type LinkKind = (typeof linkKinds)[number]

/** 길마다 무엇을 나를 수 있나 */
interface LinkCapability {
  readonly text: boolean
  readonly voice: boolean
  readonly video: boolean
  readonly doodle: boolean
  readonly photo: boolean
  /** 초당 몇 바이트쯤 */
  readonly roughBytesPerSecond: number
}

const capabilities: Record<LinkKind, LinkCapability> = {
  wifi: {
    text: true,
    voice: true,
    video: true,
    doodle: true,
    photo: true,
    roughBytesPerSecond: 2_000_000,
  },
  ble: {
    text: true,
    // 대역폭이 백분의 일이라 목소리를 나를 수 없다
    voice: false,
    video: false,
    doodle: false,
    photo: false,
    roughBytesPerSecond: 3_000,
  },
  web: {
    text: true,
    // 브라우저는 인터넷 없는 환경에서 마이크와 카메라를 열어주지 않는다
    voice: false,
    video: false,
    doodle: false,
    photo: false,
    roughBytesPerSecond: 2_000_000,
  },
}

export function capabilityOf(kind: LinkKind): LinkCapability {
  return capabilities[kind]
}

export function canCarryVoice(kind: LinkKind): boolean {
  return capabilities[kind].voice
}

export function canCarryVideo(kind: LinkKind): boolean {
  return capabilities[kind].video
}

export function canCarryDoodle(kind: LinkKind): boolean {
  return capabilities[kind].doodle
}

export function canCarryPhoto(kind: LinkKind): boolean {
  return capabilities[kind].photo
}

/**
 * 길마다 매기는 기본 점수. 높을수록 먼저 쓴다.
 * (docs/04-transport-spec.md 6장)
 */
export const baseScore: Record<LinkKind, number> = {
  wifi: 100,
  ble: 40,
  web: 30,
}
