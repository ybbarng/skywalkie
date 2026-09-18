import type { StickerPose } from '@/domain/message/MessageContent'
import type { CharacterId } from '@/domain/peer/Character'

/**
 * 캐릭터와 아이콘 그리기.
 *
 * `src/presentation/characters/` 와 같은 그림을 브라우저용으로 옮긴 것이다.
 * 원본은 `react-native-svg` 를 쓰는데 브라우저에서는 그게 없다.
 * **좌표와 색은 그대로다.**
 */

interface Palette {
  skin: string
  shade: string
  hair: string
  hairDark: string
  acc: string
  cloth: string
  line: string
  mouth: string
  blush: string
}

const PALETTES: Record<string, Palette> = {
  aria: { skin:'#F0C9A8', shade:'#DCAE8A', hair:'#4A3428', hairDark:'#33231B', acc:'#FF9D5C', cloth:'#5CC8FF', line:'#2A1B14', mouth:'#8C4A3F', blush:'#F2A08C' },
  nova: { skin:'#E8BE9C', shade:'#D2A17E', hair:'#1E1B2E', hairDark:'#14121F', acc:'#8B95AD', cloth:'#FF9D5C', line:'#221A18', mouth:'#8C4A3F', blush:'#E89A88' },
  luna: { skin:'#EFC6A4', shade:'#D8A984', hair:'#6B3A2E', hairDark:'#4E2820', acc:'#F87171', cloth:'#5CC8FF', line:'#2A1B14', mouth:'#8C4A3F', blush:'#F2A08C' },
  mira: { skin:'#EDC3A0', shade:'#D6A57F', hair:'#8A4B2A', hairDark:'#6A3620', acc:'#FBBF24', cloth:'#F472B6', line:'#2A1B14', mouth:'#8C4A3F', blush:'#F2A08C' },
  orion:{ skin:'#D9A87E', shade:'#C08F67', hair:'#2C2620', hairDark:'#1D1914', acc:'#E8ECF5', cloth:'#4ADE80', line:'#221A14', mouth:'#7E3F35', blush:'#D98E78' },
  atlas:{ skin:'#A9754E', shade:'#8E5F3E', hair:'#241A14', hairDark:'#170F0B', acc:'#FBBF24', cloth:'#8B5CF6', line:'#1A120C', mouth:'#6B3128', blush:'#B5705A' },
  kai:  { skin:'#DCAF87', shade:'#C3956E', hair:'#22201C', hairDark:'#161411', acc:'#34D399', cloth:'#334155', line:'#221A14', mouth:'#7E3F35', blush:'#D98E78' },
  ren:  { skin:'#E0B48D', shade:'#C89A73', hair:'#C7A36B', hairDark:'#9E7E4C', acc:'#38BDF8', cloth:'#EF4444', line:'#221A14', mouth:'#7E3F35', blush:'#DD9580' },
  pilot:{ skin:'#E3B896', shade:'#CB9E79', hair:'#33302C', hairDark:'#232019', acc:'#0B1020', cloth:'#1E2740', line:'#221A14', mouth:'#82443A', blush:'#E09580' },
}

const GRAY: Palette = {
  skin:'#4A5268', shade:'#3C4257', hair:'#39415A', hairDark:'#2E3550',
  acc:'#4A5268', cloth:'#39415A', line:'#5C6780', mouth:'#2A3045', blush:'#4A5268',
}

export type Expression =
  | 'idle' | 'speaking' | 'listening' | 'typing' | 'disconnected' | 'sleeping'

