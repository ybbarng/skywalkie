import { describe, expect, it } from 'vitest'
import { base64ToBytes, bytesToBase64 } from './base64'

/**
 * base64 로 바꾸고 되돌리기.
 *
 * 네이티브 모듈이 글자로만 주고받아서 필요하다. `btoa` 는 기기에
 * 없을 수 있어 직접 만들었다.
 *
 * **직접 만든 것이라 바깥 기준에 대고 확인한다.** 스스로와만
 * 맞춰보면 틀린 채로 늘 같은 값을 내도 알 수 없다.
 */

function bytes(...values: number[]): Uint8Array {
  return Uint8Array.from(values)
}

describe('Node 가 만든 것과 같다', () => {
  const samples: Array<[string, Uint8Array]> = [
    ['빈 것', bytes()],
    ['한 바이트', bytes(65)],
    ['두 바이트', bytes(65, 66)],
    ['세 바이트', bytes(65, 66, 67)],
    ['네 바이트', bytes(65, 66, 67, 68)],
    ['0 이 섞인 것', bytes(0, 255, 0, 128, 64)],
    ['한글 바이트', new Uint8Array(Buffer.from('안녕하세요', 'utf8'))],
    ['조각 머리말', bytes(7, 2, 5, 0xff, 0x00, 0x7f)],
  ]

  it.each(samples)('%s 를 같게 바꾼다', (_label, input) => {
    expect(bytesToBase64(input)).toBe(Buffer.from(input).toString('base64'))
  })

  it.each(samples)('%s 를 같게 되돌린다', (_label, input) => {
    const encoded = Buffer.from(input).toString('base64')

    expect(Array.from(base64ToBytes(encoded))).toEqual(Array.from(input))
  })
})

describe('바꿨다 되돌리면', () => {
  it('그대로다', () => {
    // **한 바이트라도 어긋나면 말이 깨진다**
    for (let length = 0; length < 200; length += 1) {
      const original = new Uint8Array(length).map((_, i) => (i * 37) % 256)

      expect(Array.from(base64ToBytes(bytesToBase64(original)))).toEqual(
        Array.from(original),
      )
    }
  })

  it('한 조각 크기만큼도 그대로다', () => {
    const original = new Uint8Array(182).map((_, i) => (i * 13) % 256)

    expect(Array.from(base64ToBytes(bytesToBase64(original)))).toEqual(
      Array.from(original),
    )
  })
})

describe('이상한 글이 와도', () => {
  it('터지지 않는다', () => {
    expect(() => base64ToBytes('!!!not base64!!!')).not.toThrow()
  })

  it('빈 글은 빈 것이 된다', () => {
    expect(base64ToBytes('').byteLength).toBe(0)
  })

  it('줄바꿈이 섞여도 읽는다', () => {
    const original = bytes(1, 2, 3, 4, 5)
    const encoded = Buffer.from(original).toString('base64')

    expect(Array.from(base64ToBytes(`${encoded}\n`))).toEqual(Array.from(original))
  })
})
