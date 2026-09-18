/**
 * 아주 작은 HTTP.
 *
 * 사파리가 보내오는 것을 읽고 답을 만든다. **다 만들지 않는다.**
 * 우리 화면 하나가 쓰는 만큼만 한다. 파일 올리기도, 쿠키도, 압축도
 * 없다.
 *
 * 소켓을 건드리지 않는 순수한 계산이라 전부 시험할 수 있다.
 * (docs/04-transport-spec.md 5장 · T21)
 */

export interface HttpRequest {
  readonly method: string
  readonly path: string
  readonly query: Record<string, string>
  readonly body: string
}

/**
 * 받은 글을 요청으로 바꾼다.
 *
 * 다 안 왔으면 `null` 을 돌려준다. **여기서 섣불리 답하면** 잘린
 * 요청에 엉뚱한 답을 보내게 된다.
 */
export function parseRequest(raw: string): HttpRequest | null {
  const headEnd = raw.indexOf('\r\n\r\n')
  if (headEnd === -1) return null

  const head = raw.slice(0, headEnd)
  const lines = head.split('\r\n')
  const first = lines[0]
  if (first === undefined) return null

  const [method, target] = first.split(' ')
  if (method === undefined || target === undefined) return null

  // 본문이 다 왔는지 본다. 안 왔으면 더 기다린다.
  //
  // **바이트로 세야 한다.** Content-Length 는 바이트인데 글자 수로
  // 재면 한글이 섞이는 순간 어긋난다. 한글 한 글자가 세 바이트라
  // "다 왔는데도 덜 왔다"고 보고 영영 기다리게 된다.
  const length = contentLength(lines)
  const rest = raw.slice(headEnd + 4)
  if (utf8Length(rest) < length) return null

  const [path, search] = target.split('?')

  return {
    method: method.toUpperCase(),
    path: path ?? '/',
    query: parseQuery(search ?? ''),
    body: takeUtf8(rest, length),
  }
}

/**
 * 앞에서부터 이만큼 바이트가 되는 데까지 자른다.
 *
 * 글자 한가운데서 자르면 깨진 글자가 남는다. 한 글자를 통째로
 * 넣을 수 없으면 거기서 멈춘다.
 */
export function takeUtf8(text: string, byteLength: number): string {
  if (byteLength <= 0) return ''

  let bytes = 0

  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i)
    const isPair = code >= 0xd800 && code <= 0xdbff
    const size = code < 0x80 ? 1 : code < 0x800 ? 2 : isPair ? 4 : 3

    if (bytes + size > byteLength) return text.slice(0, i)

    bytes += size
    if (isPair) i += 1
  }

  return text
}

function contentLength(lines: readonly string[]): number {
  for (const line of lines.slice(1)) {
    const at = line.indexOf(':')
    if (at === -1) continue

    if (line.slice(0, at).trim().toLowerCase() !== 'content-length') continue

    const value = Number(line.slice(at + 1).trim())
    return Number.isFinite(value) && value > 0 ? value : 0
  }
  return 0
}

export function parseQuery(search: string): Record<string, string> {
  const out: Record<string, string> = {}
  if (search.length === 0) return out

  for (const pair of search.split('&')) {
    const at = pair.indexOf('=')
    if (at === -1) {
      out[decode(pair)] = ''
      continue
    }
    out[decode(pair.slice(0, at))] = decode(pair.slice(at + 1))
  }
  return out
}

function decode(raw: string): string {
  try {
    return decodeURIComponent(raw.replace(/\+/g, ' '))
  } catch {
    // 이상한 글자가 섞여 있다. 그대로 쓴다.
    return raw
  }
}

export interface HttpResponse {
  readonly status: number
  readonly contentType: string
  readonly body: string
}

/**
 * 답을 글로 바꾼다.
 *
 * **길이를 바이트로 세야 한다.** 한글은 한 글자가 세 바이트라,
 * 글자 수로 세면 사파리가 답을 끝까지 못 읽고 기다린다.
 */
export function formatResponse(response: HttpResponse): string {
  const length = utf8Length(response.body)

  return (
    [
      `HTTP/1.1 ${response.status} ${reason(response.status)}`,
      `Content-Type: ${response.contentType}; charset=utf-8`,
      `Content-Length: ${length}`,
      // 인터넷이 없으니 캐시가 도움이 안 된다. 오히려 옛 화면이 뜬다.
      'Cache-Control: no-store',
      'Connection: keep-alive',
      '',
      '',
    ].join('\r\n') + response.body
  )
}

export function utf8Length(text: string): number {
  let bytes = 0

  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i)

    if (code < 0x80) bytes += 1
    else if (code < 0x800) bytes += 2
    else if (code >= 0xd800 && code <= 0xdbff) {
      // 이모지 같은 것. 두 칸이 합쳐 네 바이트다.
      bytes += 4
      i += 1
    } else bytes += 3
  }

  return bytes
}

function reason(status: number): string {
  switch (status) {
    case 200:
      return 'OK'
    case 400:
      return 'Bad Request'
    case 404:
      return 'Not Found'
    default:
      return 'Error'
  }
}

export function html(body: string): HttpResponse {
  return { status: 200, contentType: 'text/html', body }
}

export function json(value: unknown): HttpResponse {
  return { status: 200, contentType: 'application/json', body: JSON.stringify(value) }
}

export function notFound(): HttpResponse {
  return { status: 404, contentType: 'text/plain', body: '없는 자리예요' }
}

/**
 * 웹에서 보내온 글을 뜯어본다.
 *
 * **사파리에서 오는 것을 믿지 않는다.** 같은 Wi-Fi 에 붙은 다른
 * 사람이 아무거나 보낼 수도 있고, 우리가 만든 화면이 아닐 수도 있다.
 * 이상하면 `null` 이다.
 */
export function readText(body: string, maxLength = 4000): string | null {
  try {
    const parsed: unknown = JSON.parse(body)
    if (typeof parsed !== 'object' || parsed === null) return null

    const text = (parsed as { text?: unknown }).text
    if (typeof text !== 'string') return null

    const trimmed = text.trim()
    // 막지 않으면 사설망이 통째로 막힌다
    return trimmed.length === 0 ? null : trimmed.slice(0, maxLength)
  } catch {
    return null
  }
}
