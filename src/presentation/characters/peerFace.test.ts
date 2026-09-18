import { describe, expect, it } from 'vitest'
import { peerFace, peerLabel, peerName } from './peerFace'

describe('상대를 모를 때', () => {
  it('캐릭터를 지어내지 않는다', () => {
    // 첫 연결 전이다. 상대가 뭘 골랐는지 알 방법이 없다.
    expect(peerFace(null)).toBeNull()
    expect(peerFace(undefined)).toBeNull()
  })

  it('첫 번째 캐릭터로 채우지 않는다', () => {
    // 예전에 `?? 'aria'` 로 채웠다. 고른 적 없는 얼굴이 떴다.
    expect(peerFace(null)).not.toBe('aria')
  })

  it('이름도 지어내지 않는다', () => {
    // 문구를 짓는 쪽이 조사까지 맞춰 쓸 수 있게 모른다고 알린다.
    expect(peerName(null)).toBeNull()
    expect(peerName({ displayName: '', character: 'nova' })).toBeNull()
  })

  it('한 줄에 박아 넣을 때만 "상대" 로 둔다', () => {
    expect(peerLabel(null)).toBe('상대')
    expect(peerLabel(undefined)).toBe('상대')
  })

  it('이름이 빈 글자여도 "상대" 로 둔다', () => {
    // 인사는 받았는데 이름이 비었다. 빈 줄을 띄우지 않는다.
    expect(peerLabel({ displayName: '', character: 'nova' })).toBe('상대')
  })
})

describe('내가 붙여둔 별명이 있으면', () => {
  it('이어지기 전에는 그 이름으로 부른다', () => {
    // **누구를 기다리는지는 안다.** 모르는 건 그 사람이 뭘 골랐는지다.
    expect(peerName(null, '여자친구')).toBe('여자친구')
    expect(peerLabel(null, '여자친구')).toBe('여자친구')
  })

  it('이어지고 나면 상대가 고른 이름이 앞선다', () => {
    // 본인이 그렇게 불리고 싶어 적은 것이다.
    const her = { displayName: '지민', character: 'mira' } as const
    expect(peerName(her, '여자친구')).toBe('지민')
  })

  it('별명이 비어 있으면 없는 것으로 본다', () => {
    expect(peerName(null, '')).toBeNull()
    expect(peerLabel(null, '')).toBe('상대')
  })

  it('캐릭터까지 알려주지는 못한다', () => {
    // 별명을 적어뒀다고 상대가 뭘 골랐는지 알게 되는 건 아니다.
    expect(peerFace(null)).toBeNull()
  })
})

describe('상대를 알고 나면', () => {
  const her = { displayName: '지민', character: 'mira' } as const

  it('고른 캐릭터를 그대로 쓴다', () => {
    expect(peerFace(her)).toBe('mira')
  })

  it('고른 이름을 그대로 쓴다', () => {
    expect(peerName(her)).toBe('지민')
    expect(peerLabel(her)).toBe('지민')
  })
})
