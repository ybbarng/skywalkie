/**
 * 성공과 실패를 값으로 다룬다.
 *
 * 예외를 던지지 않는 이유: 부르는 쪽이 실패를 다루는 걸 잊을 수 없게 하기 위해서다.
 * 타입이 강제하므로 "연결이 끊겼을 때"를 빠뜨린 채 넘어갈 수 없다.
 * 이 앱은 비행기에서 고칠 기회가 없어서 이런 강제가 값을 한다.
 */

import type { DomainError } from './DomainError'

export type Result<T, E = DomainError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E }

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value }
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error }
}

export function isOk<T, E>(
  result: Result<T, E>,
): result is { readonly ok: true; readonly value: T } {
  return result.ok
}

export function isErr<T, E>(
  result: Result<T, E>,
): result is { readonly ok: false; readonly error: E } {
  return !result.ok
}

/** 성공한 값을 다른 값으로 바꾼다. 실패면 그대로 흘려보낸다. */
export function map<T, U, E>(
  result: Result<T, E>,
  transform: (value: T) => U,
): Result<U, E> {
  return result.ok ? ok(transform(result.value)) : result
}

/** 성공한 값으로 또 실패할 수 있는 일을 한다. 실패가 이어지면 첫 실패가 남는다. */
export function flatMap<T, U, E>(
  result: Result<T, E>,
  transform: (value: T) => Result<U, E>,
): Result<U, E> {
  return result.ok ? transform(result.value) : result
}

/** 실패면 대신 쓸 값을 준다. */
export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  return result.ok ? result.value : fallback
}

/**
 * 여러 결과를 하나로 모은다. 하나라도 실패하면 첫 실패를 준다.
 * 메시지 여러 건을 한꺼번에 다룰 때 쓴다.
 */
export function all<T, E>(results: readonly Result<T, E>[]): Result<T[], E> {
  const values: T[] = []
  for (const result of results) {
    if (!result.ok) return result
    values.push(result.value)
  }
  return ok(values)
}
