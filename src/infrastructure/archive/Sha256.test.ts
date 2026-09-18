import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { Sha256, sha256Hex, utf8Bytes } from './Sha256'

/**
 * 직접 만든 요약값이라 **바깥 기준에 대고 확인한다.**
 *
 * 스스로와만 맞춰보면 틀린 채로 늘 같은 값을 내도 알 수 없다.
 * 공개된 시험값과 Node 가 계산한 값, 둘 다에 대고 본다.
 */

describe('공개된 시험값', () => {
  it('빈 글', () => {
    expect(sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
  })

  it('abc', () => {
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('한 덩이를 넘기는 길이', () => {
    // 448비트 경계를 넘어 길이가 다음 덩이로 밀리는 경우다.
    // 여기서 어긋나는 구현이 많다.
    expect(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    )
  })

  it('백만 글자', () => {
    expect(sha256Hex('a'.repeat(1_000_000))).toBe(
      'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0',
    )
  })
})

describe('Node 가 계산한 값과 견줘', () => {
  function byNode(text: string): string {
    return createHash('sha256').update(text, 'utf8').digest('hex')
  }

  const samples = [
    '안녕',
    '떨어져 앉아도 괜찮아요',
    '🛫 비행기 모드 켰어?',
    'a'.repeat(63),
    'a'.repeat(64),
    'a'.repeat(65),
    'a'.repeat(55),
    'a'.repeat(56),
    'a'.repeat(57),
    '가'.repeat(1000),
  ]

  it.each(samples)('%s 를 같게 요약한다', text => {
    expect(sha256Hex(text)).toBe(byNode(text))
  })

  it('조금씩 나눠 넣어도 한 번에 넣은 것과 같다', () => {
    // 만 건짜리 대화는 흘려가며 요약한다. 나눠 넣는 길이 틀리면
    // 꺼낼 때와 되돌릴 때 값이 달라져 멀쩡한 파일을 거절하게 된다.
    const parts = ['첫 줄\n', '둘째 줄\n', '🛬 마지막', 'x'.repeat(200)]
    const streamed = new Sha256()
    for (const part of parts) streamed.update(part)

    expect(streamed.digest()).toBe(byNode(parts.join('')))
  })

  it('한 글자씩 넣어도 같다', () => {
    const text = '떨어져 앉아도 괜찮아요 🛫'
    const streamed = new Sha256()
    for (const ch of text) streamed.update(ch)

    expect(streamed.digest()).toBe(byNode(text))
  })
})

describe('UTF-8 로 바꾸기', () => {
  it('한글을 세 바이트로 담는다', () => {
    expect(Array.from(utf8Bytes('가'))).toEqual([0xea, 0xb0, 0x80])
  })

  it('이모지를 네 바이트로 담는다', () => {
    // 두 칸에 나뉘어 있는 글자다. 붙여서 한 글자로 봐야 한다.
    expect(Array.from(utf8Bytes('🛫'))).toEqual([0xf0, 0x9f, 0x9b, 0xab])
  })

  it('Node 가 만든 바이트와 같다', () => {
    const text = '안녕 hello 🛫 가나다'
    expect(Array.from(utf8Bytes(text))).toEqual(Array.from(Buffer.from(text, 'utf8')))
  })
})

describe('끝낸 요약은', () => {
  it('두 번 꺼내지 못한다', () => {
    // 내부 상태가 이미 망가져 있어 두 번째 값은 거짓이다
    const hash = new Sha256().update('abc')
    hash.digest()

    expect(() => hash.digest()).toThrow()
  })
})
