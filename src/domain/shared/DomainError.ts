/**
 * 도메인에서 무엇이 잘못됐는지.
 *
 * 화면에 그대로 띄우지 않는다. 화면은 이 값을 보고
 * "무엇이 잘못됐고 무엇을 누르면 되는지"를 한국어로 만들어 보여준다.
 * (docs/07-design-system.md 8장)
 */

export type DomainErrorCode =
  /** 값이 규칙에 맞지 않는다 */
  | 'invalid-value'
  /** 너무 길다 */
  | 'too-long'
  /** 비어 있다 */
  | 'empty'
  /** 이 상태에서는 할 수 없는 일이다 */
  | 'invalid-transition'
  /** 이미 있다 */
  | 'duplicate'
  /** 찾지 못했다 */
  | 'not-found'
  /**
   * 기기가 허락하지 않았다.
   *
   * 다른 것들과 달리 **사용자가 설정에서 풀어주면 되는 일이다.** 그래서
   * 화면이 "안 돼요" 로 끝내지 않고 어디를 눌러야 하는지 알려준다.
   */
  | 'not-allowed'

export interface DomainError {
  readonly code: DomainErrorCode
  /** 어느 값이 문제인지. 화면에서 그 칸을 짚어주는 데 쓴다 */
  readonly field?: string
  /** 개발자가 읽을 설명. 사용자에게 보여주지 않는다 */
  readonly detail: string
}

export function domainError(
  code: DomainErrorCode,
  detail: string,
  field?: string,
): DomainError {
  return field === undefined ? { code, detail } : { code, field, detail }
}
