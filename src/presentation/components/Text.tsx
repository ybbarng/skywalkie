import { Text as RNText, type TextProps as RNTextProps } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'
import type { ColorTokens } from '../theme/tokens'
import type { TypographyName } from '../theme/typography'

interface TextProps extends Omit<RNTextProps, 'style'> {
  /** 글자 크기와 굵기를 이름으로 고른다 */
  variant?: TypographyName
  /** 색도 이름으로 고른다. 직접 적지 않는다 */
  color?: keyof ColorTokens
  align?: 'left' | 'center' | 'right'
  style?: RNTextProps['style']
}

/**
 * 글자.
 *
 * 크기와 색을 토큰 이름으로만 고르게 해서, 화면마다 미세하게
 * 다른 값이 쓰이는 걸 막는다.
 */
export function Text({
  variant = 'body',
  color = 'text',
  align,
  style,
  ...rest
}: TextProps) {
  const theme = useTheme()

  return (
    <RNText
      // 기기 글자 크기를 따라가되 화면이 깨질 만큼은 안 키운다
      maxFontSizeMultiplier={theme.maxFontScale}
      style={[
        theme.typography[variant],
        { color: theme.colors[color] },
        align !== undefined && { textAlign: align },
        style,
      ]}
      {...rest}
    />
  )
}
