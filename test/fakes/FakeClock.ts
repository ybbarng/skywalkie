import type { Clock } from '@/domain/shared/Clock'

/**
 * 손으로 돌리는 시계.
 *
 * 다시 보내는 간격(1초, 2초, 4초…)을 시험할 때 진짜로 기다리지 않아도 된다.
 * 테스트가 어떤 날 갑자기 실패하는 것도 막는다.
 */
export class FakeClock implements Clock {
  private millis: number

  constructor(startMillis = 1758000000000) {
    this.millis = startMillis
  }

  now(): Date {
    return new Date(this.millis)
  }

  epochMillis(): number {
    return this.millis
  }

  /** 시간을 앞으로 돌린다 */
  advance(byMillis: number): void {
    this.millis += byMillis
  }

  /** 특정 시각으로 옮긴다 */
  set(millis: number): void {
    this.millis = millis
  }
}
