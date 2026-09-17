/**
 * 움직임.
 *
 * 정보를 전달할 때만 쓴다. 장식으로 쓰지 않는다.
 * (docs/07-design-system.md 5장)
 */

export const duration = {
  /** 눌렀을 때 */
  press: 100,
  /** 밝기 모드가 바뀔 때 */
  theme: 200,
  /** 말풍선이 나타날 때 */
  bubble: 260,
  /** 화면 전환 */
  screen: 300,
  /** 연결 상태가 바뀔 때. 깜빡이지 않게 천천히 */
  status: 400,
} as const

export const scale = {
  /** 누르는 동안 줄어드는 정도 */
  pressed: 0.96,
} as const

/** 말풍선이 아래에서 올라올 때 쓰는 스프링 값 */
export const spring = {
  damping: 18,
  stiffness: 220,
  mass: 0.6,
} as const
