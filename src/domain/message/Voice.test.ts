import { describe, expect, it } from 'vitest'
import { fitsNarrowLink, MAX_VOICE_MS, voiceContent } from './MessageContent'

const good = {
  assetId: '01JBQZ8K4M7N2P5R8T1V3W6Y9Z',
  durationMs: 12_000,
  byteLength: 48_000,
}

describe('음성 메시지 만들기', () => {
  it('길이와 크기를 담는다', () => {
    const result = voiceContent(good)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.kind).toBe('voice')
    expect(result.value.durationMs).toBe(12_000)
    expect(result.value.byteLength).toBe(48_000)
  })

  it('소수점은 없앤다', () => {
    // 잰 시각을 그대로 넣으면 12345.67 같은 값이 온다.
    const result = voiceContent({ ...good, durationMs: 12_345.67 })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.durationMs).toBe(12_346)
  })
})

describe('보낼 수 없는 것', () => {
  it('번호가 없으면 거절한다', () => {
    expect(voiceContent({ ...good, assetId: '' }).ok).toBe(false)
  })

  it('빈 소리는 거절한다', () => {
    expect(voiceContent({ ...good, byteLength: 0 }).ok).toBe(false)
  })

  it('너무 짧으면 거절한다', () => {
    // 손가락이 미끄러진 것이다. 빈 소리를 보내면 상대가 눌러보고
    // 아무것도 안 들려 당황한다.
    expect(voiceContent({ ...good, durationMs: 200 }).ok).toBe(false)
  })

  it('너무 길면 거절한다', () => {
    expect(voiceContent({ ...good, durationMs: MAX_VOICE_MS + 1 }).ok).toBe(false)
  })

  it('한 번에 1분까지다', () => {
    // 더 길면 조각이 너무 많아져 그동안 글이 밀린다.
    expect(MAX_VOICE_MS).toBe(60_000)
    expect(voiceContent({ ...good, durationMs: MAX_VOICE_MS }).ok).toBe(true)
  })
})

describe('좁은 길로는 안 보낸다', () => {
  it('블루투스로는 기다린다', () => {
    // 몇십 킬로바이트라 좁은 길에서는 글을 통째로 막는다.
    const result = voiceContent(good)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(fitsNarrowLink(result.value)).toBe(false)
  })
})
