import { type DomainError, domainError } from '../shared/DomainError'
import { err, ok, type Result } from '../shared/Result'

/**
 * 메시지 식별자. ULID 를 감싼 값이다.
 *
 * 아무 문자열이나 들어오지 못하게 막는다. 기기 둘이 각자 만들고
 * 파일로 주고받는 값이라, 형식이 어긋난 게 섞이면 중복 판단이 틀어진다.
 *
 * ULID 를 쓰는 이유는 [IdGenerator](../shared/IdGenerator.ts) 에 적었다.
 */

/** Crockford Base32. I, L, O, U 가 빠져 있다. 헷갈리는 글자를 뺀 것이다 */
const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const ULID_PATTERN = new RegExp(`^[${ULID_ALPHABET}]{26}$`)

/** 시각을 담는 앞 10자리가 나타낼 수 있는 가장 먼 미래 */
const ULID_MAX_TIME = 281474976710655

declare const brand: unique symbol

/**
 * 그냥 string 이 아니다. 아래 `messageId()` 를 거치지 않으면 만들 수 없어서
 * 검사를 건너뛴 값이 흘러들지 않는다.
 */
export type MessageId = string & { readonly [brand]: 'MessageId' }

export function messageId(value: string): Result<MessageId, DomainError> {
  const upper = value.toUpperCase()

  if (upper.length === 0) {
    return err(domainError('empty', '메시지 식별자가 비어 있다', 'id'))
  }

  if (!ULID_PATTERN.test(upper)) {
    return err(
      domainError('invalid-value', `ULID 형식이 아니다: ${value.slice(0, 30)}`, 'id'),
    )
  }

  return ok(upper as MessageId)
}

/**
 * 식별자에 담긴 시각.
 *
 * 앞 10자리가 밀리초 시각이다. 이 값 덕에 정렬만 해도 시간순이 된다.
 */
export function timeOf(id: MessageId): Date {
  let millis = 0
  for (const char of id.slice(0, 10)) {
    millis = millis * 32 + ULID_ALPHABET.indexOf(char)
  }
  return new Date(millis)
}

/** 두 식별자를 시간순으로 줄 세운다 */
export function compareIds(a: MessageId, b: MessageId): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export const ulidLimits = {
  alphabet: ULID_ALPHABET,
  length: 26,
  maxTime: ULID_MAX_TIME,
} as const
