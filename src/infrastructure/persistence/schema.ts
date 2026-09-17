/**
 * 표 구조.
 *
 * **여기서 지키는 두 가지가 코드의 실수를 막는다.**
 *
 *   · `PRIMARY KEY (id)`        — 같은 메시지가 두 번 들어가지 않는다
 *   · `UNIQUE (author_id, seq)` — 한 사람의 같은 순번이 두 개일 수 없다
 *
 * 위층에서 아무리 조심해도 실수는 난다. 저장소가 최종 보루다.
 * (docs/05-messaging-spec.md 5장)
 */

export const SCHEMA_VERSION = 1

export const createTables = `
CREATE TABLE IF NOT EXISTS schema_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id            TEXT    PRIMARY KEY,
  author_id     TEXT    NOT NULL,
  content_kind  TEXT    NOT NULL,
  content_body  TEXT    NOT NULL,
  sent_at       INTEGER NOT NULL,
  received_at   INTEGER,
  seq           INTEGER NOT NULL,
  delivery      TEXT    NOT NULL,
  link_kind     TEXT,
  UNIQUE (author_id, seq)
);

-- 화면은 늘 최신부터 거슬러 올라간다.
-- 받은 시각이 같을 때를 대비해 식별자까지 넣어 순서를 확정한다.
CREATE INDEX IF NOT EXISTS idx_messages_ordered
  ON messages (received_at DESC, id DESC);

-- 연결이 돌아왔을 때 내보낼 것만 빠르게 찾는다.
CREATE INDEX IF NOT EXISTS idx_messages_waiting
  ON messages (delivery, seq)
  WHERE delivery IN ('draft', 'pending', 'sending');
`

/** 대화가 한 건도 없을 때에도 대화 상태를 되살릴 수 있게 적어두는 값들 */
export const metaKeys = {
  schemaVersion: 'schema_version',
  myPeerId: 'my_peer_id',
} as const

export interface MessageRow {
  readonly id: string
  readonly author_id: string
  readonly content_kind: string
  readonly content_body: string
  readonly sent_at: number
  readonly received_at: number | null
  readonly seq: number
  readonly delivery: string
  readonly link_kind: string | null
}
