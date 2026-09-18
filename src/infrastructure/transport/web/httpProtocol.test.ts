import { describe, expect, it } from 'vitest'
import {
  formatResponse,
  html,
  json,
  parseQuery,
  parseRequest,
  utf8Length,
} from './httpProtocol'

/**
 * 아주 작은 HTTP.
 *
 * **아이폰 앱이 만료돼도 대화할 수 있는 마지막 길이다.** 여기가
 * 어긋나면 사파리가 빈 화면을 띄우고, 그러면 손쓸 방법이 없다.
 */

function request(head: string, body = ''): string {
  const length = utf8Length(body)
  return `${head}\r\nContent-Length: ${length}\r\n\r\n${body}`
}

describe('요청 읽기', () => {
  it('간단한 요청을 읽는다', () => {
    const parsed = parseRequest(request('GET / HTTP/1.1\r\nHost: 192.168.43.1'))

    expect(parsed?.method).toBe('GET')
    expect(parsed?.path).toBe('/')
  })

  it('물음표 뒤를 갈라낸다', () => {
    const parsed = parseRequest(request('GET /messages?since=1758000000000 HTTP/1.1'))

    expect(parsed?.path).toBe('/messages')
    expect(parsed?.query.since).toBe('1758000000000')
  })

  it('본문을 읽는다', () => {
    const parsed = parseRequest(request('POST /send HTTP/1.1', '{"text":"34열 창가야"}'))

    expect(parsed?.method).toBe('POST')
    expect(parsed?.body).toBe('{"text":"34열 창가야"}')
  })

  describe('다 안 왔을 때', () => {
    it('머리말이 안 끝났으면 기다린다', () => {
      // **여기서 섣불리 답하면** 잘린 요청에 엉뚱한 답을 보낸다
      expect(parseRequest('GET / HTTP/1.1\r\nHost: 192')).toBeNull()
    })

    it('본문이 덜 왔으면 기다린다', () => {
      const raw = 'POST /send HTTP/1.1\r\nContent-Length: 40\r\n\r\n{"text":"짧'

      expect(parseRequest(raw)).toBeNull()
    })

    it('본문이 다 오면 읽는다', () => {
      const body = '{"text":"안녕"}'
      const raw = `POST /send HTTP/1.1\r\nContent-Length: ${utf8Length(body)}\r\n\r\n${body}`

      expect(parseRequest(raw)?.body).toBe(body)
    })
  })

  it('머리말 이름의 대소문자를 가리지 않는다', () => {
    // 브라우저마다 다르게 적는다
    const body = 'abc'
    const raw = `POST /send HTTP/1.1\r\ncontent-length: 3\r\n\r\n${body}`

    expect(parseRequest(raw)?.body).toBe('abc')
  })

  it('망가진 요청은 거절한다', () => {
    expect(parseRequest('\r\n\r\n')).toBeNull()
    expect(parseRequest('GET\r\n\r\n')).toBeNull()
  })
})

describe('물음표 뒤 읽기', () => {
  it('여러 개를 가른다', () => {
    expect(parseQuery('a=1&b=2')).toEqual({ a: '1', b: '2' })
  })

  it('한글을 되돌린다', () => {
    expect(parseQuery('name=%EC%A7%80%EB%AF%BC')).toEqual({ name: '지민' })
  })

  it('더하기를 빈칸으로 본다', () => {
    expect(parseQuery('q=hello+world')).toEqual({ q: 'hello world' })
  })

  it('값이 없어도 터지지 않는다', () => {
    expect(parseQuery('flag')).toEqual({ flag: '' })
  })

  it('망가진 글자에도 터지지 않는다', () => {
    expect(() => parseQuery('a=%ZZ')).not.toThrow()
  })
})

describe('답 만들기', () => {
  it('길이를 바이트로 센다', () => {
    // **한글은 한 글자가 세 바이트다.** 글자 수로 세면 사파리가
    // 답을 끝까지 못 읽고 하염없이 기다린다.
    const response = formatResponse(json({ text: '안녕' }))

    const declared = Number(/Content-Length: (\d+)/.exec(response)?.[1])
    const body = response.slice(response.indexOf('\r\n\r\n') + 4)

    expect(declared).toBe(utf8Length(body))
    expect(declared).toBeGreaterThan(body.length)
  })

  it('옛 화면이 뜨지 않게 한다', () => {
    // 인터넷이 없으니 캐시가 도움이 안 된다
    expect(formatResponse(html('<p>안녕</p>'))).toContain('Cache-Control: no-store')
  })

  it('머리말과 본문을 빈 줄로 가른다', () => {
    const response = formatResponse(html('<p>x</p>'))

    expect(response).toContain('\r\n\r\n<p>x</p>')
  })

  it('종류를 알려준다', () => {
    expect(formatResponse(html('x'))).toContain('Content-Type: text/html')
    expect(formatResponse(json({}))).toContain('Content-Type: application/json')
  })
})

describe('바이트 세기', () => {
  it('영문은 한 바이트다', () => {
    expect(utf8Length('abc')).toBe(3)
  })

  it('한글은 세 바이트다', () => {
    expect(utf8Length('안녕')).toBe(6)
  })

  it('이모지는 네 바이트다', () => {
    expect(utf8Length('🛫')).toBe(4)
  })

  it('Node 가 센 것과 같다', () => {
    const samples = ['abc', '안녕하세요', '🛫 비행기', 'a안🛫z', '']

    for (const text of samples) {
      expect(utf8Length(text)).toBe(Buffer.byteLength(text, 'utf8'))
    }
  })
})
