import type { Message } from '@/domain/message/Message'
import type { Clock } from '@/domain/shared/Clock'
import type { DomainError } from '@/domain/shared/DomainError'
import type { IdGenerator } from '@/domain/shared/IdGenerator'
import { ok, type Result } from '@/domain/shared/Result'
import type { ConversationRepository } from '../ports/ConversationRepository'
import { PROTOCOL_VERSION } from '../ports/Envelope'
import type { MessageTransport } from '../ports/MessageTransport'

/**
 * 연결이 돌아왔다. 쌓인 메시지를 내보낸다.
 *
 * **순서를 지킨다.** 순번 순서대로 하나씩 보낸다. 한꺼번에 병렬로 보내면
 * 순서가 뒤바뀌어 대화가 이상해진다. 좁은 길에서는 더 그렇다.
 *
 * 한 건이 여러 번 실패하면 그것만 실패로 두고 다음 것으로 넘어간다.
 * 하나가 막혔다고 나머지가 못 나가면 안 된다.
 */
export class FlushPendingMessages {
  constructor(
    private readonly repository: ConversationRepository,
    private readonly transport: MessageTransport,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly maxAttempts = DEFAULT_MAX_ATTEMPTS,
  ) {}

  async execute(): Promise<Result<FlushOutcome, DomainError>> {
    const waiting = await this.repository.findWaitingToSend()
    if (!waiting.ok) return waiting

    let sent = 0
    let failed = 0

    for (const message of waiting.value) {
      const outcome = await this.sendOne(message)
      if (outcome === 'sent') {
        sent += 1
        continue
      }

      failed += 1

      // 연결이 아예 끊긴 것이면 나머지도 안 나간다. 여기서 멈춘다.
      if (!this.transport.currentState().isUsable()) break
    }

    return ok({ sent, failed, total: waiting.value.length })
  }

  private async sendOne(message: Message): Promise<'sent' | 'failed'> {
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      const result = await this.transport.send({
        v: PROTOCOL_VERSION,
        t: 'message',
        id: this.ids.next(),
        seq: message.seq,
        ts: this.clock.epochMillis(),
        p: {
          messageId: message.id,
          author: message.author,
          content: message.content,
          sentAt: message.sentAt.getTime(),
          messageSeq: message.seq,
        },
      })

      if (result.ok) {
        const sending = message.isWaitingToSend() ? message.markSending() : ok(message)
        if (sending.ok) await this.repository.updateDelivery(sending.value)
        return 'sent'
      }
    }

    // 여러 번 해도 안 되면 실패로 두고 화면에 다시 보내기 버튼을 띄운다
    const failed = message.isWaitingToSend() ? message.markSending() : ok(message)
    if (failed.ok) {
      const marked = failed.value.markFailed()
      if (marked.ok) await this.repository.updateDelivery(marked.value)
    }
    return 'failed'
  }
}

/** 한 메시지를 몇 번까지 다시 보낼까 */
export const DEFAULT_MAX_ATTEMPTS = 5

export interface FlushOutcome {
  readonly sent: number
  readonly failed: number
  readonly total: number
}
