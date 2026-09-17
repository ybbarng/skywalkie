import { describe, expect, it } from 'vitest'
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  formatForDisplay,
  generatePairingCode,
  pairingCode,
  sameCode,
} from './PairingCode'

/** 씨앗을 고정한 난수. 실패하면 같은 순서로 다시 재현할 수 있다 */
function seededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

describe('코드 읽기', () => {
  it('올바른 코드를 받아들인다', () => {
    const result = pairingCode('K7M2PX')

    expect(result.ok).toBe(true)
  })

  it('소문자로 입력해도 받아들인다', () => {
    // 상대가 화면을 보고 입력하는 상황이라 대소문자를 따지면 안 된다
    const result = pairingCode('k7m2px')

    expect(result.ok && result.value).toBe('K7M2PX')
  })

  it('앞뒤 공백을 떼어낸다', () => {
    const result = pairingCode('  K7M2PX  ')

    expect(result.ok && result.value).toBe('K7M2PX')
  })

  it('빈 값을 거절한다', () => {
    const result = pairingCode('')

    expect(!result.ok && result.error.code).toBe('empty')
  })

  it.each([
    ['짧으면', 'K7M2P'],
    ['길면', 'K7M2PXA'],
  ])('%s 거절한다', (_label, value) => {
    const result = pairingCode(value)

    expect(!result.ok && result.error.detail).toContain(`${CODE_LENGTH}자리`)
  })

  it.each([
    ['0 은', 'K7M2P0'],
    ['1 은', 'K7M2P1'],
    ['O 는', 'K7M2PO'],
    ['I 는', 'K7M2PI'],
  ])('헷갈리는 글자 %s 쓸 수 없다', (_label, value) => {
    // 화면으로 보여주고 상대가 입력하는 과정에서 반드시 틀린다
    const result = pairingCode(value)

    expect(result.ok).toBe(false)
  })
})

describe('코드 만들기', () => {
  it(`${CODE_LENGTH}자리를 만든다`, () => {
    const code = generatePairingCode(seededRandom(42))

    expect(code).toHaveLength(CODE_LENGTH)
  })

  it('만든 코드는 언제나 읽을 수 있다', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const code = generatePairingCode(seededRandom(seed))

      expect(pairingCode(code).ok).toBe(true)
    }
  })

  it('헷갈리는 글자가 섞이지 않는다', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const code = generatePairingCode(seededRandom(seed))

      for (const char of code) {
        expect(CODE_ALPHABET).toContain(char)
      }
    }
  })

  it('씨앗이 같으면 같은 코드가 나온다', () => {
    const first = generatePairingCode(seededRandom(7))
    const second = generatePairingCode(seededRandom(7))

    expect(first).toBe(second)
  })

  it('씨앗이 다르면 대체로 다른 코드가 나온다', () => {
    const codes = new Set<string>()
    for (let seed = 1; seed <= 100; seed += 1) {
      codes.add(generatePairingCode(seededRandom(seed)))
    }

    expect(codes.size).toBeGreaterThan(90)
  })

  it('난수가 경계값을 줘도 코드가 만들어진다', () => {
    const always0 = generatePairingCode(() => 0)
    const almost1 = generatePairingCode(() => 0.9999999)

    expect(pairingCode(always0).ok).toBe(true)
    expect(pairingCode(almost1).ok).toBe(true)
  })
})

describe('보여주기', () => {
  it('세 자리씩 끊어 보여준다', () => {
    // 화면을 보여주고 상대가 읽어야 해서 끊어주면 덜 틀린다
    const code = pairingCode('K7M2PX')
    if (!code.ok) throw new Error('앞선 단계가 실패했다')

    expect(formatForDisplay(code.value)).toBe('K7M 2PX')
  })
})

describe('같은 코드인지', () => {
  it('같으면 같다고 한다', () => {
    const a = pairingCode('K7M2PX')
    const b = pairingCode('k7m2px')

    expect(a.ok && b.ok && sameCode(a.value, b.value)).toBe(true)
  })

  it('다르면 다르다고 한다', () => {
    const a = pairingCode('K7M2PX')
    const b = pairingCode('K7M2PY')

    expect(a.ok && b.ok && sameCode(a.value, b.value)).toBe(false)
  })
})
