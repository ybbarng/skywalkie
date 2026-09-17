/**
 * 간격과 모서리.
 *
 * 간격은 4의 배수만 쓴다. 눈대중으로 5나 7을 넣기 시작하면
 * 화면마다 미세하게 어긋난다. (docs/07-design-system.md 4장)
 */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
} as const

export type SpacingName = keyof typeof spacing

/** 모서리는 넉넉하게 굴린다. 부드러운 인상이 이 앱에 맞다 */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const

export type RadiusName = keyof typeof radius

/**
 * 손가락이 닿는 곳의 최소 크기.
 * 흔들리는 기내에서 좁은 좌석에 앉아 한 손으로 누른다.
 */
export const minTouchSize = 48
