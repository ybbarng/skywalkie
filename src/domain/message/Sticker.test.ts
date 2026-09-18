import { describe, expect, it } from 'vitest'
import {
  fitsNarrowLink,
  isFromPerson,
  stickerContent,
  stickerPoses,
} from './MessageContent'

/**
 * 캐릭터 이모티콘.
 *
 * **그림을 나르지 않는다.** 누가 어떤 자세인지만 담긴다. 그래서
 * 좁은 길로도 즉시 가고, 화면 크기가 달라도 선명하다.
 */

describe('이모티콘 만들기', () => {
  it.each(stickerPoses)('%s 자세를 받아들인다', pose => {
    const result = stickerContent('aria', pose)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toEqual({ kind: 'sticker', character: 'aria', pose })
  })

  it('모르는 자세는 거절한다', () => {
    const result = stickerContent('aria', 'backflip')

    expect(result.ok).toBe(false)
  })

  it('캐릭터가 없으면 거절한다', () => {
    const result = stickerContent('', 'wave')

    expect(result.ok).toBe(false)
  })

  it('모르는 캐릭터여도 받아들인다', () => {
    // **상대가 새 버전이라 우리가 모르는 캐릭터를 쓸 수 있다.**
    // 여기서 막으면 그 사람이 보낸 이모티콘이 통째로 안 온다.
    const result = stickerContent('새로운캐릭터', 'wave')

    expect(result.ok).toBe(true)
  })
})

describe('이모티콘은', () => {
  it('사람이 보낸 것이다', () => {
    // 읽음 표시가 붙어야 한다. 앱이 끼워 넣는 알림과 다르다.
    const sticker = stickerContent('aria', 'heart')
    if (!sticker.ok) throw new Error('만들지 못했다')

    expect(isFromPerson(sticker.value)).toBe(true)
  })

  it('좁은 길로도 간다', () => {
    // 자세 이름만 담겨 몇십 바이트다. 낙서와 달리 기다릴 이유가 없다.
    const sticker = stickerContent('aria', 'wave')
    if (!sticker.ok) throw new Error('만들지 못했다')

    expect(fitsNarrowLink(sticker.value)).toBe(true)
  })
})

describe('자세 목록', () => {
  it('비행기에서 쓸 만한 것들이 들어 있다', () => {
    // 기내식이 나왔을 때, 심심할 때, 자고 싶을 때가 실제로 자주 온다
    expect(stickerPoses).toContain('eat')
    expect(stickerPoses).toContain('bored')
    expect(stickerPoses).toContain('sleep')
  })

  it('말 대신 쓸 감정이 들어 있다', () => {
    // 세 시간 동안 말을 못 한다. **글보다 빠르고 오해가 적다.**
    for (const feeling of ['angry', 'surprised', 'shy', 'sorry'] as const) {
      expect(stickerPoses).toContain(feeling)
    }
  })

  it('두어 번 밀어 다 볼 만큼만 둔다', () => {
    // 두 줄로 놓고 옆으로 민다. 한 줄에 네댓 개가 보이니 두어 번
    // 밀면 끝이다. 더 많으면 고르다 지쳐 글로 쓰는 게 빨라진다.
    expect(stickerPoses.length).toBeLessThanOrEqual(32)
  })

  it('몸 상태를 알릴 수 있다', () => {
    // 말을 못 하니 "배고파" 한마디도 글로 쳐야 한다.
    for (const state of ['hungry', 'toilet', 'cold', 'hot', 'sleep'] as const) {
      expect(stickerPoses).toContain(state)
    }
  })

  it('같은 자세가 두 번 들어 있지 않다', () => {
    expect(new Set(stickerPoses).size).toBe(stickerPoses.length)
  })
})
