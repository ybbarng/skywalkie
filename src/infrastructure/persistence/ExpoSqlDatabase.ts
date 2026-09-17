import type { SQLiteDatabase } from 'expo-sqlite'
import { type DomainError, domainError } from '@/domain/shared/DomainError'
import { err, ok, type Result } from '@/domain/shared/Result'
import type { RunOutcome, SqlDatabase, SqlValue } from './SqlDatabase'

/**
 * 앱에서 쓰는 데이터베이스.
 *
 * `expo-sqlite` 가 던지는 예외를 전부 잡아 `Result` 로 바꾼다.
 * 예외가 위층으로 새면 화면이 통째로 죽는다.
 */
export class ExpoSqlDatabase implements SqlDatabase {
  constructor(private readonly db: SQLiteDatabase) {}

  async exec(sql: string): Promise<Result<void, DomainError>> {
    try {
      await this.db.execAsync(sql)
      return ok(undefined)
    } catch (cause) {
      return err(toDomainError(cause))
    }
  }

  async run(
    sql: string,
    params: readonly SqlValue[] = [],
  ): Promise<Result<RunOutcome, DomainError>> {
    try {
      const result = await this.db.runAsync(sql, [...params])
      return ok({ changes: result.changes })
    } catch (cause) {
      return err(toDomainError(cause))
    }
  }

  async all<T>(
    sql: string,
    params: readonly SqlValue[] = [],
  ): Promise<Result<T[], DomainError>> {
    try {
      const rows = await this.db.getAllAsync<T>(sql, [...params])
      return ok(rows)
    } catch (cause) {
      return err(toDomainError(cause))
    }
  }

  async get<T>(
    sql: string,
    params: readonly SqlValue[] = [],
  ): Promise<Result<T | null, DomainError>> {
    try {
      const row = await this.db.getFirstAsync<T>(sql, [...params])
      return ok(row ?? null)
    } catch (cause) {
      return err(toDomainError(cause))
    }
  }

  async transaction<T>(
    work: () => Promise<Result<T, DomainError>>,
  ): Promise<Result<T, DomainError>> {
    let outcome: Result<T, DomainError> | null = null

    try {
      await this.db.withTransactionAsync(async () => {
        outcome = await work()
        // 실패하면 예외를 던져 되돌린다. expo-sqlite 는 이 방법만 안다.
        if (!outcome.ok) throw new RollbackSignal()
      })
    } catch (cause) {
      if (cause instanceof RollbackSignal) {
        return outcome ?? err(domainError('invalid-value', '되돌렸다'))
      }
      return err(toDomainError(cause))
    }

    return outcome ?? err(domainError('invalid-value', '아무 일도 하지 않았다'))
  }

  async close(): Promise<void> {
    await this.db.closeAsync()
  }
}

/** 되돌리려고 일부러 던지는 것. 진짜 오류가 아니다 */
class RollbackSignal extends Error {}

function toDomainError(cause: unknown): DomainError {
  const detail = cause instanceof Error ? cause.message : String(cause)

  // 기본 키나 UNIQUE 를 어긴 건 흔한 일이라 따로 알려준다
  if (detail.includes('UNIQUE') || detail.includes('PRIMARY KEY')) {
    return domainError('duplicate', detail)
  }

  return domainError('invalid-value', detail)
}
