import { describe, expect, it } from 'vitest'
import { encodeFrame, HEADER_BYTES, MAX_FRAME_BYTES } from './FrameCodec'
import { FrameDecoder } from './FrameDecoder'

/**
 * TCP 는 흐르는 물이라 어디까지가 한 메시지인지 알려주지 않는다.
 * 여기서 한 번 어긋나면 그 뒤로 오는 모든 메시지가 깨진다.
 * 그래서 잘라 보내는 모든 경우를 시험한다.
 */

function frame(text: string): Uint8Array {
  const result = encodeFrame(text)
  if (!result.ok) throw new Error(`테스트용 조각을 만들지 못했다: ${result.error.detail}`)
  return result.value
}

function collect(decoder: FrameDecoder, chunk: Uint8Array): string[] {
  const result = decoder.push(chunk)
  if (!result.ok) throw new Error(`잘라내지 못했다: ${result.error.detail}`)
  return [...result.value.payloads]
}

describe('바이트를 메시지로 자르기', () => {
  it('한 번에 딱 맞게 오면 그대로 꺼낸다', () => {
    const decoder = new FrameDecoder()

    const payloads = collect(decoder, frame('안녕'))

    expect(payloads).toEqual(['안녕'])
  })

  it('반씩 잘려서 두 번에 오면 이어 붙인다', () => {
    const decoder = new FrameDecoder()
    const whole = frame('34열 창가야')
    const half = Math.floor(whole.byteLength / 2)

    const first = collect(decoder, whole.slice(0, half))
    const second = collect(decoder, whole.slice(half))

    expect(first).toEqual([])
    expect(second).toEqual(['34열 창가야'])
  })

  it('한 바이트씩 와도 올바로 붙인다', () => {
    const decoder = new FrameDecoder()
    const whole = frame('기내식 뭐 나왔어?')
    const payloads: string[] = []

    for (const byte of whole) {
      payloads.push(...collect(decoder, new Uint8Array([byte])))
    }

    expect(payloads).toEqual(['기내식 뭐 나왔어?'])
  })

  it('세 메시지가 한 번에 붙어 오면 셋으로 나눈다', () => {
    const decoder = new FrameDecoder()
    const merged = concat(frame('하나'), frame('둘'), frame('셋'))

    const payloads = collect(decoder, merged)

    expect(payloads).toEqual(['하나', '둘', '셋'])
  })

  it('길이 머리가 잘려서 와도 기다린다', () => {
    const decoder = new FrameDecoder()
    const whole = frame('안녕')

    const partial = collect(decoder, whole.slice(0, 2))
    const rest = collect(decoder, whole.slice(2))

    expect(partial).toEqual([])
    expect(rest).toEqual(['안녕'])
  })

  it('두 메시지가 어긋나게 잘려 와도 올바로 나눈다', () => {
    // 실제로 가장 흔한 모양이다. 첫 메시지 끝과 둘째 메시지 앞이 한 덩어리로 온다.
    const decoder = new FrameDecoder()
    const merged = concat(frame('첫째'), frame('둘째'))
    const cut = frame('첫째').byteLength + 3

    const first = collect(decoder, merged.slice(0, cut))
    const second = collect(decoder, merged.slice(cut))

    expect(first).toEqual(['첫째'])
    expect(second).toEqual(['둘째'])
  })

  it('빈 바이트를 넣어도 아무 일도 없다', () => {
    const decoder = new FrameDecoder()

    expect(collect(decoder, new Uint8Array(0))).toEqual([])
  })

  it('이모지와 한글이 잘려도 깨지지 않는다', () => {
    // 한 글자가 여러 바이트라 가운데서 잘리면 깨질 수 있다
    const decoder = new FrameDecoder()
    const text = '창밖 봐 ✈️🌅 구름이 예뻐'
    const whole = frame(text)

    const payloads: string[] = []
    for (let i = 0; i < whole.byteLength; i += 3) {
      payloads.push(...collect(decoder, whole.slice(i, i + 3)))
    }

    expect(payloads).toEqual([text])
  })
})

