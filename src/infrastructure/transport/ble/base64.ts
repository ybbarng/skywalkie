/**
 * 바이트와 base64 사이를 오간다.
 *
 * 네이티브 모듈이 글자로만 주고받아서 필요하다. `btoa` 와 `atob` 는
 * 기기에 없을 수 있어 직접 만든다.
 *
 * 소켓을 건드리지 않는 순수한 계산이라 전부 시험할 수 있다.
 * **직접 만든 것이라 Node 가 만든 값에 대고 확인해 뒀다.**
 */

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/**
 * 바이트를 base64 로.
 *
 * 네이티브 모듈이 글자로만 주고받아서 필요하다. `btoa` 는 기기에
 * 없을 수 있어 직접 만든다.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  let out = ''

  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0
    const b = bytes[i + 1]
    const c = bytes[i + 2]

    out += BASE64[a >> 2]
    out += BASE64[((a & 3) << 4) | ((b ?? 0) >> 4)]
    out += b === undefined ? '=' : BASE64[((b & 15) << 2) | ((c ?? 0) >> 6)]
    out += c === undefined ? '=' : BASE64[c & 63]
  }

  return out
}

export function base64ToBytes(text: string): Uint8Array {
  const clean = text.replace(/[^A-Za-z0-9+/]/g, '')
  const out = new Uint8Array((clean.length * 3) >> 2)
  let at = 0
  let buffer = 0
  let bits = 0

  for (const ch of clean) {
    const value = BASE64.indexOf(ch)
    if (value < 0) continue

    buffer = (buffer << 6) | value
    bits += 6

    if (bits >= 8) {
      bits -= 8
      out[at] = (buffer >> bits) & 0xff
      at += 1
    }
  }

  return out.subarray(0, at)
}
