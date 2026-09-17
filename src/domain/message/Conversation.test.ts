import {
  conversationAfterReceiving,
  HER,
  ME,
  makeDraft,
  makeReceived,
  startConversation,
  ulidSequence,
} from '@test/support/factories'
import { describe, expect, it } from 'vitest'
import { conversationLimits } from './Conversation'

describe('메시지 받아들이기', () => {
  it('처음 보는 메시지를 받아들인다', () => {
    const conversation = startConversation()
    const message = makeReceived({ seq: 1 })

    const result = conversation.accept(message)

    expect(result.accepted).toBe(true)
    expect(result.conversation.hasSeen(message.id)).toBe(true)
  })

  it('같은 메시지가 두 번 오면 두 번째를 버린다', () => {
    // 길을 갈아탈 때나 받았다는 답이 유실됐을 때 실제로 생긴다
    const message = makeReceived({ seq: 1 })
    const once = startConversation().accept(message)

    const twice = once.conversation.accept(message)

    expect(twice.accepted).toBe(false)
    expect(twice.conversation.unreadCount).toBe(1)
  })

  it('버려도 대화가 바뀌지 않는다', () => {
    const message = makeReceived({ seq: 1 })
    const once = startConversation().accept(message)

    const twice = once.conversation.accept(message)

    expect(twice.conversation).toBe(once.conversation)
  })

  it('받아들여도 원래 대화는 그대로다', () => {
    const conversation = startConversation()

    conversation.accept(makeReceived({ seq: 1 }))

    expect(conversation.unreadCount).toBe(0)
  })
})

describe('순번의 빈틈 찾기', () => {
  it('빠짐없이 받으면 빈틈이 없다', () => {
    const conversation = conversationAfterReceiving([1, 2, 3, 4])

    expect(conversation.missingSeqs(HER)).toEqual([])
    expect(conversation.hasGaps(HER)).toBe(false)
  })

  it('가운데가 하나 빠지면 그것을 찾아낸다', () => {
    const conversation = conversationAfterReceiving([3, 4, 6])

    expect(conversation.missingSeqs(HER)).toEqual([1, 2, 5])
  })

  it('앞에서부터 통째로 빠진 것도 찾아낸다', () => {
    // 앱을 새로 깔았을 때 이렇게 된다
    const conversation = conversationAfterReceiving([5])

    expect(conversation.missingSeqs(HER)).toEqual([1, 2, 3, 4])
  })

  it('여러 군데가 빠진 것을 전부 찾아낸다', () => {
    const conversation = conversationAfterReceiving([2, 5, 9])

    expect(conversation.missingSeqs(HER)).toEqual([1, 3, 4, 6, 7, 8])
  })

  it('빠졌던 게 나중에 오면 목록에서 지운다', () => {
    const conversation = conversationAfterReceiving([1, 3, 2])

    expect(conversation.missingSeqs(HER)).toEqual([])
  })

  it('순서가 뒤바뀌어 와도 올바로 판단한다', () => {
    const conversation = conversationAfterReceiving([3, 1, 4, 2])

    expect(conversation.missingSeqs(HER)).toEqual([])
    expect(conversation.highestSeqFrom(HER)).toBe(4)
  })

  it('한 번도 못 받은 사람에게는 빈틈이 없다', () => {
    expect(startConversation().missingSeqs(HER)).toEqual([])
    expect(startConversation().highestSeqFrom(HER)).toBe(0)
  })

  it('사람마다 따로 센다', () => {
    const nextId = ulidSequence()
    let conversation = startConversation()
    conversation = conversation.accept(
      makeReceived({ id: nextId(), author: HER, seq: 3 }),
    ).conversation
    conversation = conversation.accept(
      makeDraft({ id: nextId(), author: ME, seq: 1 }),
    ).conversation

    expect(conversation.missingSeqs(HER)).toEqual([1, 2])
    expect(conversation.missingSeqs(ME)).toEqual([])
  })
})

