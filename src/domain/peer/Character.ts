import { type DomainError, domainError } from '../shared/DomainError'
import { err, ok, type Result } from '../shared/Result'

/**
 * 캐릭터.
 *
 * 내가 고른 캐릭터가 상대 화면에 뜬다. 그림 파일이 아니라 코드로 그리므로
 * 여기서는 "어느 캐릭터인가"만 정한다. 실제로 그리는 건 T10 이다.
 * (docs/07-design-system.md 6장)
 */

/**
 * 고르는 화면에 여덟이 한눈에 들어오도록 넷씩 두 줄로 놓는다.
 * 앞의 넷이 여성적, 뒤의 넷이 남성적으로 보이게 순서를 잡았다.
 * **둘이 서로 다른 모습을 고를 수 있어야** 화면에서 누가 누군지 헷갈리지 않는다.
 */
export const characterIds = [
  /** 긴 머리, 헤드폰 */
  'aria',
  /** 단발, 안경 */
  'nova',
  /** 묶은 머리, 목도리 */
  'luna',
  /** 물결지는 단발, 귀걸이 */
  'mira',
  /** 짧은 머리, 이어폰 */
  'orion',
  /** 곱슬머리, 후드 */
  'atlas',
  /** 비니 모자 */
  'kai',
  /** 뻗친 머리, 마이크 달린 헤드셋 */
  'ren',
  /** 조종사 모자. 숨겨둔 것 */
  'pilot',
] as const

export type CharacterId = (typeof characterIds)[number]

/** 첫 실행 화면에 바로 보여주지 않는 것 */
const hidden: readonly CharacterId[] = ['pilot']

export function characterId(value: string): Result<CharacterId, DomainError> {
  if (value.length === 0) {
    return err(domainError('empty', '캐릭터를 고르지 않았다', 'character'))
  }

  const found = characterIds.find(id => id === value)
  if (found === undefined) {
    return err(domainError('invalid-value', `모르는 캐릭터다: ${value}`, 'character'))
  }

  return ok(found)
}

/** 고르는 화면에 보여줄 캐릭터들 */
export function selectableCharacters(): CharacterId[] {
  return characterIds.filter(id => !hidden.includes(id))
}

export function isHidden(id: CharacterId): boolean {
  return hidden.includes(id)
}

/**
 * 표정.
 *
 * 캐릭터는 지금 무슨 일이 일어나는지를 표정으로 알린다.
 * **글씨를 읽지 않아도 상태를 알 수 있어야 한다.**
 */
export const expressions = [
  /** 눈을 가끔 깜빡인다 */
  'idle',
  /** 입이 소리 크기에 맞춰 움직인다 */
  'speaking',
  /** 살짝 고개를 기울인다 */
  'listening',
  /** 머리 위에 점 세 개가 뛴다 */
  'typing',
  /** 회색이 되고 눈이 반쯤 감긴다 */
  'disconnected',
  /** 눈을 감고 Z 가 뜬다. 상대 앱이 뒤로 갔을 때 */
  'sleeping',
  /** 영상을 끈 자리에 나타난다 */
  'videoOff',
] as const

export type Expression = (typeof expressions)[number]
