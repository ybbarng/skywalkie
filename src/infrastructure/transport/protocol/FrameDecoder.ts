import { type DomainError, domainError } from '@/domain/shared/DomainError'
import { err, ok, type Result } from '@/domain/shared/Result'
import { HEADER_BYTES, MAX_FRAME_BYTES, readLength } from './FrameCodec'

/**
 * 흐르는 바이트를 메시지로 자른다.
 *
 * 들어오는 대로 넣으면 완성된 것만 골라 돌려준다. 잘려서 온 것은
 * 안에 모아두었다가 나머지가 오면 이어 붙인다.
 *
 * **이 클래스의 테스트가 이 앱에서 가장 값지다.** 두 기기 사이가
 * 가장 위험한 곳이고, 여기서 한 번 어긋나면 그 뒤로 오는 모든 메시지가
 * 깨진다. (docs/09-testing.md 3장)
 */
export class FrameDecoder {
  // 넣는 쪽이 어떤 버퍼를 쓰는지 가리지 않는다. 소켓 라이브러리마다 다르다.
  private buffer: Uint8Array<ArrayBufferLike> = new Uint8Array(0)

  constructor(private readonly maxFrameBytes = MAX_FRAME_BYTES) {}

  /**
   * 바이트를 넣고 완성된 메시지를 받는다.
   *
   * 길이가 0인 것(살아있는지 확인하는 신호)은 돌려주지 않고 조용히 넘긴다.
   */
  push(chunk: Uint8Array): Result<DecodedFrames, DomainError> {
    this.buffer = concat(this.buffer, chunk)

    const payloads: string[] = []
    let heartbeats = 0

    for (;;) {
      if (this.buffer.byteLength < HEADER_BYTES) break

      const length = readLength(this.buffer)

      if (length > this.maxFrameBytes) {
        // 이상한 길이 값 하나로 메모리를 통째로 잡아먹는 걸 막는다.
        // 이 연결은 더 믿을 수 없으므로 끊는다.
        return err(
          domainError(
            'too-long',
            `한 번에 받을 수 있는 크기를 넘는다고 한다 (${length}바이트)`,
            'frame',
          ),
        )
      }

      if (length === 0) {
        this.buffer = this.buffer.slice(HEADER_BYTES)
        heartbeats += 1
        continue
      }

      // 아직 다 안 왔다. 다음 조각을 기다린다.
      if (this.buffer.byteLength < HEADER_BYTES + length) break

      const body = this.buffer.slice(HEADER_BYTES, HEADER_BYTES + length)
      this.buffer = this.buffer.slice(HEADER_BYTES + length)

      payloads.push(new TextDecoder().decode(body))
    }

    return ok({ payloads, heartbeats })
  }

  /** 아직 다 안 온 바이트가 얼마나 쌓여 있나 */
  pendingBytes(): number {
    return this.buffer.byteLength
  }

  /** 연결을 다시 열 때 비운다. 안 비우면 옛 조각에 새 조각이 붙는다 */
  reset(): void {
    this.buffer = new Uint8Array(0)
  }
}

export interface DecodedFrames {
  readonly payloads: readonly string[]
  /** 받은 하트비트 개수. 상대가 살아있다는 뜻이다 */
  readonly heartbeats: number
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.byteLength === 0) return b
  if (b.byteLength === 0) return a

  const merged = new Uint8Array(a.byteLength + b.byteLength)
  merged.set(a, 0)
  merged.set(b, a.byteLength)
  return merged
}
