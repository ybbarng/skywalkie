import type { Message } from '@/domain/message/Message'
import type { Clock } from '@/domain/shared/Clock'
import type { DomainError } from '@/domain/shared/DomainError'
import { ok, type Result } from '@/domain/shared/Result'
import type { ConversationRepository } from '../ports/ConversationRepository'
import type { Hasher } from '../ports/FileStore'
import {
  ARCHIVE_FORMAT,
  ARCHIVE_VERSION,
  type ArchivedMessage,
  type ArchivedPerson,
} from './ArchiveFormat'
import { computeIntegrity } from './ArchiveIntegrity'
import {
  renderHtmlDay,
  renderHtmlFoot,
  renderHtmlHead,
  renderHtmlMessage,
} from './renderHtml'
import {
  isSameDay,
  renderDateBreak,
  renderTextHeader,
  renderTextMessage,
} from './renderText'

/**
 * 대화를 파일로 꺼낸다.
 *
 * **한 번에 다 읽지 않는다.** 만 건을 통째로 문자열로 만들면 폰이
 * 죽는다. 저장소에서 조금씩 꺼내 쓰면서 동시에 검증값을 쌓는다.
 *
 * 그래서 `integrity` 가 파일 **끝**에 온다. 다 읽어봐야 알 수 있는
 * 값이라 앞에 둘 수가 없다. JSON 은 자리 순서를 따지지 않으니 괜찮다.
 *
 * (docs/05-messaging-spec.md 6장 · T19)
 */

export interface ExportDeps {
  readonly repository: ConversationRepository
  readonly hasher: Hasher
  readonly clock: Clock
}

export interface ExportInput {
  readonly people: readonly ArchivedPerson[]
  /** 한 번에 몇 건씩 꺼낼까 */
  readonly batchSize?: number
  /** 진행률. 화면을 막지 않으려고 알려준다 */
  onProgress?: (done: number, total: number) => void
}

const DEFAULT_BATCH_SIZE = 200

export class ExportConversation {
  constructor(private readonly deps: ExportDeps) {}

  /**
   * 조각조각 흘려 내보낸다. `FileStore.writeStream` 이 받아 쓴다.
   *
   * 도중에 저장소가 실패하면 **거기서 멈춘다.** 반쯤 쓰인 파일이
   * 남는데, 그건 검증값이 없어서 되돌릴 때 걸린다. 조용히 넘어가는
   * 것보다 낫다.
   */
  async *toJsonChunks(input: ExportInput): AsyncIterable<string> {
    const batchSize = input.batchSize ?? DEFAULT_BATCH_SIZE
    const total = await this.deps.repository.count()
    const expected = total.ok ? total.value : 0

    yield `{"format":${JSON.stringify(ARCHIVE_FORMAT)},`
    yield `"version":${ARCHIVE_VERSION},`
    yield `"exportedAt":${this.deps.clock.now().getTime()},`
    yield `"people":${JSON.stringify(input.people)},`
    yield '"messages":['

    const ids: string[] = []
    let done = 0
    let first = true

    for await (const batch of this.deps.repository.streamAll(batchSize)) {
      for (const message of batch) {
        yield first ? '' : ','
        first = false
        yield JSON.stringify(toArchived(message))
        ids.push(message.id)
      }

      done += batch.length
      input.onProgress?.(done, expected)
    }

    yield '],'

    const integrity = await computeIntegrity(this.deps.hasher, ids)
    // 요약에 실패해도 메시지는 이미 다 썼다. 건수만이라도 남겨
    // 되돌릴 때 잘린 것을 알아채게 한다.
    const value = integrity.ok
      ? integrity.value
      : {
          messageCount: ids.length,
          checksum: '',
          firstMessageId: ids[0] ?? null,
          lastMessageId: ids[ids.length - 1] ?? null,
        }

    // 시작할 때 센 수를 같이 적는다. 꺼내다 만 것을 알아채는 유일한 단서다.
    yield `"integrity":${JSON.stringify({ ...value, sourceCount: expected })}}`
  }

  /**
   * 어디서든 열리는 가장 단순한 형태. 되돌릴 수는 없다.
   */
  async *toTextChunks(input: ExportInput): AsyncIterable<string> {
    const nameOf = nameLookup(input.people)
    yield renderTextHeader(input.people)

    let previousDay: Date | null = null

    for await (const batch of this.deps.repository.streamAll(
      input.batchSize ?? DEFAULT_BATCH_SIZE,
    )) {
      for (const message of batch) {
        const archived = toArchived(message)
        const at = new Date(archived.receivedAt ?? archived.sentAt)

        if (previousDay === null || !isSameDay(previousDay, at)) {
          yield renderDateBreak(at)
          previousDay = at
        }

        yield renderTextMessage(archived, nameOf)
      }
    }
  }

  /**
   * 앱 없이 열리는 한 장짜리 파일. 낙서까지 보인다.
   */
  async *toHtmlChunks(input: ExportInput & { me: string }): AsyncIterable<string> {
    const nameOf = nameLookup(input.people)
    yield renderHtmlHead(input.people)

    let previousDay: Date | null = null

    for await (const batch of this.deps.repository.streamAll(
      input.batchSize ?? DEFAULT_BATCH_SIZE,
    )) {
      for (const message of batch) {
        const archived = toArchived(message)
        const at = new Date(archived.receivedAt ?? archived.sentAt)

        if (previousDay === null || !isSameDay(previousDay, at)) {
          yield renderHtmlDay(at)
          previousDay = at
        }

        yield renderHtmlMessage(archived, input.me, nameOf)
      }
    }

    yield renderHtmlFoot()
  }

  /** 작은 대화를 한 번에. 시험과 미리보기에 쓴다 */
  async toJson(input: ExportInput): Promise<Result<string, DomainError>> {
    return ok(await collect(this.toJsonChunks(input)))
  }

  async toText(input: ExportInput): Promise<Result<string, DomainError>> {
    return ok(await collect(this.toTextChunks(input)))
  }

  async toHtml(
    input: ExportInput & { me: string },
  ): Promise<Result<string, DomainError>> {
    return ok(await collect(this.toHtmlChunks(input)))
  }
}

async function collect(chunks: AsyncIterable<string>): Promise<string> {
  let text = ''
  for await (const chunk of chunks) text += chunk
  return text
}

/** 식별자를 이름으로. 모르는 사람이면 식별자를 그대로 보여준다 */
function nameLookup(people: readonly ArchivedPerson[]): (peerId: string) => string {
  const names = new Map(people.map(person => [person.peerId, person.displayName]))
  return id => names.get(id) ?? id
}

export function toArchived(message: Message): ArchivedMessage {
  return {
    id: message.id,
    author: message.author,
    content: message.content,
    sentAt: message.sentAt.getTime(),
    receivedAt: message.receivedAt?.getTime() ?? null,
    seq: message.seq,
    delivery: message.delivery,
  }
}
