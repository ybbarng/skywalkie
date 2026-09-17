import { describe, expect, it } from 'vitest'
import {
  characterId,
  characterIds,
  expressions,
  isHidden,
  selectableCharacters,
} from './Character'

describe('캐릭터 고르기', () => {
  it.each(characterIds)('%s 를 받아들인다', id => {
    expect(characterId(id).ok).toBe(true)
  })

  it('모르는 캐릭터를 거절한다', () => {
    const result = characterId('godzilla')

    expect(!result.ok && result.error.code).toBe('invalid-value')
  })

  it('빈 값을 거절한다', () => {
    const result = characterId('')

    expect(!result.ok && result.error.code).toBe('empty')
  })

  it('보관 파일에서 온 모르는 값도 거절한다', () => {
    // 나중 버전에서 캐릭터가 늘어난 뒤 그 파일을 옛 앱에서 열 수 있다
    const result = characterId('future-character')

    expect(result.ok).toBe(false)
  })
})

describe('고르는 화면에 보여줄 것', () => {
  it('숨겨둔 캐릭터는 빼고 보여준다', () => {
    expect(selectableCharacters()).not.toContain('pilot')
  })

  it('나머지는 전부 보여준다', () => {
    const visible = characterIds.filter(id => !isHidden(id))

    expect(selectableCharacters()).toEqual(visible)
  })

  it('고를 수 있는 캐릭터가 둘 이상은 된다', () => {
    expect(selectableCharacters().length).toBeGreaterThanOrEqual(2)
  })
})

describe('표정', () => {
  it('상태를 알리는 표정이 빠짐없이 있다', () => {
    // 글씨를 읽지 않아도 상태를 알 수 있어야 한다
    expect(expressions).toContain('idle')
    expect(expressions).toContain('speaking')
    expect(expressions).toContain('typing')
    expect(expressions).toContain('disconnected')
    expect(expressions).toContain('sleeping')
  })
})
