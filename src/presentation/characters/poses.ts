import type { StickerPose } from '@/domain/message/MessageContent'

/**
 * 이모티콘이 어떤 모습인가.
 *
 * **그리는 일과 정하는 일을 나눈다.** 여기서는 "화난 얼굴은 눈썹이
 * 내려가고 입이 삐죽하다"까지만 정하고, 실제 선을 긋는 건
 * `Sticker.tsx` 가 한다.
 *
 * 이렇게 나누면 두 가지가 생긴다.
 *
 *   · 시험할 수 있다 — 자세마다 빠진 것이 없는지 확인한다
 *   · 데모가 같은 것을 쓴다 — 브라우저 데모는 `react-native-svg` 를
 *     못 쓰지만 이 파일은 순수 TypeScript 라 그대로 가져다 쓴다
 *
 * (docs/05-messaging-spec.md · docs/07-design-system.md 6장)
 */

/** 눈 */
export type EyeShape =
  /** 보통 눈 */
  | 'open'
  /** 크게 뜬 눈. 놀랐을 때 */
  | 'wide'
  /** 위로 휜 감은 눈. 웃을 때 */
  | 'closedUp'
  /** 아래로 휜 감은 눈. 울거나 잘 때 */
  | 'closedDown'
  /** 한쪽만 감는다 */
  | 'winkRight'
  /** 가늘게 뜬 눈 */
  | 'squint'
  /** 위를 본다. 생각할 때 */
  | 'lookUp'

/** 눈썹. 감정이 가장 크게 드러나는 자리다 */
export type BrowShape = 'none' | 'angry' | 'sad' | 'raised'

/** 입 */
export type MouthShape =
  | 'smile'
  /** 활짝 웃는 입 */
  | 'grin'
  /** 크게 벌린 입 */
  | 'openBig'
  /** 조금 벌린 입 */
  | 'openSmall'
  /** 일자 */
  | 'flat'
  /** 삐죽 */
  | 'frown'
  /** 덜덜 떠는 입 */
  | 'wavy'
  /** 아주 작은 입 */
  | 'tiny'
  /** 혀를 내민다 */
  | 'tongue'

/** 손과 팔. **팔은 늘 어깨에서 나온다** */
export type HandsShape =
  | 'none'
  /** 한 손을 머리 옆으로 올린다 */
  | 'waveRight'
  /** 엄지를 세운다 */
  | 'thumbsUp'
  /** 젓가락을 든다 */
  | 'chopsticks'
  /** 턱을 괸다 */
  | 'chinProp'
  /** 손가락을 턱에 댄다 */
  | 'chinTap'
  /** 두 주먹을 올린다 */
  | 'fistsUp'
  /** 두 손을 위로 든다 */
  | 'bothUp'
  /** 두 손으로 볼을 감싼다 */
  | 'cheeks'
  /** 두 팔로 가위표를 만든다 */
  | 'crossed'
  /** 제 몸을 껴안는다 */
  | 'hugSelf'
  /** 뒤통수를 긁는다 */
  | 'scratchHead'
  /** 두 손으로 배를 감싼다 */
  | 'bellyHold'
  /** 한 손으로 배를 두드린다 */
  | 'bellyPat'
  /** 두 손으로 귀를 막는다 */
  | 'earsCovered'
  /** 두 주먹을 턱 아래 모은다 */
  | 'clenched'
  /** 한 손으로 반대쪽 어깨를 주무른다 */
  | 'shoulderRub'
  /** 주먹으로 가슴을 친다 */
  | 'chestPound'
  /** 두 손을 모은다 */
  | 'pray'
  /** 두 손을 마주친다 */
  | 'clap'
  /** 한 손으로 부채질한다 */
  | 'fan'

/** 몸 주위에 뜨는 것 */
export type PoseExtra =
  | 'none'
  | 'hearts'
  | 'zzz'
  /** 웃음선 */
  | 'laughLines'
  /** 말없음표 */
  | 'dots'
  /** 화나서 나는 김 */
  | 'steam'
  /** 느낌표 */
  | 'bang'
  | 'sparkle'
  /** 생각 방울 */
  | 'thoughtDots'
  /** 눈 결정 */
  | 'snow'
  /** 땀방울 */
  | 'sweat'
  | 'tears'
  /** 배에서 나는 소리 */
  | 'growl'
  /** 시끄러운 소리 */
  | 'noiseLines'
  /** 덜덜 떨림 */
  | 'shiver'
  /** 결리는 자리 */
  | 'ache'
  /** 한숨 */
  | 'sigh'
  /** 더운 기운 */
  | 'heatDrops'
  /** 문. 화장실을 가리킨다 */
  | 'doorSign'

