/**
 * 받침에 맞는 조사를 고른다.
 *
 * **이름을 끼워 넣는 글은 조사가 어긋나기 쉽다.** "지민이 들어와요"는
 * 맞지만 "여자친구이 들어와요"는 한국어가 아니다. 앞말의 받침이
 * 있느냐 없느냐로 갈린다.
 *
 * 예전에는 이름 뒤에 "님"을 붙여 늘 받침이 있게 만들어 피했다.
 * 그런데 "여자친구님"처럼 부르는 말에 붙이면 어색해서, 이름을 그대로
 * 쓰고 조사를 고르는 쪽으로 바꿨다.
 */

const FIRST = 0xac00
const LAST = 0xd7a3
/** 한 글자에 담긴 받침의 가짓수 (없음 포함) */
const FINALS = 28

/**
 * 마지막 글자에 받침이 있나.
 *
 * 한글이 아니면 **없는 것으로 본다.** 영어 이름이나 이모지로 끝나면
 * 읽는 소리를 알 수 없는데, 그럴 때는 "가/는/를"이 덜 어색하다.
 */
export function hasFinalConsonant(word: string): boolean {
  const last = [...word].at(-1)
  if (last === undefined) return false

  const code = last.codePointAt(0)
  if (code === undefined || code < FIRST || code > LAST) return false

  return (code - FIRST) % FINALS !== 0
}

/** 받침이 있으면 앞엣것, 없으면 뒤엣것 */
export function pickJosa(word: string, withFinal: string, without: string): string {
  return hasFinalConsonant(word) ? withFinal : without
}

/** 지민이 · 여자친구가 */
export function asSubject(word: string): string {
  return word + pickJosa(word, '이', '가')
}

/** 지민은 · 여자친구는 */
export function asTopic(word: string): string {
  return word + pickJosa(word, '은', '는')
}

/** 지민을 · 여자친구를 */
export function asObject(word: string): string {
  return word + pickJosa(word, '을', '를')
}
