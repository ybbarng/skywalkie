import { describe, expect, it } from 'vitest'
import { asObject, asSubject, asTopic, hasFinalConsonant } from './josa'

describe('받침 보기', () => {
  it('받침이 있는 글자를 알아본다', () => {
    for (const word of ['지민', '여자친구님', '짝꿍', '상현']) {
      expect(hasFinalConsonant(word)).toBe(true)
    }
  })

  it('받침이 없는 글자를 알아본다', () => {
    for (const word of ['여자친구', '남자친구', '누나', '아리']) {
      expect(hasFinalConsonant(word)).toBe(false)
    }
  })

  it('한글이 아니면 없는 것으로 본다', () => {
    // 읽는 소리를 알 수 없다. 그때는 "가/는/를" 이 덜 어색하다.
    expect(hasFinalConsonant('Jimin')).toBe(false)
    expect(hasFinalConsonant('🙂')).toBe(false)
    expect(hasFinalConsonant('')).toBe(false)
  })

  it('맨 끝 글자만 본다', () => {
    expect(hasFinalConsonant('상대방')).toBe(true)
    expect(hasFinalConsonant('상대')).toBe(false)
  })
})

describe('조사 붙이기', () => {
  it('받침이 있으면 이 · 은 · 을', () => {
    expect(asSubject('지민')).toBe('지민이')
    expect(asTopic('지민')).toBe('지민은')
    expect(asObject('지민')).toBe('지민을')
  })

  it('받침이 없으면 가 · 는 · 를', () => {
    expect(asSubject('여자친구')).toBe('여자친구가')
    expect(asTopic('여자친구')).toBe('여자친구는')
    expect(asObject('여자친구')).toBe('여자친구를')
  })

  it('없는 말을 만들지 않는다', () => {
    // "여자친구이" · "지민가" 는 한국어가 아니다.
    for (const word of ['지민', '여자친구', '남자친구', '짝꿍', '상대']) {
      const made = [asSubject(word), asTopic(word), asObject(word)].join(' ')

      for (const broken of ['구이 ', '민가', '꿍가', '대이']) {
        expect(made).not.toContain(broken)
      }
    }
  })
})
