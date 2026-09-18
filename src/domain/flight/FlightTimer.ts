/**
 * 목적지까지 남은 시간.
 *
 * **둘이 같은 숫자를 본다.** 한쪽이 정하면 상대에게 건너가고, 그때부터
 * 각자의 폰이 알아서 줄여 나간다.
 *
 * ## 시각이 아니라 "남은 길이" 를 보낸다
 *
 * 두 폰의 시계가 다를 수 있다. 특히 시차를 넘는 비행에서는 한쪽이
 * 먼저 시간대를 바꾼다. "오후 3시에 도착" 이라고 보내면 **받는 쪽에서
 * 엉뚱한 시각이 된다.**
 *
 * 그래서 "앞으로 2시간 40분" 을 보내고, 받는 쪽이 자기 시계로
 * 도착 시각을 다시 센다. 건너가는 데 걸리는 몇백 밀리초만큼 어긋나는데,
 * 비행 시간에 견주면 없는 것과 같다.
 */

/** 이보다 길게는 못 잡는다. 지구 반대편도 스무 시간이면 간다 */
export const MAX_FLIGHT_MS = 24 * 60 * 60 * 1000

export interface FlightTimer {
  /** 이 폰의 시계로 언제 도착하나 */
  readonly arrivesAt: number
}

/**
 * 남은 길이로 도착 시각을 센다.
 *
 * 0 이하를 주면 끄는 것으로 본다. 화면에서 치운다.
 */
export function startFlight(remainingMs: number, now: number): FlightTimer | null {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return null
  if (remainingMs > MAX_FLIGHT_MS) return null

  return { arrivesAt: now + Math.round(remainingMs) }
}

/** 지금 얼마나 남았나. 다 됐으면 0 */
export function remainingMs(timer: FlightTimer, now: number): number {
  return Math.max(0, timer.arrivesAt - now)
}

export function hasArrived(timer: FlightTimer, now: number): boolean {
  return remainingMs(timer, now) === 0
}

/**
 * 남은 시간을 사람이 읽는 말로.
 *
 * **초는 안 보여준다.** 세 시간 비행에서 초 단위가 흐르면 눈만 간다.
 * 1분 아래로 내려가야 "곧 도착" 이라고 바꾼다.
 */
export function remainingWords(leftMs: number): string {
  if (leftMs <= 0) return '도착했어요'
  if (leftMs < 60_000) return '곧 도착해요'

  const totalMinutes = Math.floor(leftMs / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours === 0) return `${minutes}분 남았어요`
  if (minutes === 0) return `${hours}시간 남았어요`

  return `${hours}시간 ${minutes}분 남았어요`
}

/**
 * 얼마나 왔나. 0에서 1 사이.
 *
 * 막대를 그리는 데 쓴다. 총 길이를 모르면 그릴 수 없으므로 같이 받는다.
 */
export function progress(leftMs: number, totalMs: number): number {
  if (totalMs <= 0) return 1
  const done = (totalMs - leftMs) / totalMs
  return Math.min(1, Math.max(0, done))
}

/**
 * 시간과 분을 밀리초로.
 *
 * 설정 화면에서 받은 것을 옮길 때 쓴다. 이상한 값은 `null` 이다.
 */
export function fromHoursAndMinutes(hours: number, minutes: number): number | null {
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null
  if (hours < 0 || minutes < 0 || minutes > 59) return null

  const total = (hours * 60 + minutes) * 60_000
  if (total <= 0 || total > MAX_FLIGHT_MS) return null

  return total
}
