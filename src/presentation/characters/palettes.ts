import type { CharacterId } from '@/domain/peer/Character'
import type { ThemeMode } from '../theme/tokens'

/**
 * 캐릭터 색.
 *
 * 색을 정의하는 곳이라 여기서는 값을 직접 적는다.
 * (`check:tokens` 가 이 파일을 예외로 둔다)
 */

export interface CharacterPalette {
  readonly skin: string
  readonly skinShade: string
  readonly hair: string
  readonly hairShade: string
  readonly accessory: string
  readonly clothing: string
  readonly line: string
  readonly mouth: string
  readonly blush: string
}

interface PalettePair {
  readonly dark: CharacterPalette
  readonly light: CharacterPalette
}

const palettes: Record<CharacterId, PalettePair> = {
  aria: {
    dark: {
      skin: '#F0C9A8',
      skinShade: '#DCAE8A',
      hair: '#4A3428',
      hairShade: '#33231B',
      accessory: '#FF9D5C',
      clothing: '#5CC8FF',
      line: '#2A1B14',
      mouth: '#8C4A3F',
      blush: '#F2A08C',
    },
    light: {
      skin: '#F6D5B8',
      skinShade: '#E3B994',
      hair: '#57402F',
      hairShade: '#3C2C20',
      accessory: '#C2410C',
      clothing: '#0369A1',
      line: '#2A1B14',
      mouth: '#9C554A',
      blush: '#F0A190',
    },
  },
  nova: {
    dark: {
      skin: '#E8BE9C',
      skinShade: '#D2A17E',
      hair: '#1E1B2E',
      hairShade: '#14121F',
      accessory: '#8B95AD',
      clothing: '#FF9D5C',
      line: '#221A18',
      mouth: '#8C4A3F',
      blush: '#E89A88',
    },
    light: {
      skin: '#F2CFB0',
      skinShade: '#DFB18D',
      hair: '#2A2640',
      hairShade: '#1B1830',
      accessory: '#5D6A85',
      clothing: '#C2410C',
      line: '#221A18',
      mouth: '#9C554A',
      blush: '#EC9E8C',
    },
  },
  orion: {
    dark: {
      skin: '#D9A87E',
      skinShade: '#C08F67',
      hair: '#2C2620',
      hairShade: '#1D1914',
      accessory: '#E8ECF5',
      clothing: '#4ADE80',
      line: '#221A14',
      mouth: '#7E3F35',
      blush: '#D98E78',
    },
    light: {
      skin: '#E6B98F',
      skinShade: '#CE9E74',
      hair: '#3A322A',
      hairShade: '#26201A',
      accessory: '#5D6A85',
      clothing: '#16A34A',
      line: '#221A14',
      mouth: '#8E493D',
      blush: '#DD9580',
    },
  },
  atlas: {
    dark: {
      skin: '#A9754E',
      skinShade: '#8E5F3E',
      hair: '#241A14',
      hairShade: '#170F0B',
      accessory: '#FBBF24',
      clothing: '#8B5CF6',
      line: '#1A120C',
      mouth: '#6B3128',
      blush: '#B5705A',
    },
    light: {
      skin: '#B88159',
      skinShade: '#9C6A45',
      hair: '#2E211A',
      hairShade: '#1E1410',
      accessory: '#D97706',
      clothing: '#7C3AED',
      line: '#1A120C',
      mouth: '#7A382D',
      blush: '#BE7A63',
    },
  },
  luna: {
    dark: {
      skin: '#EFC6A4',
      skinShade: '#D8A984',
      hair: '#6B3A2E',
      hairShade: '#4E2820',
      accessory: '#F87171',
      clothing: '#5CC8FF',
      line: '#2A1B14',
      mouth: '#8C4A3F',
      blush: '#F2A08C',
    },
    light: {
      skin: '#F5D2B4',
      skinShade: '#E2B48E',
      hair: '#784636',
      hairShade: '#5A3128',
      accessory: '#DC2626',
      clothing: '#0369A1',
      line: '#2A1B14',
      mouth: '#9C554A',
      blush: '#F0A190',
    },
  },
  mira: {
    dark: {
      skin: '#EDC3A0',
      skinShade: '#D6A57F',
      hair: '#8A4B2A',
      hairShade: '#6A3620',
      accessory: '#FBBF24',
      clothing: '#F472B6',
      line: '#2A1B14',
      mouth: '#8C4A3F',
      blush: '#F2A08C',
    },
    light: {
      skin: '#F4D0B2',
      skinShade: '#E0B08A',
      hair: '#96522F',
      hairShade: '#743B24',
      accessory: '#B45309',
      clothing: '#BE185D',
      line: '#2A1B14',
      mouth: '#9C554A',
      blush: '#F0A190',
    },
  },
  kai: {
    dark: {
      skin: '#DCAF87',
      skinShade: '#C3956E',
      hair: '#22201C',
      hairShade: '#161411',
      accessory: '#34D399',
      clothing: '#334155',
      line: '#221A14',
      mouth: '#7E3F35',
      blush: '#D98E78',
    },
    light: {
      skin: '#E9C095',
      skinShade: '#D0A276',
      hair: '#2E2B25',
      hairShade: '#1F1D18',
      accessory: '#047857',
      clothing: '#475569',
      line: '#221A14',
      mouth: '#8E493D',
      blush: '#DD9580',
    },
  },
  ren: {
    dark: {
      skin: '#E0B48D',
      skinShade: '#C89A73',
      hair: '#C7A36B',
      hairShade: '#9E7E4C',
      accessory: '#38BDF8',
      clothing: '#EF4444',
      line: '#221A14',
      mouth: '#7E3F35',
      blush: '#DD9580',
    },
    light: {
      skin: '#EDC49C',
      skinShade: '#D5A87F',
      hair: '#A9854B',
      hairShade: '#856636',
      accessory: '#0369A1',
      clothing: '#B91C1C',
      line: '#221A14',
      mouth: '#8E493D',
      blush: '#DD9580',
    },
  },
  pilot: {
    dark: {
      skin: '#E3B896',
      skinShade: '#CB9E79',
      hair: '#33302C',
      hairShade: '#232019',
      accessory: '#0B1020',
      clothing: '#1E2740',
      line: '#221A14',
      mouth: '#82443A',
      blush: '#E09580',
    },
    light: {
      skin: '#EFC7A4',
      skinShade: '#D8AC85',
      hair: '#403C36',
      hairShade: '#2C2822',
      accessory: '#121826',
      clothing: '#2A3450',
      line: '#221A14',
      mouth: '#90503F',
      blush: '#E59B88',
    },
  },
}