export interface PoseLook {
  readonly eyes: EyeShape
  readonly brows: BrowShape
  readonly mouth: MouthShape
  readonly blush: boolean
  readonly hands: HandsShape
  readonly extra: PoseExtra
  /** 몸을 조금 기울인다. 굳어 있지 않아 보인다 */
  readonly tiltDegrees: number
}

const looks: Record<StickerPose, PoseLook> = {
  wave: {
    eyes: 'open',
    brows: 'none',
    mouth: 'smile',
    blush: false,
    hands: 'waveRight',
    extra: 'none',
    tiltDegrees: -6,
  },
  sleep: {
    eyes: 'closedDown',
    brows: 'none',
    mouth: 'tiny',
    blush: false,
    hands: 'none',
    extra: 'zzz',
    tiltDegrees: 10,
  },
  heart: {
    eyes: 'open',
    brows: 'none',
    mouth: 'smile',
    blush: true,
    hands: 'none',
    extra: 'hearts',
    tiltDegrees: 0,
  },
  laugh: {
    eyes: 'closedUp',
    brows: 'raised',
    mouth: 'openBig',
    blush: true,
    hands: 'none',
    extra: 'laughLines',
    tiltDegrees: -4,
  },
  cry: {
    eyes: 'closedDown',
    brows: 'sad',
    mouth: 'openSmall',
    blush: false,
    hands: 'none',
    extra: 'tears',
    tiltDegrees: 0,
  },
  thumbsUp: {
    eyes: 'open',
    brows: 'none',
    mouth: 'grin',
    blush: false,
    hands: 'thumbsUp',
    extra: 'none',
    tiltDegrees: 0,
  },
  eat: {
    eyes: 'open',
    brows: 'none',
    mouth: 'openSmall',
    blush: false,
    hands: 'chopsticks',
    extra: 'none',
    tiltDegrees: 0,
  },
  bored: {
    eyes: 'squint',
    brows: 'none',
    mouth: 'flat',
    blush: false,
    hands: 'chinProp',
    extra: 'dots',
    tiltDegrees: 8,
  },

  // 여기서부터 감정 여덟. 비행기에서 말 못 하고 쓰게 되는 것들이다.
  angry: {
    eyes: 'squint',
    brows: 'angry',
    mouth: 'frown',
    blush: false,
    hands: 'fistsUp',
    extra: 'steam',
    tiltDegrees: 0,
  },
  surprised: {
    eyes: 'wide',
    brows: 'raised',
    mouth: 'openBig',
    blush: false,
    hands: 'bothUp',
    extra: 'bang',
    tiltDegrees: 0,
  },
  shy: {
    eyes: 'closedUp',
    brows: 'none',
    mouth: 'tiny',
    blush: true,
    hands: 'cheeks',
    extra: 'sparkle',
    tiltDegrees: -3,
  },
  wink: {
    eyes: 'winkRight',
    brows: 'none',
    mouth: 'grin',
    blush: true,
    hands: 'none',
    extra: 'sparkle',
    tiltDegrees: -3,
  },
  think: {
    eyes: 'lookUp',
    brows: 'none',
    mouth: 'flat',
    blush: false,
    hands: 'chinTap',
    extra: 'thoughtDots',
    tiltDegrees: 0,
  },
  no: {
    eyes: 'open',
    brows: 'angry',
    mouth: 'flat',
    blush: false,
    hands: 'crossed',
    extra: 'none',
    tiltDegrees: 0,
  },
  cold: {
    eyes: 'squint',
    brows: 'sad',
    mouth: 'wavy',
    blush: false,
    hands: 'hugSelf',
    extra: 'snow',
    tiltDegrees: 0,
  },
  sorry: {
    eyes: 'closedDown',
    brows: 'sad',
    mouth: 'tiny',
    blush: false,
    hands: 'scratchHead',
    extra: 'sweat',
    tiltDegrees: 7,
  },

  // 셋째 묶음. 옆자리에 앉아 소리를 못 낼 때 실제로 하게 되는 말들.
  miss: {
    eyes: 'lookUp',
    brows: 'sad',
    mouth: 'tiny',
    blush: true,
    hands: 'chinProp',
    extra: 'hearts',
    tiltDegrees: -5,
  },
  excited: {
    eyes: 'closedUp',
    brows: 'raised',
    mouth: 'openBig',
    blush: true,
    hands: 'bothUp',
    extra: 'sparkle',
    tiltDegrees: -4,
  },
  please: {
    eyes: 'closedDown',
    brows: 'sad',
    mouth: 'tiny',
    blush: false,
    hands: 'pray',
    extra: 'none',
    tiltDegrees: 0,
  },
  clap: {
    eyes: 'closedUp',
    brows: 'raised',
    mouth: 'grin',
    blush: false,
    hands: 'clap',
    extra: 'laughLines',
    tiltDegrees: 0,
  },
  stuffy: {
    eyes: 'squint',
    brows: 'sad',
    mouth: 'flat',
    blush: false,
    hands: 'chestPound',
    extra: 'sigh',
    tiltDegrees: 0,
  },
  loud: {
    eyes: 'squint',
    brows: 'angry',
    mouth: 'frown',
    blush: false,
    hands: 'earsCovered',
    extra: 'noiseLines',
    tiltDegrees: 0,
  },
  scared: {
    eyes: 'wide',
    brows: 'sad',
    mouth: 'wavy',
    blush: false,
    hands: 'clenched',
    extra: 'shiver',
    tiltDegrees: 0,
  },
  stiff: {
    eyes: 'closedDown',
    brows: 'sad',
    mouth: 'flat',
    blush: false,
    hands: 'shoulderRub',
    extra: 'ache',
    tiltDegrees: 4,
  },
  hot: {
    eyes: 'squint',
    brows: 'sad',
    mouth: 'openSmall',
    blush: true,
    hands: 'fan',
    extra: 'heatDrops',
    tiltDegrees: 0,
  },
  toilet: {
    eyes: 'squint',
    brows: 'sad',
    mouth: 'wavy',
    blush: false,
    hands: 'waveRight',
    // 손만 들면 인사와 구별이 안 된다. **문을 하나 그려준다.**
    extra: 'doorSign',
    tiltDegrees: -4,
  },
  hungry: {
    eyes: 'closedDown',
    brows: 'sad',
    mouth: 'openSmall',
    blush: false,
    hands: 'bellyHold',
    extra: 'growl',
    tiltDegrees: 0,
  },
  yummy: {
    eyes: 'closedUp',
    brows: 'none',
    mouth: 'tongue',
    blush: true,
    hands: 'none',
    extra: 'sparkle',
    tiltDegrees: -3,
  },
  full: {
    eyes: 'closedUp',
    brows: 'none',
    mouth: 'smile',
    blush: true,
    hands: 'bellyPat',
    extra: 'none',
    tiltDegrees: 0,
  },
}

