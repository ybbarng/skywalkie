import type { Expression } from '@/domain/peer/Character'

/**
 * 표정을 숫자로 옮긴다.
 *
 * SVG 를 그리는 코드는 시험하기 어렵지만 **"어떤 표정일 때 눈과 입이
 * 얼마나 열리는가"는 순수한 계산**이라 전부 시험할 수 있다. 그래서
 * 그리는 일과 정하는 일을 갈랐다.
 *
 * (docs/07-design-system.md 6장)
 */

export interface FaceShape {
  /** 눈을 얼마나 떴나. 0이면 감은 것 */
  readonly eyeOpen: number
  /** 입을 얼마나 벌렸나 */
  readonly mouthOpen: number
  /** 입꼬리. 양수면 웃고 음수면 시무룩하다 */
  readonly mouthCurve: number
  /** 고개를 기울인 각도 */
  readonly tiltDegrees: number
  /** 회색으로 바래는 정도. 1이면 완전히 회색 */
  readonly desaturate: number
  /** 눈썹 높이. 양수면 올라간다 */
  readonly browLift: number
}

const shapes: Record<Expression, FaceShape> = {
  idle: {
    eyeOpen: 1,
    mouthOpen: 0.05,
    mouthCurve: 0.3,
    tiltDegrees: 0,
    desaturate: 0,
    browLift: 0,
  },
  speaking: {
    // 입 벌린 정도는 실제 소리 크기로 덮어쓴다. 여기 값은 기본값이다.
    eyeOpen: 1,
    mouthOpen: 0.5,
    mouthCurve: 0.2,
    tiltDegrees: 0,
    desaturate: 0,
    browLift: 0.1,
  },
  listening: {
    eyeOpen: 1,
    mouthOpen: 0.02,
    mouthCurve: 0.35,
    // 살짝 기울여 듣고 있다는 느낌을 준다
    tiltDegrees: -6,
    desaturate: 0,
    browLift: 0.05,
  },
  typing: {
    eyeOpen: 0.85,
    mouthOpen: 0.02,
    mouthCurve: 0.15,
    tiltDegrees: 3,
    desaturate: 0,
    browLift: 0,
  },
  disconnected: {
    eyeOpen: 0.45,
    mouthOpen: 0,
    mouthCurve: -0.35,
    tiltDegrees: 0,
    // 글씨를 안 읽어도 뭔가 잘못됐다는 걸 알 수 있어야 한다
    desaturate: 1,
    browLift: -0.15,
  },
  sleeping: {
    eyeOpen: 0,
    mouthOpen: 0.1,
    mouthCurve: 0.1,
    tiltDegrees: 8,
    desaturate: 0.35,
    browLift: -0.05,
  },
  videoOff: {
    eyeOpen: 1,
    mouthOpen: 0.05,
    mouthCurve: 0.25,
    tiltDegrees: 0,
    desaturate: 0.15,
    browLift: 0,
  },
}

export function shapeFor(expression: Expression): FaceShape {
  return shapes[expression]
}

/**
 * 말하는 중일 때 소리 크기를 입 모양에 반영한다.
 *
 * `level` 은 0에서 1 사이의 소리 크기다. 실제 소리는 들쭉날쭉해서
 * 그대로 쓰면 입이 떨린다. 부드럽게 따라가게 만드는 건
 * `smoothLevel` 이 한다.
 */
export function shapeWhileSpeaking(level: number): FaceShape {
  const clamped = clamp(level, 0, 1)

  return {
    ...shapes.speaking,
    // 완전히 다물지 않는다. 사람은 말할 때도 입이 조금 열려 있다.
    mouthOpen: 0.08 + clamped * 0.62,
    // 크게 말할수록 눈이 살짝 커진다
    eyeOpen: 1 + clamped * 0.08,
    browLift: 0.1 + clamped * 0.12,
  }
}

/**
 * 소리 크기를 부드럽게 따라가게 한다.
 *
 * 실제 소리는 한 프레임마다 크게 오르내린다. 그대로 입에 반영하면
 * 떨리는 것처럼 보인다. **열릴 때는 빠르게, 닫힐 때는 천천히** 따라가면
 * 진짜로 말하는 것처럼 보인다.
 *
 * @param previous 지난 프레임의 값
 * @param target 지금 들어온 소리 크기
 */
export function smoothLevel(previous: number, target: number): number {
  const from = clamp(previous, 0, 1)
  const to = clamp(target, 0, 1)

  // 입을 벌리는 건 빨라야 말과 맞고,
  // 다무는 건 천천히여야 자연스럽다.
  const rate = to > from ? OPEN_RATE : CLOSE_RATE

  return from + (to - from) * rate
}

const OPEN_RATE = 0.6
const CLOSE_RATE = 0.22

/**
 * 눈 깜빡임.
 *
 * 규칙적으로 깜빡이면 기계처럼 보인다. 사람은 3~6초에 한 번쯤,
 * 불규칙하게 깜빡인다.
 *
 * @param elapsedMs 마지막 깜빡임 뒤로 지난 시간
 * @param gapMs 이번에 기다릴 간격
 * @returns 0(감음)에서 1(뜸) 사이
 */
export function blinkAmount(elapsedMs: number, gapMs: number): number {
  if (elapsedMs < gapMs) return 1

  const into = elapsedMs - gapMs
  if (into >= BLINK_DURATION_MS) return 1

  // 반쯤 왔을 때 가장 많이 감긴다
  const half = BLINK_DURATION_MS / 2
  const closeness = into < half ? into / half : (BLINK_DURATION_MS - into) / half

  return 1 - closeness
}

export const BLINK_DURATION_MS = 140

/** 다음 깜빡임까지 기다릴 시간 */
export function nextBlinkGap(random: () => number): number {
  return 3000 + random() * 3000
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min
  return Math.min(max, Math.max(min, value))
}
