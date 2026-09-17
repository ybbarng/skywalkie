import {
  HER,
  ME,
  makeDraft,
  makeReceived,
  makeText,
  makeUlid,
} from '@test/support/factories'
import { describe, expect, it } from 'vitest'
import { Message } from './Message'
import { nudgeContent } from './MessageContent'

describe('메시지 만들기', () => {
  it('내가 쓴 메시지는 아직 보내지 않은 상태로 태어난다', () => {
    const message = makeDraft()

    expect(message.delivery).toBe('draft')
    expect(message.receivedAt).toBeNull()
  })

  it('받은 메시지는 도착한 상태로 태어난다', () => {
    const message = makeReceived()

    expect(message.delivery).toBe('delivered')
    expect(message.receivedAt).not.toBeNull()
  })

  it.each([
    ['0 이면', 0],
    ['음수면', -1],
    ['소수면', 1.5],
    ['숫자가 아니면', Number.NaN],
  ])('순번이 %s 메시지가 태어나지 않는다', (_label, seq) => {
    const result = Message.draft({
      id: makeUlid(1758000000000),
      author: ME,
      content: makeText('안녕'),
      seq,
      now: new Date(1758000000000),
    })

    expect(!result.ok && result.error.field).toBe('seq')
  })

  it('시각이 올바르지 않으면 메시지가 태어나지 않는다', () => {
    const result = Message.draft({
      id: makeUlid(1758000000000),
      author: ME,
      content: makeText('안녕'),
      seq: 1,
      now: new Date('말도 안 되는 날짜'),
    })

    expect(!result.ok && result.error.field).toBe('sentAt')
  })

  it('받은 시각이 올바르지 않으면 메시지가 태어나지 않는다', () => {
    const result = Message.compose({
      id: makeUlid(1758000000000),
      author: HER,
      content: makeText('안녕'),
      sentAt: new Date(1758000000000),
      receivedAt: new Date('말도 안 되는 날짜'),
      seq: 1,
      delivery: 'delivered',
    })

    expect(!result.ok && result.error.field).toBe('receivedAt')
  })

  it('순번이 다룰 수 없을 만큼 크면 거절한다', () => {
    const result = Message.draft({
      id: makeUlid(1758000000000),
      author: ME,
      content: makeText('안녕'),
      seq: Number.MAX_SAFE_INTEGER + 10,
      now: new Date(1758000000000),
    })

    expect(!result.ok && result.error.field).toBe('seq')
  })
})

describe('받은 시각 채우기', () => {
  it('저장소에서 꺼낸 메시지에 받은 시각을 채운다', () => {
    const message = makeDraft()

    const filled = message.withReceivedAt(new Date(1758000009000))

    expect(filled.ok && filled.value.receivedAt?.getTime()).toBe(1758000009000)
  })

  it('나머지 값은 그대로 남는다', () => {
    const message = makeDraft({ content: makeText('창밖 봐') })

    const filled = message.withReceivedAt(new Date(1758000009000))

    expect(filled.ok && filled.value.id).toBe(message.id)
    expect(filled.ok && filled.value.delivery).toBe(message.delivery)
  })

  it('올바르지 않은 시각은 거절한다', () => {
    const result = makeDraft().withReceivedAt(new Date('말도 안 되는 날짜'))

    expect(!result.ok && result.error.field).toBe('receivedAt')
  })
})