export function lookFor(pose: StickerPose): PoseLook {
  return looks[pose]
}

/**
 * 어깨에서 손까지.
 *
 * **팔은 몸에 붙어 있어야 한다.** 예전에는 손만 허공에 띄우거나
 * 팔이 몸에 닿기 전에 끊겼다. 몸 윤곽(`M28 120c0-15 15-25 32-25s32 10
 * 32 25z`) 위의 점에서 시작하도록 자리를 잡아둔다.
 *
 * 왼쪽 어깨는 (42, 100), 오른쪽 어깨는 (78, 100) 근처다.
 */
export const SHOULDER_LEFT = { x: 42, y: 100 } as const
export const SHOULDER_RIGHT = { x: 78, y: 100 } as const

/**
 * 가슴 앞으로 지나는 팔은 조금 더 아래에서 나온다.
 *
 * 어깨에서 바로 접으면 팔이 얼굴을 가로지른다. 한 뼘 내려와야
 * 가슴 앞에서 겹친다.
 */
export const CHEST_LEFT = { x: 42, y: 104 } as const
export const CHEST_RIGHT = { x: 78, y: 104 } as const

export interface Limb {
  /** 어깨에서 손까지 그리는 선 */
  readonly path: string
  /** 손이 놓이는 자리 */
  readonly hand: { x: number; y: number; r: number }
}

