import { type DomainError, domainError } from '../shared/DomainError'
import { err, ok, type Result } from '../shared/Result'
import { baseScore, type LinkKind } from './LinkKind'

/**
 * 연결이 얼마나 좋은가.
 *
 * 이 값으로 어느 길을 쓸지 정한다. 신호가 약하거나 응답이 느리면
 * 점수가 깎여서, 아주 나쁜 Wi-Fi 보다 멀쩡한 블루투스가 나을 수 있다.
 * (docs/04-transport-spec.md 6장)
 */

/** 점수 차이가 이만큼은 나야 길을 갈아탄다 */
export const SWITCH_MARGIN = 20

/** 응답이 이보다 느리면 가장 나쁘게 본다 */
const WORST_LATENCY_MS = 2000

/** 품질 계수가 이 아래로는 안 내려간다. 연결이 살아 있기는 하기 때문이다 */
const MIN_FACTOR = 0.3

export class LinkQuality {
  private constructor(
    readonly kind: LinkKind,
    /** 0(없음)에서 1(최고) 사이 */
    readonly signal: number,
    /** 왕복 응답 시간. 밀리초 */
    readonly latencyMs: number,
    /** 0에서 1 사이. 얼마나 잃어버리나 */
    readonly lossRate: number,
  ) {}

  static of(input: LinkQualityInput): Result<LinkQuality, DomainError> {
    if (!isRatio(input.signal)) {
      return err(domainError('invalid-value', '신호는 0과 1 사이여야 한다', 'signal'))
    }

    if (!Number.isFinite(input.latencyMs) || input.latencyMs < 0) {
      return err(
        domainError('invalid-value', '응답 시간은 0 이상이어야 한다', 'latencyMs'),
      )
    }

    if (!isRatio(input.lossRate)) {
      return err(domainError('invalid-value', '유실률은 0과 1 사이여야 한다', 'lossRate'))
    }

    return ok(new LinkQuality(input.kind, input.signal, input.latencyMs, input.lossRate))
  }

  /** 아직 재보지 않았을 때. 일단 좋다고 보고 시작한다 */
  static unknown(kind: LinkKind): LinkQuality {
    return new LinkQuality(kind, 1, 0, 0)
  }

  /**
   * 이 길의 점수.
   *
   * 기본 점수에 품질 계수를 곱한다. Wi-Fi 가 아주 나쁘면
   * 멀쩡한 블루투스보다 낮아질 수 있다.
   */
  score(): number {
    return baseScore[this.kind] * this.factor()
  }

  /** 0.3에서 1 사이. 신호·응답·유실을 합쳐 본다 */
  factor(): number {
    const latencyFactor =
      1 - Math.min(this.latencyMs, WORST_LATENCY_MS) / WORST_LATENCY_MS
    const raw = this.signal * 0.4 + latencyFactor * 0.3 + (1 - this.lossRate) * 0.3
    return Math.max(MIN_FACTOR, Math.min(1, raw))
  }

  /**
   * 사람에게 보여줄 등급.
   * 숫자 대신 이걸 화면에 띄운다. 23밀리초가 좋은 건지 나쁜 건지 모른다.
   */
  grade(): QualityGrade {
    const factor = this.factor()
    if (factor >= 0.8) return 'good'
    if (factor >= 0.55) return 'fair'
    return 'poor'
  }

  /** 목소리를 실을 만한가 */
  isGoodEnoughForVoice(): boolean {
    return this.latencyMs < 400 && this.lossRate < 0.1
  }

  /** 영상을 실을 만한가 */
  isGoodEnoughForVideo(): boolean {
    return this.isGoodEnoughForVoice() && this.factor() >= 0.55
  }
}

export type QualityGrade = 'good' | 'fair' | 'poor'

export interface LinkQualityInput {
  readonly kind: LinkKind
  readonly signal: number
  readonly latencyMs: number
  readonly lossRate: number
}

/**
 * 지금 쓰는 길을 두고 다른 길로 갈아탈까.
 *
 * 점수 차이가 충분히 나야 갈아탄다. 안 그러면 두 길 사이를 계속 오간다.
 */
export function shouldSwitch(current: LinkQuality, candidate: LinkQuality): boolean {
  return candidate.score() - current.score() >= SWITCH_MARGIN
}

/** 여러 길 중 가장 좋은 것. 없으면 null */
export function bestOf(candidates: readonly LinkQuality[]): LinkQuality | null {
  let best: LinkQuality | null = null
  for (const candidate of candidates) {
    if (best === null || candidate.score() > best.score()) best = candidate
  }
  return best
}

function isRatio(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1
}
