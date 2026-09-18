import { describe, expect, it } from 'vitest'
import {
  AssetAssembly,
  CHUNK_BYTES,
  chunkCountFor,
  chunkRange,
  isSendable,
  MAX_ASSET_BYTES,
  RESIZE_LONG_EDGE,
  resizedSize,
} from './AssetChunks'

/**
 * 사진 조각내기.
 *
 * **여기가 어긋나면 사진이 깨져서 도착한다.** 그리고 깨진 줄도 모른다.
 * 자르고 맞추는 계산이라 기기 없이 전부 시험할 수 있다.
 */

describe('몇 조각으로 자르나', () => {
  it('딱 나누어떨어지면 그만큼이다', () => {
    expect(chunkCountFor(CHUNK_BYTES * 3)).toBe(3)
  })

  it('남는 것도 한 조각이다', () => {
    // 여기서 내림하면 **끝부분이 통째로 사라진다**
    expect(chunkCountFor(CHUNK_BYTES * 3 + 1)).toBe(4)
  })

  it('한 조각보다 작으면 한 조각이다', () => {
    expect(chunkCountFor(10)).toBe(1)
  })

  it('빈 것은 조각이 없다', () => {
    expect(chunkCountFor(0)).toBe(0)
  })
})

describe('조각의 자리', () => {
  const size = CHUNK_BYTES * 2 + 100

  it('첫 조각은 처음부터다', () => {
    const range = chunkRange(0, size)

    expect(range.ok).toBe(true)
    if (!range.ok) return
    expect(range.value).toEqual({ start: 0, end: CHUNK_BYTES })
  })

  it('마지막 조각은 남은 만큼만이다', () => {
    // 끝을 넘겨 읽으면 터지거나 쓰레기가 붙는다
    const range = chunkRange(2, size)

    expect(range.ok).toBe(true)
    if (!range.ok) return
    expect(range.value).toEqual({ start: CHUNK_BYTES * 2, end: size })
  })

  it('조각들이 빈틈없이 이어진다', () => {
    // **한 바이트라도 겹치거나 비면 사진이 깨진다**
    let at = 0
    for (let i = 0; i < chunkCountFor(size); i += 1) {
      const range = chunkRange(i, size)
      if (!range.ok) throw new Error('자리를 못 구했다')

      expect(range.value.start).toBe(at)
      at = range.value.end
    }

    expect(at).toBe(size)
  })

  it('없는 조각을 물으면 거절한다', () => {
    expect(chunkRange(3, size).ok).toBe(false)
    expect(chunkRange(-1, size).ok).toBe(false)
    expect(chunkRange(1.5, size).ok).toBe(false)
  })
})

describe('조각 모으기', () => {
  const size = CHUNK_BYTES * 4
  const newAssembly = () => new AssetAssembly('01J', size)

  it('다 모이면 알려준다', () => {
    const assembly = newAssembly()

    for (let i = 0; i < 4; i += 1) assembly.accept(i)

    expect(assembly.isComplete()).toBe(true)
  })

  it('하나라도 없으면 안 끝났다', () => {
    const assembly = newAssembly()
    assembly.accept(0)
    assembly.accept(1)
    assembly.accept(3)

    expect(assembly.isComplete()).toBe(false)
    expect(assembly.missing()).toEqual([2])
  })

  it('순서가 뒤바뀌어 와도 된다', () => {
    // 여러 조각이 동시에 나가면 순서가 흐트러진다
    const assembly = newAssembly()

    for (const i of [3, 0, 2, 1]) assembly.accept(i)

    expect(assembly.isComplete()).toBe(true)
  })

  it('같은 조각이 두 번 와도 된다', () => {
    // 끊겼다 붙으면 상대가 겹쳐 보내는 일이 흔하다
    const assembly = newAssembly()
    assembly.accept(0)
    assembly.accept(0)
    assembly.accept(0)

    expect(assembly.isComplete()).toBe(false)
    expect(assembly.progress()).toBeCloseTo(0.25)
  })

  it('없는 조각은 거절한다', () => {
    const assembly = newAssembly()

    expect(assembly.accept(9).ok).toBe(false)
    expect(assembly.accept(-1).ok).toBe(false)
  })

  it('얼마나 왔는지 알려준다', () => {
    const assembly = newAssembly()
    assembly.accept(0)
    assembly.accept(1)

    expect(assembly.progress()).toBeCloseTo(0.5)
  })

  describe('다시 붙었을 때', () => {
    it('앞에서부터 빠짐없이 받은 데를 알려준다', () => {
      // **처음부터 다시 받으면** 사설망이 느릴 때 영영 못 끝낸다
      const assembly = newAssembly()
      assembly.accept(0)
      assembly.accept(1)
      assembly.accept(3)

      expect(assembly.contiguousUpTo()).toBe(2)
    })

    it('하나도 못 받았으면 0 이다', () => {
      expect(newAssembly().contiguousUpTo()).toBe(0)
    })

    it('다 받았으면 전부다', () => {
      const assembly = newAssembly()
      for (let i = 0; i < 4; i += 1) assembly.accept(i)

      expect(assembly.contiguousUpTo()).toBe(4)
    })
  })
})

describe('보낼 만한 크기인가', () => {
  it('빈 것은 안 보낸다', () => {
    expect(isSendable(0)).toBe(false)
  })

  it('너무 크면 안 보낸다', () => {
    // 사설망이 통째로 막혀 글까지 못 가게 된다
    expect(isSendable(MAX_ASSET_BYTES + 1)).toBe(false)
  })

  it('한계까지는 보낸다', () => {
    expect(isSendable(MAX_ASSET_BYTES)).toBe(true)
  })
})

describe('줄이기', () => {
  it('긴 변을 목표에 맞춘다', () => {
    const size = resizedSize(4000, 3000)

    expect(size.width).toBe(RESIZE_LONG_EDGE)
    expect(size.height).toBe(1200)
  })

  it('세로로 긴 사진도 긴 변을 맞춘다', () => {
    const size = resizedSize(3000, 4000)

    expect(size.height).toBe(RESIZE_LONG_EDGE)
    expect(size.width).toBe(1200)
  })

  it('비율이 그대로다', () => {
    // 찌그러지면 얼굴이 이상해진다
    const before = 4032 / 3024
    const after = resizedSize(4032, 3024)

    expect(after.width / after.height).toBeCloseTo(before, 2)
  })

  it('이미 작으면 그대로 둔다', () => {
    // 늘리면 흐려지기만 하고 파일만 커진다
    expect(resizedSize(800, 600)).toEqual({ width: 800, height: 600 })
  })

  it('아주 납작해도 한 픽셀은 남는다', () => {
    const size = resizedSize(8000, 3)

    expect(size.height).toBeGreaterThanOrEqual(1)
  })
})
