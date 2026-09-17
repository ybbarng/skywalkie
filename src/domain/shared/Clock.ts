/**
 * 시간을 주입받기 위한 약속.
 *
 * `Date.now()` 를 코드에서 직접 부르지 않는 이유:
 * 테스트가 어떤 날 갑자기 실패하는 걸 막고, 다시 보내는 간격(1초, 2초, 4초…)을
 * 진짜로 기다리지 않고 시험하기 위해서다. (docs/09-testing.md 4장)
 */
export interface Clock {
  now(): Date
  /** 밀리초. 시각 비교가 잦은 곳에서 쓴다 */
  epochMillis(): number
}

export const systemClock: Clock = {
  now: () => new Date(),
  epochMillis: () => Date.now(),
}
