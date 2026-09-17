import type { DomainError } from '@/domain/shared/DomainError'
import { domainError } from '@/domain/shared/DomainError'
import { err, ok, type Result } from '@/domain/shared/Result'
import type { SqlDatabase } from '../SqlDatabase'
import { createTables, metaKeys, SCHEMA_VERSION } from '../schema'

/**
 * 표를 만들고 올린다.
 *
 * **절대 메시지를 지우지 않는다.** 아이폰 앱이 7일마다 만료되고
 * 그때마다 덮어쓰기로 다시 깐다. 표를 고칠 때 대화가 날아가면
 * 이 앱을 만든 이유가 없어진다.
 *
 * 새 항목이 필요하면 `ALTER TABLE ... ADD COLUMN` 으로 더한다.
 * 항목을 지우거나 이름을 바꾸는 변경은 하지 않는다.
 */

interface Migration {
  readonly version: number
  readonly describe: string
  run(db: SqlDatabase): Promise<Result<void, DomainError>>
}

const migrations: readonly Migration[] = [
  {
    version: 1,
    describe: '메시지 표를 만든다',
    async run(db) {
      return db.exec(createTables)
    },
  },
]

export async function migrate(
  db: SqlDatabase,
): Promise<Result<MigrateOutcome, DomainError>> {
  // 표가 아예 없을 수도 있으므로 메타 표부터 만든다
  const meta = await db.exec(
    'CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);',
  )
  if (!meta.ok) return meta

  const current = await readVersion(db)
  if (!current.ok) return current

  const pending = migrations.filter(m => m.version > current.value)

  for (const migration of pending) {
    const applied = await migration.run(db)
    if (!applied.ok) {
      return err(
        domainError(
          'invalid-value',
          `표를 ${migration.version}번으로 올리지 못했다: ${applied.error.detail}`,
        ),
      )
    }

    const recorded = await db.run(
      'INSERT OR REPLACE INTO schema_meta (key, value) VALUES (?, ?)',
      [metaKeys.schemaVersion, String(migration.version)],
    )
    if (!recorded.ok) return recorded
  }

  return ok({ from: current.value, to: SCHEMA_VERSION, applied: pending.length })
}

async function readVersion(db: SqlDatabase): Promise<Result<number, DomainError>> {
  const row = await db.get<{ value: string }>(
    'SELECT value FROM schema_meta WHERE key = ?',
    [metaKeys.schemaVersion],
  )
  if (!row.ok) return row

  if (row.value === null) return ok(0)

  const parsed = Number.parseInt(row.value.value, 10)
  return ok(Number.isNaN(parsed) ? 0 : parsed)
}

export interface MigrateOutcome {
  readonly from: number
  readonly to: number
  readonly applied: number
}