describe('상태 옮기기', () => {
  it('보내고 도착하고 읽히는 흐름이 이어진다', () => {
    const draft = makeDraft()

    const sending = draft.markSending()
    const delivered = sending.ok ? sending.value.markDelivered() : sending
    const read = delivered.ok ? delivered.value.markRead() : delivered

    expect(read.ok && read.value.delivery).toBe('read')
  })

  it('읽은 메시지를 도착으로 되돌릴 수 없다', () => {
    const read = makeReceived().markRead()
    if (!read.ok) throw new Error('앞선 단계가 실패했다')

    const back = read.value.markDelivered()

    expect(!back.ok && back.error.code).toBe('invalid-transition')
  })

  it('상태를 옮겨도 원래 메시지는 그대로다', () => {
    const draft = makeDraft()

    draft.markSending()

    expect(draft.delivery).toBe('draft')
  })

  it('옮기면 내용과 식별자는 그대로 남는다', () => {
    const draft = makeDraft({ content: makeText('기내식 뭐 나왔어?') })

    const sending = draft.markSending()

    expect(sending.ok && sending.value.id).toBe(draft.id)
    expect(sending.ok && sending.value.content).toEqual(draft.content)
    expect(sending.ok && sending.value.seq).toBe(draft.seq)
  })

  it('실패한 메시지를 다시 보내면 대기 줄로 돌아간다', () => {
    const sending = makeDraft().markSending()
    if (!sending.ok) throw new Error('앞선 단계가 실패했다')
    const failed = sending.value.markFailed()
    if (!failed.ok) throw new Error('앞선 단계가 실패했다')

    const retried = failed.value.retry()

    expect(retried.ok && retried.value.delivery).toBe('pending')
  })
})

describe('누가 쓴 메시지인가', () => {
  it('내가 쓴 것을 알아본다', () => {
    const mine = makeDraft({ author: ME })
    const hers = makeReceived({ author: HER })

    expect(mine.isMine(ME)).toBe(true)
    expect(hers.isMine(ME)).toBe(false)
  })
})

describe('줄 세우는 시각', () => {
  it('받은 메시지는 받은 시각으로 줄 세운다', () => {
    // 두 폰의 시계가 다를 수 있다. 특히 시차를 넘는 비행에서는
    // 한쪽이 먼저 시간대를 바꾼다. 내 기기에서 본 순서가 흐트러지면 안 된다.
    const message = makeReceived({
      sentAt: new Date(1758000000000),
      now: new Date(1758000003000),
    })

    expect(message.orderedAt().getTime()).toBe(1758000003000)
  })

  it('내가 보낸 메시지는 보낸 시각으로 줄 세운다', () => {
    const message = makeDraft({ now: new Date(1758000000000) })

    expect(message.orderedAt().getTime()).toBe(1758000000000)
  })

  it('두 폰의 시계가 얼마나 어긋났는지 잰다', () => {
    const message = makeReceived({
      sentAt: new Date(1758000000000),
      now: new Date(1758000002500),
    })

    expect(message.clockSkewMillis()).toBe(2500)
  })

  it('상대 폰이 앞서 있으면 어긋남이 음수로 나온다', () => {
    // 시차를 넘는 비행에서 실제로 생긴다
    const message = makeReceived({
      sentAt: new Date(1758000005000),
      now: new Date(1758000000000),
    })

    expect(message.clockSkewMillis()).toBe(-5000)
  })

  it('내가 보낸 메시지에는 어긋남이 없다', () => {
    expect(makeDraft().clockSkewMillis()).toBe(0)
  })
})

describe('연결을 기다리는 메시지', () => {
  it('아직 안 보낸 것과 대기 중인 것을 골라낸다', () => {
    const draft = makeDraft()
    const pending = draft.markPending()
    const received = makeReceived()

    expect(draft.isWaitingToSend()).toBe(true)
    expect(pending.ok && pending.value.isWaitingToSend()).toBe(true)
    expect(received.isWaitingToSend()).toBe(false)
  })

  it('상대에게 닿았는지 알려준다', () => {
    const delivered = makeReceived()
    const read = delivered.markRead()

    expect(delivered.hasReachedPeer()).toBe(true)
    expect(read.ok && read.value.hasReachedPeer()).toBe(true)
    expect(makeDraft().hasReachedPeer()).toBe(false)
  })
})

describe('콕 찌르기', () => {
  it('내용 없이도 메시지가 된다', () => {
    const message = makeDraft({ content: nudgeContent() })

    expect(message.content.kind).toBe('nudge')
  })
})
