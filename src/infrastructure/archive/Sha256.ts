/**
 * SHA-256.
 *
 * 직접 만든 이유는 **인터넷을 쓰지 않기 위해서가 아니라 기기 모듈을
 * 늘리지 않기 위해서다.** `expo-crypto` 를 들이면 네이티브를 다시
 * 빌드해야 하는데, 얻는 것에 비해 치르는 값이 크다. 이건 순수 계산이라
 * 어느 기기에서나 똑같이 돈다.
 *
 * 쓰임은 하나다. **꺼내둔 파일이 잘렸는지 알아보는 것.** 파일이 반만
 * 남았는데 모르고 되돌리면 대화가 조용히 사라진다.
 *
 * 공개된 시험값으로 맞는지 확인해 뒀다.
 */

// prettier-ignore
const K = Uint32Array.from([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4,
  0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
  0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f,
  0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
  0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116,
  0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
  0xc67178f2,
])

const INITIAL = Uint32Array.from([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab,
  0x5be0cd19,
])

/** 글을 UTF-8 바이트로. `TextEncoder` 가 없는 기기가 있어 직접 만든다 */
export function utf8Bytes(text: string): Uint8Array {
  const out: number[] = []

  for (let i = 0; i < text.length; i += 1) {
    let code = text.charCodeAt(i)

    // 이모지 같은 것은 두 칸에 나뉘어 있다. 붙여서 한 글자로 본다.
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const low = text.charCodeAt(i + 1)
      if (low >= 0xdc00 && low <= 0xdfff) {
        code = (code - 0xd800) * 0x400 + (low - 0xdc00) + 0x10000
        i += 1
      }
    }

    if (code < 0x80) {
      out.push(code)
    } else if (code < 0x800) {
      out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
    } else if (code < 0x10000) {
      out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
    } else {
      out.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      )
    }
  }

  return Uint8Array.from(out)
}

/**
 * 한 번에 다 넣지 않고 조금씩 흘려 넣는다.
 *
 * 만 건짜리 대화를 통째로 문자열로 만들면 폰이 죽는다. 그래서 파일을
 * 쓰면서 동시에 요약값을 쌓아 올린다.
 */
export class Sha256 {
  private readonly state = Uint32Array.from(INITIAL)
  private readonly block = new Uint8Array(64)
  private readonly words = new Uint32Array(64)
  private filled = 0
  private totalBytes = 0
  private done = false

  update(text: string): this {
    const bytes = utf8Bytes(text)
    this.totalBytes += bytes.length

    let offset = 0
    while (offset < bytes.length) {
      const room = 64 - this.filled
      const take = Math.min(room, bytes.length - offset)
      this.block.set(bytes.subarray(offset, offset + take), this.filled)
      this.filled += take
      offset += take

      if (this.filled === 64) {
        this.compress()
        this.filled = 0
      }
    }

    return this
  }

  /** 열여섯 자씩 끊어 읽는 16진수 글자 */
  digest(): string {
    if (this.done) throw new Error('이미 끝낸 요약이다')
    this.done = true

    // 길이를 뒤에 붙이는 규칙대로 채운다
    const bitLength = this.totalBytes * 8
    this.block[this.filled] = 0x80
    this.filled += 1

    if (this.filled > 56) {
      this.block.fill(0, this.filled)
      this.compress()
      this.filled = 0
    }

    this.block.fill(0, this.filled)

    // 길이는 64비트인데, 자바스크립트 정수로 안전한 만큼만 쓴다.
    // 대화 파일이 2의 53승 비트를 넘을 일은 없다.
    const high = Math.floor(bitLength / 0x100000000)
    const low = bitLength >>> 0
    writeUint32(this.block, 56, high)
    writeUint32(this.block, 60, low)
    this.compress()

    let hex = ''
    for (const value of this.state) {
      hex += value.toString(16).padStart(8, '0')
    }
    return hex
  }

  private compress(): void {
    const w = this.words

    for (let i = 0; i < 16; i += 1) {
      const from = i * 4
      w[i] =
        ((at(this.block, from) << 24) |
          (at(this.block, from + 1) << 16) |
          (at(this.block, from + 2) << 8) |
          at(this.block, from + 3)) >>>
        0
    }

    for (let i = 16; i < 64; i += 1) {
      const x = at(w, i - 15)
      const y = at(w, i - 2)
      const s0 = rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3)
      const s1 = rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10)
      w[i] = (at(w, i - 16) + s0 + at(w, i - 7) + s1) >>> 0
    }

    let a = at(this.state, 0)
    let b = at(this.state, 1)
    let c = at(this.state, 2)
    let d = at(this.state, 3)
    let e = at(this.state, 4)
    let f = at(this.state, 5)
    let g = at(this.state, 6)
    let h = at(this.state, 7)

    for (let i = 0; i < 64; i += 1) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const temp1 = (h + s1 + ch + at(K, i) + at(w, i)) >>> 0
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (s0 + maj) >>> 0

      h = g
      g = f
      f = e
      e = (d + temp1) >>> 0
      d = c
      c = b
      b = a
      a = (temp1 + temp2) >>> 0
    }

    this.state[0] = (at(this.state, 0) + a) >>> 0
    this.state[1] = (at(this.state, 1) + b) >>> 0
    this.state[2] = (at(this.state, 2) + c) >>> 0
    this.state[3] = (at(this.state, 3) + d) >>> 0
    this.state[4] = (at(this.state, 4) + e) >>> 0
    this.state[5] = (at(this.state, 5) + f) >>> 0
    this.state[6] = (at(this.state, 6) + g) >>> 0
    this.state[7] = (at(this.state, 7) + h) >>> 0
  }
}

/**
 * 자리를 벗어난 읽기를 0 으로 본다.
 *
 * 이 파일 안에서는 늘 범위 안이라 실제로 0 이 나올 일이 없다.
 * 읽을 때마다 `?? 0` 을 흩뿌리지 않으려고 한곳에 모았다.
 */
function at(array: Uint32Array | Uint8Array, index: number): number {
  return array[index] ?? 0
}

/** 한 번에 끝내는 짧은 길 */
export function sha256Hex(text: string): string {
  return new Sha256().update(text).digest()
}

function rotr(value: number, bits: number): number {
  return ((value >>> bits) | (value << (32 - bits))) >>> 0
}

function writeUint32(target: Uint8Array, at: number, value: number): void {
  target[at] = (value >>> 24) & 0xff
  target[at + 1] = (value >>> 16) & 0xff
  target[at + 2] = (value >>> 8) & 0xff
  target[at + 3] = value & 0xff
}