describe('살아있는지 확인하는 신호', () => {
  it('길이가 0인 것은 메시지로 세지 않는다', () => {
    const decoder = new FrameDecoder()

    const result = decoder.push(new Uint8Array([0, 0, 0, 0]))

    expect(result.ok && result.value.payloads).toEqual([])
    expect(result.ok && result.value.heartbeats).toBe(1)
  })

  it('신호와 메시지가 섞여 와도 둘 다 알아본다', () => {
    const decoder = new FrameDecoder()
    const merged = concat(new Uint8Array([0, 0, 0, 0]), frame('안녕'))

    const result = decoder.push(merged)

    expect(result.ok && result.value.payloads).toEqual(['안녕'])
    expect(result.ok && result.value.heartbeats).toBe(1)
  })

  it('신호가 연달아 와도 센다', () => {
    const decoder = new FrameDecoder()
    const merged = concat(
      new Uint8Array([0, 0, 0, 0]),
      new Uint8Array([0, 0, 0, 0]),
      new Uint8Array([0, 0, 0, 0]),
    )

    const result = decoder.push(merged)

    expect(result.ok && result.value.heartbeats).toBe(3)
  })
})

describe('이상한 길이 값 막기', () => {
  it('최대 크기를 넘는다고 주장하면 연결을 끊는다', () => {
    // 이걸 안 막으면 값 하나로 메모리를 통째로 잡아먹는다
    const decoder = new FrameDecoder()
    const evil = new Uint8Array(HEADER_BYTES)
    const length = MAX_FRAME_BYTES + 1
    evil[0] = (length >>> 24) & 0xff
    evil[1] = (length >>> 16) & 0xff
    evil[2] = (length >>> 8) & 0xff
    evil[3] = length & 0xff

    const result = decoder.push(evil)

    expect(!result.ok && result.error.code).toBe('too-long')
  })

  it('맨 앞 비트가 켜진 값도 아주 큰 수로 읽는다', () => {
    // 0xFFFFFFFF 를 음수로 읽으면 검사를 지나쳐 버린다
    const decoder = new FrameDecoder()
    const evil = new Uint8Array([0xff, 0xff, 0xff, 0xff])

    const result = decoder.push(evil)

    expect(result.ok).toBe(false)
  })

  it('최대 크기에 딱 맞으면 받아들인다', () => {
    const decoder = new FrameDecoder(100)
    const body = new TextEncoder().encode('x'.repeat(100))
    const exact = new Uint8Array(HEADER_BYTES + 100)
    exact[3] = 100
    exact.set(body, HEADER_BYTES)

    const result = decoder.push(exact)

    expect(result.ok && result.value.payloads).toHaveLength(1)
  })

  it('보낼 때도 최대 크기를 넘으면 거절한다', () => {
    const result = encodeFrame('x'.repeat(MAX_FRAME_BYTES + 1))

    expect(!result.ok && result.error.code).toBe('too-long')
  })
})

describe('아무 바이트나 던져도 죽지 않는다', () => {
  it('무작위 바이트 수천 번에도 앱이 죽지 않는다', () => {
    // 상대가 다른 버전이거나 누가 장난칠 수 있다.
    // 씨앗을 고정해서 실패하면 같은 순서로 재현할 수 있게 한다.
    const random = seededRandom(20260917)
    const decoder = new FrameDecoder(4096)

    for (let round = 0; round < 3000; round += 1) {
      const size = Math.floor(random() * 64)
      const chunk = new Uint8Array(size)
      for (let i = 0; i < size; i += 1) chunk[i] = Math.floor(random() * 256)

      // 실패해도 예외가 아니라 값으로 돌아와야 한다
      const result = decoder.push(chunk)
      if (!result.ok) decoder.reset()
    }

    expect(true).toBe(true)
  })

  it('쓰레기 뒤에 제대로 된 메시지가 와도 이어서 받는다', () => {
    // 연결을 다시 열 때 옛 조각이 남아 있으면 안 된다
    const decoder = new FrameDecoder()
    decoder.push(new Uint8Array([0x01, 0x02, 0x03]))

    decoder.reset()
    const payloads = collect(decoder, frame('다시 연결됐어'))

    expect(payloads).toEqual(['다시 연결됐어'])
  })
})

describe('쌓인 바이트', () => {
  it('덜 온 만큼 쌓아둔다', () => {
    const decoder = new FrameDecoder()
    const whole = frame('안녕하세요')

    decoder.push(whole.slice(0, 6))

    expect(decoder.pendingBytes()).toBe(6)
  })

  it('다 받으면 비워진다', () => {
    const decoder = new FrameDecoder()

    decoder.push(frame('안녕'))

    expect(decoder.pendingBytes()).toBe(0)
  })
})

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.byteLength, 0)
  const merged = new Uint8Array(total)
  let offset = 0
  for (const array of arrays) {
    merged.set(array, offset)
    offset += array.byteLength
  }
  return merged
}

function seededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}
