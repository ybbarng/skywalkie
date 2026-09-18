import { FakeClock } from '@test/fakes/FakeClock'
import { FakeMessageTransport } from '@test/fakes/FakeMessageTransport'
import { FakeAudioSession, FakeVoiceLink } from '@test/fakes/FakeVoiceLink'
import { beforeEach, describe, expect, it } from 'vitest'
import { CONNECT_TIMEOUT_MS, RING_TIMEOUT_MS } from '@/domain/call/CallState'
import { CallSession } from './CallSession'

/**
 * 통화 한 판.
 *
 * 여기서 나올 수 있는 가장 나쁜 일 두 가지를 집중해서 본다.
 *
 *   1. **마이크가 열린 채로 남는 것** — 대화가 새어나간다
 *   2. **통화가 메시지를 끊는 것** — 이 앱의 존재 이유가 사라진다
 */

/** 줄 세워 도는 일이 다 끝나기를 기다린다 */
async function flush(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await new Promise(resolve => setTimeout(resolve, 0))
}

describe('통화', () => {
  let transport: FakeMessageTransport
  let voice: FakeVoiceLink
  let audio: FakeAudioSession
  let clock: FakeClock
  let session: CallSession
  let counter: number

  beforeEach(() => {
    transport = new FakeMessageTransport()
    voice = new FakeVoiceLink()
    audio = new FakeAudioSession()
    clock = new FakeClock()
    counter = 0
    session = new CallSession({
      transport,
      voice,
      audio,
      clock,
      nextId: () => {
        counter += 1
        return `id-${counter}`
      },
    })
  })

  function signalsOfKind(kind: string) {
    return transport
      .sentOfType('call_signal')
      .filter(envelope => envelope.p.kind === kind)
  }

  describe('내가 걸 때', () => {
    it('offer 를 보낸다', async () => {
      const result = await session.start('voice')

      expect(result.ok).toBe(true)
      expect(session.current().phase).toBe('calling')
      expect(signalsOfKind('offer')).toHaveLength(1)
    })

    it('소리만인지 영상까지인지 알려준다', async () => {
      // 안 붙이면 받는 쪽이 소리로 받아서, 영상을 걸었는데 소리만 된다
      await session.start('video')

      expect(signalsOfKind('offer')[0]?.p.media).toBe('video')
    })

    it('상대가 받으면 길을 트기 시작한다', async () => {
      await session.start('voice')

      await session.receiveAnswer({ kind: 'answer', sdp: 'v=0' })

      expect(session.current().phase).toBe('connecting')
    })

    it('소리가 흐르면 통화 중이 된다', async () => {
      await session.start('voice')
      await session.receiveAnswer({ kind: 'answer', sdp: 'v=0' })

      voice.emitState('connected')
      await flush()

      expect(session.current().phase).toBe('active')
    })
  })

  describe('상대가 걸어올 때', () => {
    it('바로 마이크를 열지 않는다', async () => {
      // **받기 전에 열면 상대가 내 쪽 소리를 먼저 듣는다**
      await session.receiveOffer({ kind: 'offer', sdp: 'v=0' })

      expect(session.current().phase).toBe('ringing')
      expect(voice.micEnabled).toBe(false)
      expect(audio.activeCount).toBe(0)
    })

    it('받겠다고 눌러야 answer 를 보낸다', async () => {
      await session.receiveOffer({ kind: 'offer', sdp: 'v=0' })
      expect(signalsOfKind('answer')).toHaveLength(0)

      await session.accept()

      expect(signalsOfKind('answer')).toHaveLength(1)
      expect(session.current().phase).toBe('connecting')
    })

    it('영상 통화로 걸어온 것을 알아본다', async () => {
      await session.receiveOffer({ kind: 'offer', sdp: 'v=0', media: 'video' })

      expect(session.current().kind).toBe('video')
    })

    it('media 가 없으면 소리로 본다', async () => {
      // 예전 버전이 보낸 봉투다. 여기서 멈추면 통화가 아예 안 된다.
      await session.receiveOffer({ kind: 'offer', sdp: 'v=0' })

      expect(session.current().kind).toBe('voice')
      expect(session.current().phase).toBe('ringing')
    })

    it('이미 통화 중이면 거절을 보낸다', async () => {
      // **상대를 하염없이 기다리게 두지 않는다**
      await session.start('voice')

      await session.receiveOffer({ kind: 'offer', sdp: 'v=0' })

      expect(signalsOfKind('decline')).toHaveLength(1)
    })
  })

  describe('통화 모듈이 없을 때', () => {
    beforeEach(() => {
      voice.available = false
    })

    it('걸려고 하면 못 한다고 답한다', async () => {
      const result = await session.start('voice')

      expect(result.ok).toBe(false)
      expect(session.current().endReason).toBe('unsupported')
    })

    it('걸려오면 바로 거절을 보낸다', async () => {
      // 아무 답이 없으면 상대는 30초를 기다린다
      await session.receiveOffer({ kind: 'offer', sdp: 'v=0' })

      expect(signalsOfKind('decline')).toHaveLength(1)
      expect(session.current().isBusy()).toBe(false)
    })

    it('메시지 길은 그대로다', async () => {
      // **이 앱의 존재 이유가 메시지다.** 통화가 안 된다고 건드리면 안 된다.
      await session.start('voice')
      await session.receiveOffer({ kind: 'offer', sdp: 'v=0' })

      expect(transport.disconnectCount).toBe(0)
    })
  })

  describe('끝내기', () => {
    async function goActive() {
      await session.receiveOffer({ kind: 'offer', sdp: 'v=0' })
      await session.accept()
      voice.emitState('connected')
      await flush()
    }

    it('마이크와 소리 길을 되돌린다', async () => {
      await goActive()
      session.setMicrophoneEnabled(true)
      expect(voice.micEnabled).toBe(true)

      await session.end()

      expect(voice.micEnabled).toBe(false)
      expect(voice.closeCount).toBe(1)
      expect(audio.deactivateCount).toBe(1)
    })

    it('두 번 눌러도 안전하다', async () => {
      // 사람은 안 끊기는 것 같으면 또 누른다
      await goActive()

      await session.end()
      await session.end()

      expect(voice.closeCount).toBe(1)
      expect(session.current().endReason).toBe('hung-up')
    })

    it('아무도 안 듣게 정리한다', async () => {
      // 안 떼면 다음 통화에서 두 번씩 처리된다
      await goActive()

      await session.end()

      expect(voice.hasListeners()).toBe(false)
    })

    it('벨이 울리는 중에 끊어도 정리된다', async () => {
      await session.receiveOffer({ kind: 'offer', sdp: 'v=0' })

      await session.end('declined')

      expect(session.current().phase).toBe('ended')
      expect(voice.micEnabled).toBe(false)
    })

    it('상대가 끊으면 이유를 남긴다', async () => {
      await goActive()

      await session.receiveHangup(false)

      expect(session.current().endReason).toBe('peer-hung-up')
      expect(voice.closeCount).toBe(1)
    })

    it('상대가 거절한 것과 끊은 것을 가른다', async () => {
      await session.start('voice')

      await session.receiveHangup(true)

      expect(session.current().endReason).toBe('declined')
    })

    it('길이 끊기면 알아서 정리한다', async () => {
      await goActive()

      voice.emitState('failed')
      await flush()

      expect(session.current().phase).toBe('ended')
      expect(voice.micEnabled).toBe(false)
    })
  })

  describe('마이크는', () => {
    it('통화 중이 아니면 안 열린다', () => {
      // **여기가 새면 통화도 아닌데 소리가 나간다**
      const result = session.setMicrophoneEnabled(true)

      expect(result.ok).toBe(false)
      expect(voice.micEnabled).toBe(false)
    })

    it('벨이 울리는 중에도 안 열린다', async () => {
      await session.receiveOffer({ kind: 'offer', sdp: 'v=0' })

      expect(session.setMicrophoneEnabled(true).ok).toBe(false)
    })

    it('끝난 뒤에도 안 열린다', async () => {
      await session.receiveOffer({ kind: 'offer', sdp: 'v=0' })
      await session.accept()
      await session.end()

      expect(session.setMicrophoneEnabled(true).ok).toBe(false)
    })

    it('끄는 것은 언제나 된다', () => {
      // 막으면 마이크가 열린 채로 남는 길이 생긴다
      expect(session.setMicrophoneEnabled(false).ok).toBe(true)
    })

    it('이어폰이 빠지면 즉시 꺼진다', async () => {
      // 스피커로 대화 내용이 새어나가는 걸 막는다
      await session.receiveOffer({ kind: 'offer', sdp: 'v=0' })
      await session.accept()
      voice.emitState('connected')
      await flush()
      session.setMicrophoneEnabled(true)

      session.onHeadphonesUnplugged()

      expect(voice.micEnabled).toBe(false)
    })
  })

  describe('길을 트지 못하면', () => {
    it('통화를 접고 이유를 남긴다', async () => {
      voice.failOffer = true

      const result = await session.start('voice')

      expect(result.ok).toBe(false)
      expect(session.current().phase).toBe('ended')
      expect(session.current().endReason).toBe('failed')
    })

    it('소리 설정에 실패해도 통화는 이어간다', async () => {
      // 여기서 멈추면 "소리가 좀 이상한 통화"가 아니라 "통화 없음"이 된다
      audio.failActivate = true

      const result = await session.start('voice')

      expect(result.ok).toBe(true)
      expect(session.current().phase).toBe('calling')
    })
  })

  describe('기다리다 포기하기', () => {
    it('아무도 안 받으면 끊는다', async () => {
      await session.start('voice')

      clock.advance(RING_TIMEOUT_MS)
      await session.checkTimeout()

      expect(session.current().endReason).toBe('unanswered')
      expect(voice.closeCount).toBe(1)
    })

    it('길이 안 트이면 더 빨리 끊는다', async () => {
      await session.receiveOffer({ kind: 'offer', sdp: 'v=0' })
      await session.accept()

      clock.advance(CONNECT_TIMEOUT_MS)
      await session.checkTimeout()

      expect(session.current().endReason).toBe('failed')
    })

    it('아직 시간이 남았으면 그대로 둔다', async () => {
      await session.start('voice')

      clock.advance(RING_TIMEOUT_MS - 1000)
      await session.checkTimeout()

      expect(session.current().phase).toBe('calling')
    })
  })

  describe('주소 후보는', () => {
    it('생기는 대로 상대에게 보낸다', async () => {
      await session.start('voice')

      voice.emitCandidate({ kind: 'candidate', candidate: 'candidate:1 ...' })

      expect(signalsOfKind('candidate')).toHaveLength(1)
    })

    it('통화 중이 아닐 때 오면 버린다', async () => {
      // 끊긴 뒤에 늦게 오는 게 정상이다. 오류로 보지 않는다.
      const result = await session.receiveCandidate({ kind: 'candidate' })

      expect(result.ok).toBe(true)
      expect(voice.addedCandidates).toHaveLength(0)
    })
  })

  describe('통화 신호를 못 보내도', () => {
    it('메시지 길을 끊지 않는다', async () => {
      // 신호가 안 가면 시간이 다 되어 끝난다. 그게 전부여야 한다.
      transport.failCount = -1

      const result = await session.start('voice')

      expect(result.ok).toBe(true)
      expect(transport.disconnectCount).toBe(0)
    })
  })
})
