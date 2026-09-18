import { describe, expect, it } from 'vitest'
import { Message } from '@/domain/message/Message'
import { textContent, voiceContent } from '@/domain/message/MessageContent'
import type { MessageId } from '@/domain/message/MessageId'
import type { PeerId } from '@/domain/peer/PeerId'
import { type AutoplayInput, alreadyThere, nextToPlay } from './voiceAutoplay'

const ME = 'peer-me000001' as PeerId
const HER = 'peer-her00001' as PeerId

let counter = 0

function voice(author: PeerId, assetId: string): Message {
  counter += 1
  const content = voiceContent({ assetId, durationMs: 3000, byteLength: 9000 })
  if (!content.ok) throw new Error('음성을 못 만들었다')

  const made = Message.received({
    id: `01JBQZ8K4M7N2P5R8T1V3W6Y${String(counter).padStart(2, '0')}` as MessageId,
    author,
    content: content.value,
    sentAt: new Date(1_700_000_000_000 + counter * 1000),
    now: new Date(1_700_000_000_000 + counter * 1000),
    seq: counter,
  })
  if (!made.ok) throw new Error('메시지를 못 만들었다')

  return made.value
}

function text(author: PeerId): Message {
  counter += 1
  const content = textContent('그냥 글')
  if (!content.ok) throw new Error('글을 못 만들었다')

  const made = Message.received({
    id: `01JBQZ8K4M7N2P5R8T1V3W6X${String(counter).padStart(2, '0')}` as MessageId,
    author,
    content: content.value,
    sentAt: new Date(1_700_000_000_000 + counter * 1000),
    now: new Date(1_700_000_000_000 + counter * 1000),
    seq: counter,
  })
  if (!made.ok) throw new Error('메시지를 못 만들었다')

  return made.value
}

function base(over: Partial<AutoplayInput> = {}): AutoplayInput {
  return {
    enabled: true,
    me: ME,
    messages: [],
    ready: {},
    played: new Set(),
    playing: false,
    appActive: true,
    ...over,
  }
}

describe('저절로 틀 것 고르기', () => {
  it('상대가 보낸 것을 튼다', () => {
    const message = voice(HER, 'asset-1')

    expect(
      nextToPlay(base({ messages: [message], ready: { 'asset-1': '/tmp/a' } })),
    ).toBe('asset-1')
  })

  it('내가 보낸 것은 안 튼다', () => {
    // 방금 내가 말한 것이다. 내 목소리를 다시 들을 이유가 없다.
    const message = voice(ME, 'asset-2')

    expect(
      nextToPlay(base({ messages: [message], ready: { 'asset-2': '/tmp/a' } })),
    ).toBeNull()
  })

  it('아직 다 안 온 것은 못 튼다', () => {
    const message = voice(HER, 'asset-3')

    expect(nextToPlay(base({ messages: [message], ready: {} }))).toBeNull()
  })

  it('글은 건너뛴다', () => {
    const messages = [text(HER), voice(HER, 'asset-4')]

    expect(nextToPlay(base({ messages, ready: { 'asset-4': '/tmp/a' } }))).toBe('asset-4')
  })
})

describe('한 번 튼 것은 다시 안 튼다', () => {
  it('이미 튼 것은 건너뛴다', () => {
    const message = voice(HER, 'asset-5')

    expect(
      nextToPlay(
        base({
          messages: [message],
          ready: { 'asset-5': '/tmp/a' },
          played: new Set(['asset-5']),
        }),
      ),
    ).toBeNull()
  })

  it('이미 튼 것을 건너뛰고 다음 것을 튼다', () => {
    const first = voice(HER, 'asset-6')
    const second = voice(HER, 'asset-7')

    expect(
      nextToPlay(
        base({
          messages: [first, second],
          ready: { 'asset-6': '/tmp/a', 'asset-7': '/tmp/b' },
          played: new Set(['asset-6']),
        }),
      ),
    ).toBe('asset-7')
  })
})

describe('하나씩 온 순서대로', () => {
  it('무언가 나오는 중이면 기다린다', () => {
    // 두 개가 겹치면 둘 다 못 알아듣는다.
    const message = voice(HER, 'asset-8')

    expect(
      nextToPlay(
        base({ messages: [message], ready: { 'asset-8': '/tmp/a' }, playing: true }),
      ),
    ).toBeNull()
  })

  it('먼저 온 것부터 튼다', () => {
    const first = voice(HER, 'asset-9')
    const second = voice(HER, 'asset-10')

    expect(
      nextToPlay(
        base({
          messages: [first, second],
          ready: { 'asset-9': '/tmp/a', 'asset-10': '/tmp/b' },
        }),
      ),
    ).toBe('asset-9')
  })
})

describe('안 틀어야 할 때', () => {
  it('꺼져 있으면 안 튼다', () => {
    const message = voice(HER, 'asset-11')

    expect(
      nextToPlay(
        base({ enabled: false, messages: [message], ready: { 'asset-11': '/tmp/a' } }),
      ),
    ).toBeNull()
  })

  it('앱을 안 보고 있으면 안 튼다', () => {
    // 잠금 화면에서 소리가 나면 옆자리 승객이 듣는다. 무엇이 나올지
    // 모른 채 소리가 나는 것은 겁난다.
    const message = voice(HER, 'asset-12')

    expect(
      nextToPlay(
        base({ appActive: false, messages: [message], ready: { 'asset-12': '/tmp/a' } }),
      ),
    ).toBeNull()
  })

  it('내가 누군지 모르면 안 튼다', () => {
    const message = voice(HER, 'asset-13')

    expect(
      nextToPlay(
        base({ me: null, messages: [message], ready: { 'asset-13': '/tmp/a' } }),
      ),
    ).toBeNull()
  })
})

describe('켤 때 쌓여 있던 것', () => {
  it('음성만 골라낸다', () => {
    const messages = [text(HER), voice(HER, 'asset-14'), voice(ME, 'asset-15')]

    expect(alreadyThere(messages)).toEqual(new Set(['asset-14', 'asset-15']))
  })

  it('이걸 "이미 튼 것" 으로 치면 안 틀린다', () => {
    // 켜는 순간 예전 음성이 줄줄이 재생되면 못 쓴다.
    const message = voice(HER, 'asset-16')
    const messages = [message]

    expect(
      nextToPlay(
        base({
          messages,
          ready: { 'asset-16': '/tmp/a' },
          played: alreadyThere(messages),
        }),
      ),
    ).toBeNull()
  })
})
