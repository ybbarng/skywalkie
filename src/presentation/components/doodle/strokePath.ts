import type { Point, Stroke } from '@/domain/message/MessageContent'

/**
 * 낙서의 선을 다루는 계산.
 *
 * 그리는 일에서 떼어낸 이유는 **시험할 수 있어야 하기 때문이다.**
 *
 * 좌표는 0~1 비율이다. 그래야 화면 크기가 달라도 같은 그림이 나온다.
 * 아이폰과 안드로이드는 화면 비율이 달라서 픽셀로 담으면 어긋난다.
 * (docs/05-messaging-spec.md 2장)
 */

/** 화면 좌표를 비율로. 0~1 을 벗어나면 잘라낸다 */
export function toRatio(x: number, y: number, width: number, height: number): Point {
  if (width <= 0 || height <= 0) return { x: 0, y: 0 }

  return {
    x: clamp(x / width),
    y: clamp(y / height),
  }
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

/**
 * 점들을 SVG 길로 바꾼다.
 *
 * 점을 직선으로 잇지 않고 **가운데를 지나는 곡선**으로 잇는다. 손으로
 * 그린 선은 점이 촘촘해서 직선으로 이으면 각져 보인다.
 */
export function toSvgPath(
  points: readonly Point[],
  width: number,
  height: number,
): string {
  if (points.length === 0) return ''

  const at = (point: Point) => ({
    x: point.x * width,
    y: point.y * height,
  })

  const first = at(points[0] as Point)

  // 점이 하나면 그 자리에 작은 점을 찍는다.
  // 톡 찍은 것도 그림의 일부다.
  if (points.length === 1) {
    return `M${first.x.toFixed(1)} ${first.y.toFixed(1)}l0.1 0`
  }

  let path = `M${first.x.toFixed(1)} ${first.y.toFixed(1)}`

  for (let i = 1; i < points.length - 1; i += 1) {
    const current = at(points[i] as Point)
    const next = at(points[i + 1] as Point)
    const midX = (current.x + next.x) / 2
    const midY = (current.y + next.y) / 2

    path += `Q${current.x.toFixed(1)} ${current.y.toFixed(1)} ${midX.toFixed(1)} ${midY.toFixed(1)}`
  }

  const last = at(points[points.length - 1] as Point)
  path += `L${last.x.toFixed(1)} ${last.y.toFixed(1)}`

  return path
}

/**
 * 점을 솎아낸다.
 *
 * 손가락 하나를 긋는 동안 수백 개가 쌓이는데, 대부분은 앞뒤와 거의
 * 같은 자리다. **그대로 보내면 봉투가 커지고 그리기도 느려진다.**
 * 눈에 안 보일 만큼 가까운 점만 버린다.
 */
export function thin(points: readonly Point[], minGap = 0.004): Point[] {
  if (points.length <= 2) return [...points]

  const kept: Point[] = [points[0] as Point]

  for (const point of points.slice(1, -1)) {
    const last = kept[kept.length - 1] as Point
    if (distance(last, point) >= minGap) kept.push(point)
  }

  // 마지막 점은 늘 남긴다. 버리면 선 끝이 잘린다.
  kept.push(points[points.length - 1] as Point)
  return kept
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/**
 * 그려지는 과정을 재생할 때, 이 시점에 어디까지 그려져 있나.
 *
 * **그냥 나타나는 것보다 재밌다.** 상대가 그리는 걸 곁에서 본 것 같다.
 *
 * 선 개수에 상관없이 늘 같은 시간이 걸리게 한다. 선이 많다고 오래
 * 걸리면 기다리다 지친다.
 */
export function strokesAt(strokes: readonly Stroke[], progress: number): Stroke[] {
  if (progress >= 1) return [...strokes]
  if (progress <= 0) return []

  const totalPoints = strokes.reduce((sum, stroke) => sum + stroke.points.length, 0)
  if (totalPoints === 0) return []

  let budget = Math.ceil(totalPoints * progress)
  const drawn: Stroke[] = []

  for (const stroke of strokes) {
    if (budget <= 0) break

    if (budget >= stroke.points.length) {
      drawn.push(stroke)
      budget -= stroke.points.length
      continue
    }

    drawn.push({ ...stroke, points: stroke.points.slice(0, budget) })
    budget = 0
  }

  return drawn
}

/** 낙서 하나를 다 그리는 데 걸리는 시간 */
export const PLAYBACK_MS = 1200
