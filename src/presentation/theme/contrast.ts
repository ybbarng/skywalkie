/**
 * 글자와 바탕의 대비를 잰다.
 *
 * 어두운 기내에서 화면 밝기를 낮춰도 읽혀야 한다.
 * 색을 바꿀 때 눈대중으로 판단하지 않도록 테스트로 확인한다.
 * (docs/07-design-system.md 2장)
 */

interface Rgb {
  r: number
  g: number
  b: number
}

export function parseHex(hex: string): Rgb {
  const value = hex.replace('#', '')
  const full =
    value.length === 3
      ? value
          .split('')
          .map(c => c + c)
          .join('')
      : value

  const parsed = Number.parseInt(full, 16)
  return {
    r: (parsed >> 16) & 0xff,
    g: (parsed >> 8) & 0xff,
    b: parsed & 0xff,
  }
}

/** 사람 눈이 느끼는 밝기. 색마다 가중치가 다르다 */
function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (raw: number): number => {
    const s = raw / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/**
 * 두 색의 대비. 1(같은 색)에서 21(검정과 흰색) 사이다.
 *
 * 본문은 4.5 이상, 큰 글자나 장식은 3 이상이면 읽을 만하다.
 */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(parseHex(foreground))
  const b = relativeLuminance(parseHex(background))
  const lighter = Math.max(a, b)
  const darker = Math.min(a, b)
  return (lighter + 0.05) / (darker + 0.05)
}

/** 색상환에서의 각도. 0이 빨강, 120이 초록, 240이 파랑이다 */
export function hue(hex: string): number {
  const { r, g, b } = parseHex(hex)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  if (delta === 0) return 0

  const raw =
    max === r
      ? ((g - b) / delta) % 6
      : max === g
        ? (b - r) / delta + 2
        : (r - g) / delta + 4

  return (raw * 60 + 360) % 360
}

/**
 * 두 색이 색상환에서 얼마나 떨어져 있나. 0에서 180 사이다.
 *
 * 내 말과 상대 말을 구분하는 건 밝기가 아니라 색이다.
 * 주황과 파랑은 밝기가 비슷해도 헷갈리지 않는다. 그래서 대비가 아니라
 * 이 값으로 판단한다.
 */
export function hueDistance(a: string, b: string): number {
  const diff = Math.abs(hue(a) - hue(b))
  return diff > 180 ? 360 - diff : diff
}
