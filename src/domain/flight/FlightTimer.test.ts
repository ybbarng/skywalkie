import { describe, expect, it } from 'vitest'
import {
  fromHoursAndMinutes,
  hasArrived,
  MAX_FLIGHT_MS,
  progress,
  remainingMs,
  remainingWords,
  startFlight,
} from './FlightTimer'

const NOW = 1_700_000_000_000
const HOUR = 60 * 60 * 1000

describe('남은 길이로 도착 시각 세기', () => {
  it('지금부터 그만큼 뒤가 도착 시각이다', () => {
    const timer = startFlight(3 * HOUR, NOW)

    expect(timer?.arrivesAt).toBe(NOW + 3 * HOUR)
  })

  it('두 폰의 시계가 달라도 각자 맞는다', () => {
    // **시각이 아니라 남은 길이를 보내는 이유다.** 시차를 넘으면
    // 한쪽이 먼저 시간대를 바꿔서 "오후 3시" 가 엉뚱해진다.
    // 내 폰 시계로 지금이 NOW, 여자친구 폰은 시간대가 9시간 앞선다
    const mine = { arrivesAt: NOW + 3 * HOUR }
    const hers = { arrivesAt: NOW + 9 * HOUR + 3 * HOUR }

    expect(startFlight(3 * HOUR, NOW)).toEqual(mine)
    expect(startFlight(3 * HOUR, NOW + 9 * HOUR)).toEqual(hers)

    expect(remainingMs(mine, NOW)).toBe(3 * HOUR)
    expect(remainingMs(hers, NOW + 9 * HOUR)).toBe(3 * HOUR)
  })

  it('0 이하는 끄는 것으로 본다', () => {
    expect(startFlight(0, NOW)).toBeNull()
    expect(startFlight(-1, NOW)).toBeNull()
  })

  it('하루를 넘기면 거절한다', () => {
    // 지구 반대편도 스무 시간이면 간다. 그보다 길면 잘못 넣은 것이다.
    expect(startFlight(MAX_FLIGHT_MS + 1, NOW)).toBeNull()
    expect(startFlight(MAX_FLIGHT_MS, NOW)).not.toBeNull()
  })

  it('이상한 값도 거절한다', () => {
    expect(startFlight(Number.NaN, NOW)).toBeNull()
    expect(startFlight(Number.POSITIVE_INFINITY, NOW)).toBeNull()
  })
})

/**
 * 비행 중에 시간대가 바뀌어도 흔들리지 않는다.
 *
 * **여기서 쓰는 숫자는 전부 에폭 밀리초다.** 1970년 1월 1일 UTC
 * 부터 흐른 밀리초라, 정의상 시간대와 상관이 없다. 폰이 서울에서
 * 파리로 바뀌어도 `Date.now()` 는 그대로 이어진다.
 *
 * 흔들리는 것은 **벽시계 글자**를 저장했을 때다. "오후 3시 도착"
 * 이라고 적어두면 시간대가 바뀌는 순간 엉뚱해진다. 그래서 여기서는
 * 시각을 글로 만들지 않고 **남은 길이만** 다룬다.
 */
describe('시간대가 바뀌어도', () => {
  it('남은 길이는 그대로다', () => {
    const timer = startFlight(3 * HOUR, NOW)
    if (timer === null) throw new Error('못 만들었다')

    // 시간대가 바뀌어도 에폭 밀리초는 이어서 흐른다.
    // 한 시간 뒤는 어느 시간대에서 보든 한 시간 뒤다.
    expect(remainingMs(timer, NOW + HOUR)).toBe(2 * HOUR)
  })

  it('보여주는 글에 시각이 안 들어간다', () => {
    // "오후 3시 도착" 같은 글이 있으면 시간대가 바뀔 때 어긋난다.
    for (const ms of [3 * HOUR, 90 * 60_000, 30_000, 0]) {
      const words = remainingWords(ms)

      expect(words).not.toContain('오전')
      expect(words).not.toContain('오후')
      expect(words).not.toContain(':')
    }
  })

  it('저장하는 것도 숫자 하나뿐이다', () => {
    // 시간대도 지역도 안 담는다. 담으면 그게 어긋날 거리가 된다.
    const timer = startFlight(3 * HOUR, NOW)

    expect(Object.keys(timer ?? {})).toEqual(['arrivesAt'])
    expect(typeof timer?.arrivesAt).toBe('number')
  })
})

