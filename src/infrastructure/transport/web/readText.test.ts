import { describe, expect, it } from 'vitest'
import { MAX_TEXT_LENGTH } from '@/domain/message/MessageContent'
import { chatPage } from './client/page'
import { readText } from './httpProtocol'

/**
 * 웹에서 보내온 글.
 *
 * **사파리에서 오는 것을 믿지 않는다.** 같은 Wi-Fi 에 붙은 다른
 * 사람이 아무거나 보낼 수도 있고, 우리가 만든 화면이 아닐 수도 있다.
 */

describe('보낸 글 읽기', () => {
  it('제대로 된 것을 읽는다', () => {
    expect(readText('{"text":"34열 창가야"}')).toBe('34열 창가야')
  })

  it('앞뒤 빈칸을 턴다', () => {
    expect(readText('{"text":"  안녕  "}')).toBe('안녕')
  })

  it('빈 글은 안 받는다', () => {
    expect(readText('{"text":"   "}')).toBeNull()
    expect(readText('{"text":""}')).toBeNull()
  })

  it('글이 아니면 안 받는다', () => {
    expect(readText('{"text":123}')).toBeNull()
    expect(readText('{"text":null}')).toBeNull()
    expect(readText('{}')).toBeNull()
  })

  it('JSON 이 아니면 터지지 않는다', () => {
    expect(readText('그냥 글')).toBeNull()
    expect(readText('')).toBeNull()
  })

  it('너무 긴 글은 잘라낸다', () => {
    // 막지 않으면 사설망이 통째로 막힌다
    const long = 'ㅋ'.repeat(10_000)

    expect(readText(JSON.stringify({ text: long }))?.length).toBeLessThanOrEqual(
      MAX_TEXT_LENGTH,
    )
  })
})

describe('비상용 화면', () => {
  it('바깥에서 아무것도 불러오지 않는다', () => {
    // **비행기에 인터넷이 없다.** 밖에서 가져오게 해두면 전부 빈칸이 된다.
    const page = chatPage('지민')

    expect(page).not.toContain('http://')
    expect(page).not.toContain('https://')
    expect(page).not.toContain('//cdn')
  })

  it('한 장에 다 들어 있다', () => {
    const page = chatPage('지민')

    expect(page).toContain('<style>')
    expect(page).toContain('<script>')
    expect(page).not.toContain('<link')
  })

  it('밝은 화면과 어두운 화면을 둘 다 그린다', () => {
    expect(chatPage('지민')).toContain('prefers-color-scheme:dark')
  })

  it('상대 이름을 띄운다', () => {
    expect(chatPage('지민')).toContain('지민')
  })

  it('이름에 꺾쇠가 있어도 화면이 안 깨진다', () => {
    const page = chatPage('<script>alert(1)</script>')

    expect(page).not.toContain('<script>alert(1)')
    expect(page).toContain('&lt;script&gt;')
  })
})