function hair(id: string, p: Palette): string {
  switch (id) {
    case 'aria':
      return `<path d="M30 54c0-19 13-30 30-30s30 11 30 30c0-8-6-12-12-13-6 4-30 4-36 0-6 1-12 5-12 13z" fill="${p.hair}"/>`
        + `<path d="M28 52c-1 16 1 28 4 36 2-10 2-24 1-36zM92 52c1 16-1 28-4 36-2-10-2-24-1-36z" fill="${p.hair}"/>`
    case 'nova':
      return `<path d="M30 56c0-20 13-32 30-32s30 12 30 32c-2-9-8-14-14-15-7 4-25 4-32 0-6 1-12 6-14 15z" fill="${p.hair}"/>`
    case 'luna':
      return `<path d="M30 54c0-19 13-30 30-30s30 11 30 30c-3-8-8-12-14-13-7 4-25 4-32 0-6 1-11 5-14 13z" fill="${p.hair}"/>`
        + `<circle cx="92" cy="40" r="8" fill="${p.hairDark}"/>`
    case 'mira':
      return `<path d="M30 58c0-20 13-32 30-32s30 12 30 32c-2-10-7-15-13-16-7 4-27 4-34 0-6 1-11 6-13 16z" fill="${p.hair}"/>`
        + `<circle cx="30" cy="60" r="7" fill="${p.hair}"/><circle cx="90" cy="60" r="7" fill="${p.hair}"/>`
    case 'atlas':
      return `<circle cx="44" cy="32" r="11" fill="${p.hair}"/><circle cx="60" cy="27" r="12" fill="${p.hair}"/>`
        + `<circle cx="76" cy="32" r="11" fill="${p.hair}"/><circle cx="35" cy="44" r="9" fill="${p.hair}"/>`
        + `<circle cx="85" cy="44" r="9" fill="${p.hair}"/>`
    case 'kai':
      return `<path d="M32 54c1-15 13-25 28-25s27 10 28 25c-4-7-10-10-16-11-8 3-16 3-24 0-6 1-12 4-16 11z" fill="${p.hair}"/>`
    case 'ren':
      return `<path d="M31 50c2-16 14-26 29-26s27 10 29 26c-4-6-10-9-16-10-8 3-18 3-26 0-6 1-12 4-16 10z" fill="${p.hair}"/>`
        + `<path d="M38 30l-5-13 12 8zM57 23l1-14 8 12zM79 29l7-13-12 8z" fill="${p.hairDark}"/>`
    default:
      return `<path d="M31 50c2-16 14-26 29-26s27 10 29 26c-4-6-10-9-16-10-8 3-18 3-26 0-6 1-12 4-16 10z" fill="${p.hair}"/>`
  }
}

function accessory(id: string, p: Palette): string {
  switch (id) {
    case 'aria':
      return `<path d="M27 56a33 33 0 0 1 66 0" stroke="${p.acc}" stroke-width="4" fill="none" stroke-linecap="round"/>`
        + `<rect x="21" y="52" width="10" height="16" rx="5" fill="${p.acc}"/>`
        + `<rect x="89" y="52" width="10" height="16" rx="5" fill="${p.acc}"/>`
    case 'nova':
      return `<circle cx="48.5" cy="55" r="9" stroke="${p.acc}" stroke-width="2.2" fill="none"/>`
        + `<circle cx="71.5" cy="55" r="9" stroke="${p.acc}" stroke-width="2.2" fill="none"/>`
        + `<path d="M57.5 55h5" stroke="${p.acc}" stroke-width="2.2"/>`
    case 'luna':
      return `<rect x="38" y="88" width="44" height="10" rx="5" fill="${p.acc}"/>`
        + `<rect x="72" y="92" width="9" height="22" rx="4" fill="${p.acc}"/>`
    case 'mira':
      return `<path d="M31 68v4M89 68v4" stroke="${p.acc}" stroke-width="1.8" stroke-linecap="round"/>`
        + `<circle cx="31" cy="74" r="3" fill="${p.acc}"/><circle cx="89" cy="74" r="3" fill="${p.acc}"/>`
    case 'atlas':
      return `<path d="M22 120c0-16 17-27 38-27s38 11 38 27zM38 95q22 14 44 0" stroke="${p.acc}" stroke-width="3" fill="none"/>`
    case 'kai':
      return `<path d="M32 36c0-16 12-26 28-26s28 10 28 26z" fill="${p.acc}"/>`
        + `<rect x="29" y="33" width="62" height="8" rx="4" fill="${p.acc}"/>`
        + `<circle cx="60" cy="9" r="4.5" fill="${p.cloth}"/>`
    case 'ren':
      return `<path d="M29 54a32 32 0 0 1 62 0" stroke="${p.acc}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`
        + `<rect x="23" y="52" width="9" height="15" rx="4.5" fill="${p.acc}"/>`
        + `<path d="M28 66q-2 9 11 11" stroke="${p.acc}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`
        + `<circle cx="42" cy="78" r="3.4" fill="${p.acc}"/>`
    case 'pilot':
      return `<path d="M28 40h64v-4c0-14-14-22-32-22S28 22 28 36z" fill="${p.acc}"/>`
        + `<rect x="24" y="38" width="72" height="8" rx="4" fill="${p.acc}"/>`
        + `<rect x="52" y="22" width="16" height="12" rx="2" fill="${p.cloth}"/>`
    default:
      return `<circle cx="30" cy="58" r="4" fill="${p.acc}"/><circle cx="90" cy="58" r="4" fill="${p.acc}"/>`
  }
}

