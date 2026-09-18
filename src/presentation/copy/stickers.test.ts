import { describe, expect, it } from 'vitest'
import { stickerPoses } from '@/domain/message/MessageContent'
import { describePose, stickerMeaning } from './stickers'

describe('이모티콘 뜻', () => {
  it.each(stickerPoses)('%s 에 할 말이 붙어 있다', pose => {
    expect(stickerMeaning(pose).length).toBeGreaterThan(0)
  })

  it('두 이모티콘이 같은 말을 하지 않는다', () => {
    // 같은 말이면 둘 중 하나는 있을 이유가 없다.
    const said = stickerPoses.map(stickerMeaning)
    expect(new Set(said).size).toBe(said.length)
  })

  it('자세 이름이 아니라 하고 싶은 말로 적는다', () => {
    // "손 흔들기" 가 아니라 "안녕" 이다. 고르는 사람은 하고 싶은
    // 말을 찾지 자세 이름을 찾지 않는다.
    expect(stickerMeaning('wave')).toBe('안녕')
    expect(stickerMeaning('thumbsUp')).toBe('좋아')
    expect(stickerMeaning('toilet')).toBe('화장실 갈래')
  })

  it.each(stickerPoses)('%s 의 말이 짧다', pose => {
    // 길게 누르는 동안만 보이는 글이다. 한눈에 읽혀야 한다.
    expect(stickerMeaning(pose).length).toBeLessThanOrEqual(8)
  })

  it.each(stickerPoses)('%s 를 화면 읽어주는 기능이 말할 수 있다', pose => {
    expect(describePose(pose)).toContain('이모티콘')
  })
})
