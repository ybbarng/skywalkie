import { type ColorTokens, darkColors, lightColors } from './colors'
import { duration, scale, spring } from './motion'
import { minTouchSize, radius, spacing } from './spacing'
import { maxFontScale, typography } from './typography'

/** 사용자가 고를 수 있는 값. `system` 은 기기 설정을 따라간다 */
export type ThemePreference = 'system' | 'light' | 'dark'

/** 실제로 화면에 적용되는 값. `system` 은 여기서 둘 중 하나로 정해진다 */
export type ThemeMode = 'light' | 'dark'

export interface Theme {
  readonly mode: ThemeMode
  readonly colors: ColorTokens
  readonly typography: typeof typography
  readonly spacing: typeof spacing
  readonly radius: typeof radius
  readonly duration: typeof duration
  readonly scale: typeof scale
  readonly spring: typeof spring
  readonly minTouchSize: number
  readonly maxFontScale: number
}

const shared = {
  typography,
  spacing,
  radius,
  duration,
  scale,
  spring,
  minTouchSize,
  maxFontScale,
} as const

export const darkTheme: Theme = { mode: 'dark', colors: darkColors, ...shared }
export const lightTheme: Theme = { mode: 'light', colors: lightColors, ...shared }

export function themeFor(mode: ThemeMode): Theme {
  return mode === 'dark' ? darkTheme : lightTheme
}

export type { ColorTokens }