function face(expr: Expression, p: Palette): string {
  const shut = expr === 'sleeping' || expr === 'disconnected'

  const eyes = shut
    ? `<path d="M44 55h9" stroke="${p.line}" stroke-width="2" stroke-linecap="round"/>`
      + `<path d="M67 55h9" stroke="${p.line}" stroke-width="2" stroke-linecap="round"/>`
    : `<ellipse cx="48.5" cy="55" rx="4" ry="5" fill="${p.line}"/>`
      + `<ellipse cx="71.5" cy="55" rx="4" ry="5" fill="${p.line}"/>`
      + `<circle cx="50" cy="53" r="1.4" fill="${p.skin}"/><circle cx="73" cy="53" r="1.4" fill="${p.skin}"/>`

  const mouth = expr === 'speaking'
    ? `<ellipse cx="60" cy="70" rx="6.5" ry="6" fill="${p.mouth}"/>`
    : `<path d="M52 70q8 ${expr === 'disconnected' ? '-3' : '5'} 16 0" stroke="${p.mouth}" stroke-width="2.2" stroke-linecap="round" fill="none"/>`

  const blush = shut ? '' :
    `<g opacity=".45"><ellipse cx="40" cy="64" rx="5" ry="3" fill="${p.blush}"/>`
    + `<ellipse cx="80" cy="64" rx="5" ry="3" fill="${p.blush}"/></g>`

  const zzz = expr === 'sleeping'
    ? `<g opacity=".75"><path d="M92 26h8l-8 9h8" stroke="${p.line}" stroke-width="2" fill="none" stroke-linecap="round"/>`
      + `<path d="M104 14h6l-6 7h6" stroke="${p.line}" stroke-width="1.6" fill="none" stroke-linecap="round"/></g>`
    : ''

  const dots = expr === 'typing'
    ? `<g><circle cx="84" cy="22" r="3" fill="${p.acc}" opacity=".9"/>`
      + `<circle cx="94" cy="22" r="3" fill="${p.acc}" opacity=".6"/>`
      + `<circle cx="104" cy="22" r="3" fill="${p.acc}" opacity=".35"/></g>`
    : ''

  return eyes + mouth + blush + zzz + dots
}

export function character(id: CharacterId, expr: Expression, size: number): string {
  const p = expr === 'disconnected' ? GRAY : (PALETTES[id] ?? PALETTES.aria as Palette)

  return `<svg width="${size}" height="${size}" viewBox="0 0 120 120">`
    + `<path d="M22 120c0-16 17-27 38-27s38 11 38 27z" fill="${p.cloth}"/>`
    + `<rect x="52" y="78" width="16" height="16" fill="${p.shade}"/>`
    + `<ellipse cx="60" cy="56" rx="30" ry="33" fill="${p.skin}"/>`
    + hair(id, p) + face(expr, p) + accessory(id, p)
    + '</svg>'
}

