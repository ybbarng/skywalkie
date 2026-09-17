import type {
  ConversationRepository,
  PageOptions,
  SaveManyOutcome,
} from '@/application/ports/ConversationRepository'
import type { Unsubscribe } from '@/application/ports/MessageTransport'
import type { LinkKind } from '@/domain/connection/LinkKind'
import { Conversation } from '@/domain/message/Conversation'
import type { Message } from '@/domain/message/Message'
import type { MessageId } from '@/domain/message/MessageId'
import { type PeerId, peerId } from '@/domain/peer/PeerId'
import { type DomainError, domainError } from '@/domain/shared/DomainError'
import { err, ok, type Result } from '@/domain/shared/Result'
import { MessageMapper } from './mappers/MessageMapper'
import type { SqlDatabase } from './SqlDatabase'
import type { MessageRow } from './schema'

/**
 * SQLite 에 대화를 담는다.
 *
 * 화면에 꺼낼 때 `OFFSET` 을 쓰지 않는 것이 요점이다. 메시지가 쌓이면
 * 뒤로 갈수록 느려지기 때문이다. 대신 마지막으로 본 지점을 기준으로
 * 그 앞을 찾는다. 만 건이 있어도 늘 같은 속도다.
 * (docs/05-messaging-spec.md 5장)
 */
export class SqliteConversationRepository implements ConversationRepository {
  private readonly listeners = new Set<() => void>()

  constructor(private readonly db: SqlDatabase) {}

  async load(me: PeerId): Promise<Result<Conversation, DomainError>> {
    // 대화 상태를 되살리는 데 메시지 전부가 필요하지는 않다. 세 가지면 된다.
    //   · 내 순번이 어디까지 갔나 (여기서 이어가야 상대가 안 버린다)
    //   · 상대에게서 어느 순번까지 받았고 무엇이 빠졌나
    //   · 읽지 않은 게 몇 건인가
    //
    // 만 건을 전부 읽어 하나씩 되살리면 앱을 켜는 데 그만큼 걸린다.
    const seqs = await this.db.all<{ author_id: string; seq: number }>(
      'SELECT author_id, seq FROM messages ORDER BY author_id, seq',
    )
    if (!seqs.ok) return seqs

    const unread = await this.db.get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM messages WHERE author_id <> ? AND delivery = 'delivered'",
      [me],
    )
    if (!unread.ok) return unread

    const seenSeqsByPeer = new Map<PeerId, number[]>()
    let myMaxSeq = 0

    for (const row of seqs.value) {
      if (row.author_id === me) {
        myMaxSeq = Math.max(myMaxSeq, row.seq)
        continue
      }
      const author = peerId(row.author_id)
      if (!author.ok) continue

      const list = seenSeqsByPeer.get(author.value) ?? []
      list.push(row.seq)
      seenSeqsByPeer.set(author.value, list)
    }