export function paletteFor(id: CharacterId, mode: ThemeMode): CharacterPalette {
  return palettes[id][mode]
}

/**
 * 끊겼을 때 쓰는 회색 팔레트.
 *
 * 색을 섞는 대신 미리 만든 회색으로 갈아 끼운다. 색을 섞으면
 * 캐릭터마다 다른 회색이 나와 어떤 건 잘 안 보인다.
 */
export function grayPalette(mode: ThemeMode): CharacterPalette {
  return mode === 'dark'
    ? {
        skin: '#4A5268',
        skinShade: '#3C4257',
        hair: '#39415A',
        hairShade: '#2E3550',
        accessory: '#4A5268',
        clothing: '#39415A',
        line: '#5C6780',
        mouth: '#2A3045',
        blush: '#4A5268',
      }
    : {
        skin: '#C3CAD8',
        skinShade: '#AEB6C6',
        hair: '#9AA3B5',
        hairShade: '#848EA3',
        accessory: '#AEB6C6',
        clothing: '#9AA3B5',
        line: '#6B7689',
        mouth: '#8792A5',
        blush: '#C3CAD8',
      }
}

/**
 * 끊긴 정도에 따라 팔레트를 고른다.
 *
 * 절반을 넘으면 회색으로 본다. 중간 상태를 만들지 않는 이유는
 * 캐릭터마다 다른 회색이 나와 어떤 건 잘 안 보이기 때문이다.
 */
export function paletteWithFade(
  id: CharacterId,
  mode: ThemeMode,
  desaturate: number,
): CharacterPalette {
  return desaturate >= 0.5 ? grayPalette(mode) : paletteFor(id, mode)
}

/**
 * 이모티콘에만 쓰는 색.
 *
 * 눈물과 하트는 캐릭터마다 달라질 이유가 없다. 파란 눈물과 빨간
 * 하트는 누가 봐도 그것이라서, 사람마다 다른 색을 쓰면 오히려 헷갈린다.
 */
export const stickerColors = {
  tear: { dark: '#5CC8FF', light: '#0369A1' },
  heart: { dark: '#F87171', light: '#DC2626' },
} as const

export function stickerColor(which: keyof typeof stickerColors, mode: ThemeMode): string {
  return stickerColors[which][mode]
}
