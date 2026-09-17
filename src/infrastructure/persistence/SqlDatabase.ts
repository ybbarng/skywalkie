import type { DomainError } from '@/domain/shared/DomainError'
import type { Result } from '@/domain/shared/Result'

/**
 * 데이터베이스를 다루는 가장 얇은 약속.
 *
 * 이걸 두는 이유는 **SQL 자체를 컴퓨터에서 시험하기 위해서다.**
 * `expo-sqlite` 는 네이티브 코드라 Node 에서 안 돈다. 그렇다고 저장소를
 * 통째로 가짜로 만들면 정작 확인하고 싶은 SQL 이 시험되지 않는다.
 *
 * 그래서 이 약속만 두고
 *   · 앱에서는 `expo-sqlite` 를 끼우고
 *   · 테스트에서는 Node 에 들어 있는 `node:sqlite` 를 끼운다
 *
 * 둘 다 같은 SQLite 이므로 SQL 이 맞는지, 기본 키가 중복을 막는지,
 * 표를 고쳐도 대화가 살아남는지를 전부 확인할 수 있다.
 */
export interface SqlDatabase {
  /** 여러 문장을 한 번에. 표를 만들 때 쓴다 */
  exec(sql: string): Promise<Result<void, DomainError>>

  /** 값을 바꾸는 문장 */
  run(sql: string, params?: readonly SqlValue[]): Promise<Result<RunOutcome, DomainError>>

  /** 여러 줄을 읽는다 */
  all<T>(sql: string, params?: readonly SqlValue[]): Promise<Result<T[], DomainError>>

  /** 한 줄만 읽는다. 없으면 null */
  get<T>(
    sql: string,
    params?: readonly SqlValue[],
  ): Promise<Result<T | null, DomainError>>

  /**
   * 묶어서 처리한다. 도중에 실패하면 전부 되돌린다.
   *
   * 되돌리기를 할 때 특히 중요하다. 만 건을 넣다가 중간에 실패했는데
   * 절반만 들어가 있으면 다시 불러올 때 무엇이 빠졌는지 알 수 없다.
   */
  transaction<T>(
    work: () => Promise<Result<T, DomainError>>,
  ): Promise<Result<T, DomainError>>

  close(): Promise<void>
}

export type SqlValue = string | number | null

export interface RunOutcome {
  readonly changes: number
}
