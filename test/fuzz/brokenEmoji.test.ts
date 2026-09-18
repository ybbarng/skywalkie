import { describe, expect, it } from 'vitest'
import { sha256Hex, utf8Bytes } from '@/infrastructure/archive/Sha256'
import {
  cutAt,
  formatResponse,
  json,
  readText,
  takeUtf8,
  utf8Length,
} from '@/infrastructure/transport/web/httpProtocol'

/**
 * 반쪽만 남은 이모지.
 *
 * ## 어쩌다 생기나
 *
 * 이모지는 두 칸을 차지한다. **글을 자를 때 그 사이에서 자르면**
 * 반쪽만 남는다. 우리는 실제로 자른다. 웹 채팅에서 너무 긴 글을
 * 4000자로 막기 때문이다.
 *
 * ## 왜 위험한가
 *
 * 반쪽을 그대로 바이트로 만들면 표준과 다른 값이 나온다.
 *
 *   · 웹 채팅 — 길이가 어긋나 **사파리가 답을 끝까지 못 읽고 멈춘다**
 *   · 꺼내둔 파일 — 요약값이 어긋나 **멀쩡한 파일을 거절한다**
 *
 * 둘 다 조용히 일어난다. 오류가 안 뜬다.
 *
 * 마구잡이 시험이 이걸 잡았다. 다시 생기지 않게 여기 못박아 둔다.
 */

/** 이모지의 앞쪽 반쪽만. 🛫 를 가운데서 자른 모습 */
const HALF = '🛫'.slice(0, 1)
/** 뒤쪽 반쪽만 */
const TAIL = '🛫'.slice(1)

describe('반쪽만 남은 이모지를', () => {
  it.each([
    ['앞쪽 반쪽', HALF],
    ['뒤쪽 반쪽', TAIL],
    ['앞뒤에 글이 섞인 것', `안녕${HALF}`],
    ['반쪽이 여럿', `${HALF}${HALF}${TAIL}`],
  ])('%s 을 Node 와 같게 센다', (_label, text) => {
    expect(utf8Length(text)).toBe(Buffer.byteLength(text, 'utf8'))
  })

  it.each([
    ['앞쪽 반쪽', HALF],
    ['뒤쪽 반쪽', TAIL],
    ['앞뒤에 글이 섞인 것', `안녕${HALF}세요`],
  ])('%s 을 Node 와 같게 바이트로 바꾼다', (_label, text) => {
    expect(Array.from(utf8Bytes(text))).toEqual(Array.from(Buffer.from(text, 'utf8')))
  })

  it('요약값도 Node 와 같다', () => {
    const { createHash } = require('node:crypto')
    const text = `대화${HALF}`

    expect(sha256Hex(text)).toBe(createHash('sha256').update(text, 'utf8').digest('hex'))
  })

  it('물음표 글자 세 바이트로 바꾼다', () => {
    // 표준이 정한 방식이다. EF BF BD
    expect(Array.from(utf8Bytes(HALF))).toEqual([0xef, 0xbf, 0xbd])
  })
})

describe('멀쩡한 이모지는', () => {
  it('네 바이트 그대로다', () => {
    expect(utf8Length('🛫')).toBe(4)
    expect(Array.from(utf8Bytes('🛫'))).toEqual([0xf0, 0x9f, 0x9b, 0xab])
  })

  it('여럿이 이어져도 그대로다', () => {
    const text = '🛫🛬✈️😀'

    expect(utf8Length(text)).toBe(Buffer.byteLength(text, 'utf8'))
  })
})

describe('글을 자를 때', () => {
  it('이모지 한가운데서 자르지 않는다', () => {
    // **여기가 이 버그가 실제로 생기던 자리다**
    const text = `${'가'.repeat(9)}🛫`

    const cut = cutAt(text, 10)

    // 10번째 자리가 이모지의 앞쪽 반쪽이라 한 칸 덜 자른다
    expect(cut).toBe('가'.repeat(9))
    expect(utf8Length(cut)).toBe(Buffer.byteLength(cut, 'utf8'))
  })

  it('이모지가 통째로 들어가면 그대로 둔다', () => {
    const text = `${'가'.repeat(8)}🛫`

    expect(cutAt(text, 10)).toBe(text)
  })

  it('짧으면 안 자른다', () => {
    expect(cutAt('안녕', 100)).toBe('안녕')
  })

  it('보낸 글이 아무리 길어도 반쪽이 안 남는다', () => {
    // 이모지로만 4000자를 넘겨본다. 자르는 자리가 이모지 사이가 된다.
    const long = JSON.stringify({ text: '🛫'.repeat(5000) })

    const cut = readText(long)

    expect(cut).not.toBeNull()
    if (cut === null) return
    expect(utf8Length(cut)).toBe(Buffer.byteLength(cut, 'utf8'))
  })
})

describe('요청 본문을 바이트 수로 자를 때', () => {
  it('이모지 한가운데서 자르지 않는다', () => {
    // 본문이 한 바이트 모자라게 왔을 때 이 자리가 쓰인다
    const text = '🛫🛫'

    // 한 이모지가 4바이트다. 6바이트만 넣으면 두 번째가 반만 들어간다.
    const cut = takeUtf8(text, 6)

    expect(cut).toBe('🛫')
    expect(utf8Length(cut)).toBe(Buffer.byteLength(cut, 'utf8'))
  })

  it('딱 맞으면 다 가져온다', () => {
    expect(takeUtf8('🛫🛫', 8)).toBe('🛫🛫')
  })

  it('한글도 쪼개지 않는다', () => {
    // 한글 한 글자가 세 바이트다
    expect(takeUtf8('가나', 4)).toBe('가')
  })

  it('0 이면 빈 글이다', () => {
    expect(takeUtf8('안녕', 0)).toBe('')
  })
})

describe('사파리에게 답할 때', () => {
  it('반쪽이 섞여도 길이가 맞는다', () => {
    // **길이가 틀리면 사파리가 답을 끝까지 못 읽고 멈춘다.**
    // 오류도 안 뜬다. 그냥 영영 기다린다.
    const response = formatResponse(json({ text: `안녕${HALF}` }))

    const declared = Number(/Content-Length: (\d+)/.exec(response)?.[1])
    const body = response.slice(response.indexOf('\r\n\r\n') + 4)

    expect(declared).toBe(Buffer.byteLength(body, 'utf8'))
  })
})