describe('얼마나 남았나', () => {
  const timer = { arrivesAt: NOW + 2 * HOUR }

  it('시간이 흐르면 줄어든다', () => {
    expect(remainingMs(timer, NOW)).toBe(2 * HOUR)
    expect(remainingMs(timer, NOW + HOUR)).toBe(HOUR)
  })

  it('지나면 0 에서 멈춘다', () => {
    // 음수가 되면 "-3분 남았어요" 가 뜬다.
    expect(remainingMs(timer, NOW + 3 * HOUR)).toBe(0)
    expect(hasArrived(timer, NOW + 3 * HOUR)).toBe(true)
  })

  it('아직이면 도착이 아니다', () => {
    expect(hasArrived(timer, NOW)).toBe(false)
  })
})

describe('사람이 읽는 말', () => {
  it('시간과 분을 함께 적는다', () => {
    expect(remainingWords(2 * HOUR + 40 * 60_000)).toBe('2시간 40분 남았어요')
  })

  it('딱 떨어지면 하나만 적는다', () => {
    expect(remainingWords(2 * HOUR)).toBe('2시간 남았어요')
    expect(remainingWords(40 * 60_000)).toBe('40분 남았어요')
  })

  it('1분 아래는 초를 안 보여준다', () => {
    // 세 시간 비행에서 초 단위가 흐르면 눈만 간다.
    expect(remainingWords(59_000)).toBe('곧 도착해요')
    expect(remainingWords(1)).toBe('곧 도착해요')
  })

  it('다 되면 도착했다고 한다', () => {
    expect(remainingWords(0)).toBe('도착했어요')
  })

  it('초를 적지 않는다', () => {
    for (const ms of [HOUR, 90 * 60_000, 5 * 60_000, 59_000, 0]) {
      expect(remainingWords(ms)).not.toContain('초')
    }
  })
})

describe('얼마나 왔나', () => {
  it('처음에는 0, 끝에는 1', () => {
    expect(progress(3 * HOUR, 3 * HOUR)).toBe(0)
    expect(progress(0, 3 * HOUR)).toBe(1)
  })

  it('절반이면 0.5', () => {
    expect(progress(1.5 * HOUR, 3 * HOUR)).toBeCloseTo(0.5)
  })

  it('밖으로 안 나간다', () => {
    // 시계가 뒤로 가면 남은 시간이 총 길이보다 커질 수 있다.
    expect(progress(5 * HOUR, 3 * HOUR)).toBe(0)
    expect(progress(-HOUR, 3 * HOUR)).toBe(1)
  })
})

describe('시간과 분을 밀리초로', () => {
  it('더해서 옮긴다', () => {
    expect(fromHoursAndMinutes(2, 40)).toBe(2 * HOUR + 40 * 60_000)
  })

  it('0시간 0분은 거절한다', () => {
    expect(fromHoursAndMinutes(0, 0)).toBeNull()
  })

  it('분이 60 을 넘으면 거절한다', () => {
    // 손으로 넣는 값이다. 90분이라고 쓰면 의도를 알 수 없다.
    expect(fromHoursAndMinutes(1, 60)).toBeNull()
    expect(fromHoursAndMinutes(1, 59)).not.toBeNull()
  })

  it('음수를 거절한다', () => {
    expect(fromHoursAndMinutes(-1, 0)).toBeNull()
    expect(fromHoursAndMinutes(0, -1)).toBeNull()
  })

  it('소수를 거절한다', () => {
    expect(fromHoursAndMinutes(1.5, 0)).toBeNull()
  })
})