describe('읽지 않은 개수', () => {
  it('상대가 보낸 것만 센다', () => {
    const nextId = ulidSequence()
    let conversation = startConversation()
    conversation = conversation.accept(
      makeReceived({ id: nextId(), seq: 1 }),
    ).conversation
    conversation = conversation.accept(makeDraft({ id: nextId(), seq: 1 })).conversation
    conversation = conversation.accept(
      makeReceived({ id: nextId(), seq: 2 }),
    ).conversation

    expect(conversation.unreadCount).toBe(2)
  })

  it('읽으면 줄어든다', () => {
    const conversation = conversationAfterReceiving([1, 2, 3])

    const read = conversation.markRead(2)

    expect(read.ok && read.value.unreadCount).toBe(1)
  })

  it('있는 것보다 많이 읽었다고 해도 음수가 되지 않는다', () => {
    const conversation = conversationAfterReceiving([1])

    const read = conversation.markRead(5)

    expect(read.ok && read.value.unreadCount).toBe(0)
  })

  it('읽은 개수가 음수면 거절한다', () => {
    const result = conversationAfterReceiving([1]).markRead(-1)

    expect(!result.ok && result.error.code).toBe('invalid-value')
  })

  it('전부 읽으면 0 이 된다', () => {
    const conversation = conversationAfterReceiving([1, 2, 3])

    expect(conversation.markAllRead().unreadCount).toBe(0)
  })
})

describe('내가 쓸 순번', () => {
  it('1부터 시작한다', () => {
    expect(startConversation().nextOutgoingSeq).toBe(1)
  })

  it('쓸 때마다 하나씩 오른다', () => {
    const first = startConversation().takeOutgoingSeq()
    const second = first.conversation.takeOutgoingSeq()

    expect(first.seq).toBe(1)
    expect(second.seq).toBe(2)
    expect(second.conversation.nextOutgoingSeq).toBe(3)
  })

  it('저장소에서 되살린 내 메시지보다 뒤에서 이어간다', () => {
    // 앱을 껐다 켰을 때 순번이 처음으로 돌아가면
    // 상대 쪽에서 중복으로 판단해 메시지를 버린다
    const conversation = startConversation().accept(
      makeDraft({ author: ME, seq: 7 }),
    ).conversation

    expect(conversation.nextOutgoingSeq).toBe(8)
  })

  it('상대 메시지는 내 순번을 건드리지 않는다', () => {
    const conversation = startConversation().accept(
      makeReceived({ author: HER, seq: 9 }),
    ).conversation

    expect(conversation.nextOutgoingSeq).toBe(1)
  })
})

describe('기억할 식별자의 한계', () => {
  it('오래된 것부터 잊는다', () => {
    const nextId = ulidSequence()
    let conversation = startConversation()

    const firstId = nextId()
    conversation = conversation.accept(makeReceived({ id: firstId, seq: 1 })).conversation

    for (let n = 2; n <= conversationLimits.recentIds + 1; n += 1) {
      conversation = conversation.accept(
        makeReceived({ id: nextId(), seq: n }),
      ).conversation
    }

    // 잊은 뒤에 같은 메시지가 또 와도 저장소의 기본 키가 막아준다.
    // 여기서 거르는 건 저장소까지 가지 않으려는 최적화일 뿐이다.
    expect(conversation.hasSeen(firstId)).toBe(false)
  })

  it('최근 것은 기억하고 있다', () => {
    const nextId = ulidSequence()
    let conversation = startConversation()
    let lastId = nextId()

    for (let n = 1; n <= conversationLimits.recentIds + 10; n += 1) {
      lastId = nextId()
      conversation = conversation.accept(
        makeReceived({ id: lastId, seq: n }),
      ).conversation
    }

    expect(conversation.hasSeen(lastId)).toBe(true)
  })
})
