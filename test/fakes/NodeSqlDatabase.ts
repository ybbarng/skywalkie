import { DatabaseSync } from 'node:sqlite'
import { type DomainError, domainError } from '@/domain/shared/DomainError'
import { err, ok, type Result } from '@/domain/shared/Result'
import type {
  RunOutcome,
  SqlDatabase,
  SqlValue,
} from '@/infrastructure/persistence/SqlDatabase'

/**
 * 테스트에서 쓰는 진짜 SQLite.
 *
 * **가짜가 아니다.** Node 24 에 들어 있는 실제 SQLite 를 쓴다. 그래서
 * 앱에서 도는 것과 같은 SQL 이 실행되고, 기본 키가 진짜로 중복을 막고,
 * 표를 올리는 것도 진짜로 돈다.
 *
 * 저장소를 통째로 가짜로 만들면 정작 확인하고 싶은 SQL 이 시험되지 않는다.
 * (docs/09-testing.md)
 */
export class NodeSqlDatabase implements SqlDatabase {
  private readonly db: DatabaseSync

  constructor(path = ':memory:') {
    this.db = new DatabaseSync(path)
    // 앱과 같은 조건으로 맞춘다
    this.db.exec('PRAGMA foreign_keys = ON;')
  }

  async exec(sql: string): Promise<Result<void, DomainError>> {
    try {
      this.db.exec(sql)
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
      const statement = this.db.prepare(sql)
      const result = statement.run(...params)
      return ok({ changes: Number(result.changes) })
    } catch (cause) {
      return err(toDomainError(cause))
    }
  }

  async all<T>(
    sql: string,
    params: readonly SqlValue[] = [],
  ): Promise<Result<T[], DomainError>> {
    try {
      const statement = this.db.prepare(sql)
      return ok(statement.all(...params) as T[])
    } catch (cause) {
      return err(toDomainError(cause))
    }
  }

  async get<T>(
    sql: string,
    params: readonly SqlValue[] = [],
  ): Promise<Result<T | null, DomainError>> {
    try {
      const statement = this.db.prepare(sql)
      return ok((statement.get(...params) as T | undefined) ?? null)
    } catch (cause) {
      return err(toDomainError(cause))
    }
  }

  async transaction<T>(
    work: () => Promise<Result<T, DomainError>>,
  ): Promise<Result<T, DomainError>> {
    this.db.exec('BEGIN')
    try {
      const outcome = await work()
      this.db.exec(outcome.ok ? 'COMMIT' : 'ROLLBACK')
      return outcome
    } catch (cause) {
      this.db.exec('ROLLBACK')
      return err(toDomainError(cause))
    }
  }

  async close(): Promise<void> {
    this.db.close()
  }
}

function toDomainError(cause: unknown): DomainError {
  const detail = cause instanceof Error ? cause.message : String(cause)

  if (detail.includes('UNIQUE') || detail.includes('PRIMARY KEY')) {
    return domainError('duplicate', detail)
  }

  return domainError('invalid-value', detail)
}