export function sticker(id: CharacterId, pose: StickerPose, size: number): string {
  const p = PALETTES[id] ?? (PALETTES.aria as Palette)

  let eyes = `<ellipse cx="49" cy="57" rx="4" ry="5" fill="${p.line}"/><ellipse cx="71" cy="57" rx="4" ry="5" fill="${p.line}"/>`
  let mouth = `<path d="M53 71q7 5 14 0" stroke="${p.mouth}" stroke-width="2.4" stroke-linecap="round" fill="none"/>`
  let hands = ''
  let extra = ''

  const shutEyes = `<path d="M44 56q5 5 10 0" stroke="${p.line}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`
    + `<path d="M66 56q5 5 10 0" stroke="${p.line}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`

  if (pose === 'heart') {
    extra = '<path d="M96 30c0-5 7-6 8-1 1-5 8-4 8 1 0 6-8 11-8 11s-8-5-8-11z" fill="#F87171"/>'
  } else if (pose === 'laugh') {
    eyes = `<path d="M44 58q5-5 10 0" stroke="${p.line}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`
      + `<path d="M66 58q5-5 10 0" stroke="${p.line}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`
    mouth = `<ellipse cx="60" cy="72" rx="9" ry="7" fill="${p.mouth}"/>`
  } else if (pose === 'sleep') {
    eyes = shutEyes
    extra = `<path d="M92 24h9l-9 10h9" stroke="${p.line}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`
  } else if (pose === 'cry') {
    eyes = shutEyes
    mouth = `<ellipse cx="60" cy="73" rx="6" ry="5" fill="${p.mouth}"/>`
    extra = '<path d="M47 62q-2 8 1 12" stroke="#5CC8FF" stroke-width="3" fill="none" stroke-linecap="round"/>'
      + '<path d="M73 62q2 8-1 12" stroke="#5CC8FF" stroke-width="3" fill="none" stroke-linecap="round"/>'
  } else if (pose === 'wave') {
    hands = `<circle cx="97" cy="52" r="9" fill="${p.skin}"/><path d="M92 60 86 78" stroke="${p.cloth}" stroke-width="9" stroke-linecap="round"/>`
  } else if (pose === 'thumbsUp') {
    hands = `<circle cx="95" cy="78" r="10" fill="${p.skin}"/><path d="M95 72v-9" stroke="${p.shade}" stroke-width="6" stroke-linecap="round"/>`
  } else if (pose === 'eat') {
    hands = `<circle cx="92" cy="82" r="9" fill="${p.skin}"/><path d="M88 78 74 68M92 79 78 70" stroke="${p.acc}" stroke-width="2.4" stroke-linecap="round"/>`
    mouth = `<ellipse cx="60" cy="72" rx="7" ry="6" fill="${p.mouth}"/>`
  } else if (pose === 'bored') {
    mouth = `<path d="M53 73q7 -3 14 0" stroke="${p.mouth}" stroke-width="2.4" stroke-linecap="round" fill="none"/>`
    hands = `<circle cx="44" cy="82" r="9" fill="${p.skin}"/><path d="M40 90 34 104" stroke="${p.cloth}" stroke-width="9" stroke-linecap="round"/>`
    extra = `<g opacity=".6"><circle cx="97" cy="30" r="2.5" fill="${p.line}"/>`
      + `<circle cx="105" cy="30" r="2.5" fill="${p.line}"/><circle cx="113" cy="30" r="2.5" fill="${p.line}"/></g>`
  }

  return `<svg width="${size}" height="${size}" viewBox="0 0 120 120">`
    + `<path d="M28 120c0-15 15-25 32-25s32 10 32 25z" fill="${p.cloth}"/>`
    + `<rect x="53" y="80" width="14" height="14" fill="${p.shade}"/>`
    + `<ellipse cx="60" cy="58" rx="28" ry="30" fill="${p.skin}"/>`
    + `<path d="M32 56c0-18 12-29 28-29s28 11 28 29c-3-8-8-12-13-13-7 4-23 4-30 0-5 1-10 5-13 13z" fill="${p.hair}"/>`
    + eyes + mouth + hands + extra + '</svg>'
}

const ICONS: Record<string, string> = {
  phone: '<path d="M6.5 3h3l1.5 4-2 1.5a12 12 0 0 0 6.5 6.5L17 13l4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.5 5.2 2 2 0 0 1 6.5 3Z"/>',
  mic: '<path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Z"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0"/><line x1="12" y1="18" x2="12" y2="21"/>',
  heart: '<path d="M12 20s-7.5-4.8-7.5-10A4.5 4.5 0 0 1 12 7.6 4.5 4.5 0 0 1 19.5 10c0 5.2-7.5 10-7.5 10Z"/>',
  photo: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="8.5" cy="10" r="1.8"/><path d="m4 17 5-5 4 4 3-2 4 4"/>',
  alert: '<circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="13"/><circle cx="12" cy="16.5" r=".6"/>',
  send: '<path d="M21 3 10.5 13.5"/><path d="M21 3 14.5 21l-4-7.5L3 9.5 21 3Z"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
  checkDouble: '<path d="m2 12.5 4 4L13.5 8"/><path d="m10 16.5 1.5 1.5L21 8"/>',
  wifi: '<path d="M2 8.5a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M8.5 15.5a6 6 0 0 1 7 0"/><circle cx="12" cy="19" r=".8"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 4v5h-5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>',
}

export function icon(name: string, size = 20, color = 'currentColor'): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}"`
    + ` stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] ?? ''}</svg>`
}
