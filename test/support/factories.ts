/**
 * 테스트에서 쓰는 값을 만드는 곳.
 *
 * 임의의 문자열(`'test-id'`) 대신 **실제로 앱이 다루는 형식**을 만든다.
 * 그래야 형식이 어긋나서 생기는 문제를 테스트가 잡아낸다.
 */

import { Conversation } from '@/domain/message/Conversation'
import { Message } from '@/domain/message/Message'
import {
  type MessageContent,
  nudgeContent,
  textContent,
} from '@/domain/message/MessageContent'
import { type MessageId, messageId } from '@/domain/message/MessageId'
import { type PeerId, peerId } from '@/domain/peer/PeerId'

const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/**
 * 실제 ULID 형식의 식별자를 만든다.
 *
 * 앞 10자리는 시각, 뒤 16자리는 구분용이다. 순서대로 만들면
 * 정렬했을 때 시간순이 되어 실제 앱과 같은 성질을 갖는다.
 */
export function makeUlid(millis: number, counter = 0): MessageId {
  let time = ''
  let remaining = millis
  for (let i = 0; i < 10; i += 1) {
    time = ULID_ALPHABET[remaining % 32] + time
    remaining = Math.floor(remaining / 32)
  }

  let tail = ''
  let n = counter
  for (let i = 0; i < 16; i += 1) {
    tail = ULID_ALPHABET[n % 32] + tail
    n = Math.floor(n / 32)
  }

  const result = messageId(time + tail)
  if (!result.ok)
    throw new Error(`테스트용 ULID 를 만들지 못했다: ${result.error.detail}`)
  return result.value
}

/** 순서대로 ULID 를 뽑아주는 것. 실제 IdGenerator 와 같은 성질을 갖는다 */
export function ulidSequence(startMillis = 1758000000000) {
  let counter = 0
  return () => {
    const id = makeUlid(startMillis + counter, counter)
    counter += 1
    return id
  }
}

export function makePeerId(name: 'me' | 'her' | string = 'me'): PeerId {
  // 실제 앱은 무작위 문자열을 쓴다. 테스트에서는 읽기 쉽게 하되
  // 길이와 글자 규칙은 실제와 같게 맞춘다.
  const padded = `peer-${name}`.padEnd(12, '0')
  const result = peerId(padded)
  if (!result.ok)
    throw new Error(`테스트용 PeerId 를 만들지 못했다: ${result.error.detail}`)
  return result.value
}

export const ME = makePeerId('me')
export const HER = makePeerId('her')

export function makeText(raw: string): MessageContent {
  const result = textContent(raw)
  if (!result.ok) throw new Error(`테스트용 글을 만들지 못했다: ${result.error.detail}`)
  return result.value
}

interface DraftOptions {
  id?: MessageId
  author?: PeerId
  content?: MessageContent
  seq?: number
  now?: Date
}

export function makeDraft(options: DraftOptions = {}): Message {
  const result = Message.draft({
    id: options.id ?? makeUlid(1758000000000),
    author: options.author ?? ME,
    content: options.content ?? makeText('34열 창가야'),
    seq: options.seq ?? 1,
    now: options.now ?? new Date(1758000000000),
  })
  if (!result.ok)
    throw new Error(`테스트용 메시지를 만들지 못했다: ${result.error.detail}`)
  return result.value
}

interface ReceivedOptions extends DraftOptions {
  sentAt?: Date
}

export function makeReceived(options: ReceivedOptions = {}): Message {
  const now = options.now ?? new Date(1758000000500)
  const result = Message.received({
    id: options.id ?? makeUlid(1758000000000),
    author: options.author ?? HER,
    content: options.content ?? makeText('나는 12열 통로'),
    seq: options.seq ?? 1,
    sentAt: options.sentAt ?? new Date(1758000000000),
    now,
  })
  if (!result.ok)
    throw new Error(`테스트용 메시지를 만들지 못했다: ${result.error.detail}`)
  return result.value
}

export function makeNudge(options: DraftOptions = {}): Message {
  return makeDraft({ ...options, content: nudgeContent() })
}

export function startConversation(me: PeerId = ME): Conversation {
  return Conversation.start(me)
}

/** 상대에게서 이 순번들을 차례로 받았다고 치고 대화를 만든다 */
export function conversationAfterReceiving(
  seqs: readonly number[],
  from: PeerId = HER,
): Conversation {
  const nextId = ulidSequence()
  let conversation = startConversation()
  for (const seq of seqs) {
    const message = makeReceived({ id: nextId(), author: from, seq })
    conversation = conversation.accept(message).conversation
  }
  return conversation
}