/** 자세마다 팔이 몇 개고 어디로 가는가 */
export function limbsFor(hands: HandsShape): Limb[] {
  switch (hands) {
    case 'none':
      return []

    case 'waveRight':
      return [{ path: 'M78 100Q92 84 94 60', hand: { x: 96, y: 50, r: 9 } }]

    case 'thumbsUp':
      return [{ path: 'M78 100Q86 92 91 85', hand: { x: 93, y: 78, r: 9.5 } }]

    case 'chopsticks':
      return [{ path: 'M78 100Q84 94 88 88', hand: { x: 90, y: 82, r: 8.5 } }]

    case 'chinProp':
      // 얼굴 바깥으로 빼야 손이 보인다. 안쪽에 두면 볼에 묻힌다.
      return [{ path: 'M42 102Q38 94 37 87', hand: { x: 36, y: 79, r: 9 } }]

    case 'chinTap':
      // 턱 옆에 손을 댄다. 한가운데 두면 수염처럼 보인다.
      return [{ path: 'M78 106Q77 96 75 88', hand: { x: 74, y: 82, r: 7.5 } }]

    case 'fistsUp':
      return [
        { path: 'M42 100Q36 92 34 84', hand: { x: 32, y: 77, r: 8.5 } },
        { path: 'M78 100Q84 92 86 84', hand: { x: 88, y: 77, r: 8.5 } },
      ]

    case 'bothUp':
      return [
        { path: 'M42 100Q32 86 29 68', hand: { x: 28, y: 59, r: 8.5 } },
        { path: 'M78 100Q88 86 91 68', hand: { x: 92, y: 59, r: 8.5 } },
      ]

    case 'cheeks':
      // 볼에 손을 대되 얼굴 밖으로 삐져나와야 손인 줄 안다
      return [
        { path: 'M42 100Q34 92 33 84', hand: { x: 33, y: 76, r: 8.5 } },
        { path: 'M78 100Q86 92 87 84', hand: { x: 87, y: 76, r: 8.5 } },
      ]

    case 'crossed':
      // **턱 앞에서 겹쳐야 가위표로 읽힌다.** 가슴께에서 겹치면
      // 어깨에 묻혀 팔이 있는지도 모른다.
      return [
        { path: 'M42 106L75 72', hand: { x: 79, y: 68, r: 8 } },
        { path: 'M78 106L45 72', hand: { x: 41, y: 68, r: 8 } },
      ]

    case 'hugSelf':
      return [
        { path: 'M42 104Q52 98 70 96', hand: { x: 76, y: 96, r: 8 } },
        { path: 'M78 104Q68 98 50 96', hand: { x: 44, y: 96, r: 8 } },
      ]

    case 'scratchHead':
      return [{ path: 'M78 100Q94 86 92 62', hand: { x: 88, y: 52, r: 8.5 } }]

    case 'bellyHold':
      return [
        { path: 'M42 104Q46 108 50 109', hand: { x: 52, y: 110, r: 7.5 } },
        { path: 'M78 104Q74 108 70 109', hand: { x: 68, y: 110, r: 7.5 } },
      ]

    case 'bellyPat':
      return [{ path: 'M78 104Q72 108 66 109', hand: { x: 62, y: 110, r: 7.5 } }]

    case 'earsCovered':
      return [
        { path: 'M42 100Q32 88 31 72', hand: { x: 30, y: 62, r: 9 } },
        { path: 'M78 100Q88 88 89 72', hand: { x: 90, y: 62, r: 9 } },
      ]

    case 'clenched':
      // 두 주먹을 입 앞으로. 턱 아래에 두면 턱이 두 겹으로 보인다.
      return [
        { path: 'M42 106Q46 96 50 88', hand: { x: 51, y: 79, r: 7.5 } },
        { path: 'M78 106Q74 96 70 88', hand: { x: 69, y: 79, r: 7.5 } },
      ]

    case 'shoulderRub':
      return [{ path: 'M78 104L50 98', hand: { x: 45, y: 97, r: 7.5 } }]

    case 'chestPound':
      return [{ path: 'M78 104Q70 102 64 101', hand: { x: 60, y: 101, r: 7.5 } }]

    case 'pray':
      // **두 손이 맞닿는다.** 붙여야 비는 손으로 읽힌다
      return [
        { path: 'M42 106Q50 98 55 90', hand: { x: 56, y: 84, r: 7 } },
        { path: 'M78 106Q70 98 65 90', hand: { x: 64, y: 84, r: 7 } },
      ]

    case 'clap':
      // **두 손이 떨어져 있다.** 마주치기 직전이라 사이가 벌어진다
      return [
        { path: 'M42 106Q44 96 46 88', hand: { x: 47, y: 82, r: 7 } },
        { path: 'M78 106Q76 96 74 88', hand: { x: 73, y: 82, r: 7 } },
      ]

    case 'fan':
      return [{ path: 'M78 100Q88 90 87 80', hand: { x: 86, y: 72, r: 8 } }]
  }
}

/**
 * 팔을 얼굴 앞에 그릴까 뒤에 그릴까.
 *
 * **가슴을 가로지르는 팔은 얼굴 앞에 와야 한다.** 뒤에 그리면 가운데가
 * 얼굴에 가려 팔이 통째로 사라진다. 가위표와 제 몸 껴안기가 그랬다.
 *
 * 반대로 몸 옆으로 뻗는 팔은 뒤에 있어야 어깨에서 자연스럽게 나온다.
 */
export function armsInFront(hands: HandsShape): boolean {
  switch (hands) {
    case 'crossed':
    case 'hugSelf':
    case 'bellyHold':
    case 'bellyPat':
    case 'clenched':
    case 'shoulderRub':
    case 'chestPound':
    case 'pray':
    case 'clap':
      return true
    default:
      return false
  }
}