    return Conversation.restore({
      me,
      seenSeqsByPeer,
      nextOutgoingSeq: myMaxSeq + 1,
      unreadCount: unread.value?.n ?? 0,
    })
  }

  async save(
    message: Message,
    linkKind: LinkKind | null = null,
  ): Promise<Result<void, DomainError>> {
    const row = MessageMapper.toRow(message, linkKind)

    const result = await this.db.run(
      `INSERT INTO messages
         (id, author_id, content_kind, content_body, sent_at, received_at, seq, delivery, link_kind)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.author_id,
        row.content_kind,
        row.content_body,
        row.sent_at,
        row.received_at,
        row.seq,
        row.delivery,
        row.link_kind,
      ],
    )

    if (!result.ok) {
      // 기본 키나 순번이 겹쳤다. 이건 오류가 아니라 흔한 일이다.
      if (isUniqueViolation(result.error)) {
        return err(domainError('duplicate', '이미 있는 메시지다', 'id'))
      }
      return result
    }

    this.notify()
    return ok(undefined)
  }

  async saveMany(
    messages: readonly Message[],
  ): Promise<Result<SaveManyOutcome, DomainError>> {
    // 묶어서 처리한다. 도중에 실패하면 전부 되돌려서
    // 절반만 들어간 상태가 남지 않게 한다.
    return this.db.transaction(async () => {
      let inserted = 0
      let skipped = 0

      for (const message of messages) {
        const result = await this.save(message)
        if (result.ok) inserted += 1
        else if (result.error.code === 'duplicate') skipped += 1
        else return result
      }

      return ok({ inserted, skipped })
    })
  }

  async updateDelivery(message: Message): Promise<Result<void, DomainError>> {
    const result = await this.db.run(
      'UPDATE messages SET delivery = ?, received_at = ? WHERE id = ?',
      [message.delivery, message.receivedAt?.getTime() ?? null, message.id],
    )
    if (!result.ok) return result

    if (result.value.changes === 0) {
      return err(domainError('not-found', '없는 메시지다', 'id'))
    }

    this.notify()
    return ok(undefined)
  }

  async findById(id: MessageId): Promise<Result<Message | null, DomainError>> {
    const row = await this.db.get<MessageRow>('SELECT * FROM messages WHERE id = ?', [id])
    if (!row.ok) return row
    if (row.value === null) return ok(null)

    return MessageMapper.toDomain(row.value)
  }

  async findBySeq(
    author: PeerId,
    seq: number,
  ): Promise<Result<Message | null, DomainError>> {
    const row = await this.db.get<MessageRow>(
      'SELECT * FROM messages WHERE author_id = ? AND seq = ?',
      [author, seq],
    )
    if (!row.ok) return row
    if (row.value === null) return ok(null)

    return MessageMapper.toDomain(row.value)
  }

  async loadPage(options: PageOptions): Promise<Result<Message[], DomainError>> {
    // OFFSET 을 쓰지 않는다. 뒤로 갈수록 느려지기 때문이다.
    // 대신 마지막으로 본 지점을 기준으로 그 앞을 찾는다.
    //
    // 받은 시각이 없는 메시지(내가 보낸 것)는 보낸 시각으로 줄 세운다.
    const orderKey = 'COALESCE(received_at, sent_at)'

    const query =
      options.before === undefined
        ? {
            sql: `SELECT * FROM messages ORDER BY ${orderKey} DESC, id DESC LIMIT ?`,
            params: [options.limit],
          }
        : {
            sql: `SELECT * FROM messages
                  WHERE ${orderKey} < ? OR (${orderKey} = ? AND id < ?)
                  ORDER BY ${orderKey} DESC, id DESC
                  LIMIT ?`,
            params: [
              options.before.orderedAt,
              options.before.orderedAt,
              options.before.id,
              options.limit,
            ],
          }

    const rows = await this.db.all<MessageRow>(query.sql, query.params)
    if (!rows.ok) return rows

    // 화면은 최신이 아래에 오도록 그린다
    return mapRows(rows.value.reverse())
  }

  async findWaitingToSend(): Promise<Result<Message[], DomainError>> {
    const rows = await this.db.all<MessageRow>(
      `SELECT * FROM messages
       WHERE delivery IN ('draft', 'pending')
       ORDER BY seq ASC`,
    )
    if (!rows.ok) return rows

    return mapRows(rows.value)
  }

  async count(): Promise<Result<number, DomainError>> {
    const row = await this.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM messages')
    if (!row.ok) return row
    return ok(row.value?.n ?? 0)
  }

  async *streamAll(batchSize: number): AsyncIterable<Message[]> {
    // 한 번에 다 읽지 않는다. 만 건을 내보낼 때 폰이 죽는다.
    let lastId = ''

    for (;;) {
      const rows = await this.db.all<MessageRow>(
        'SELECT * FROM messages WHERE id > ? ORDER BY id ASC LIMIT ?',
        [lastId, batchSize],
      )
      if (!rows.ok || rows.value.length === 0) return

      const mapped = mapRows(rows.value)
      if (!mapped.ok) return

      yield mapped.value

      const last = rows.value.at(-1)
      if (last === undefined) return
      lastId = last.id
    }
  }

  onChange(handler: () => void): Unsubscribe {
    this.listeners.add(handler)
    return () => this.listeners.delete(handler)
  }

  private notify(): void {
    for (const listener of this.listeners) listener()
  }
}

function mapRows(rows: readonly MessageRow[]): Result<Message[], DomainError> {
  const messages: Message[] = []
  for (const row of rows) {
    const mapped = MessageMapper.toDomain(row)
    if (!mapped.ok) return mapped
    messages.push(mapped.value)
  }
  return ok(messages)
}

/** SQLite 가 기본 키나 UNIQUE 를 어겼다고 말하는지 */
function isUniqueViolation(error: DomainError): boolean {
  return (
    error.code === 'duplicate' ||
    error.detail.includes('UNIQUE') ||
    error.detail.includes('PRIMARY KEY')
  )
}
