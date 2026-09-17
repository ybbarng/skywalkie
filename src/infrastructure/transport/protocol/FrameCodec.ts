import { type DomainError, domainError } from '@/domain/shared/DomainError'
import { err, ok, type Result } from '@/domain/shared/Result'

/**
 * 바이트를 메시지 단위로 자른다.
 *
 * TCP 는 흐르는 물이라 어디까지가 한 메시지인지 알려주지 않는다.
 * 한 번 보낸 것이 여러 번에 나뉘어 오기도 하고, 여러 번 보낸 것이
 * 한 번에 붙어 오기도 한다. 그래서 길이를 앞에 붙인다.
 *
 * ```
 * ┌──────────────────┬──────────────────────────────┐
 * │ 길이 4바이트      │ 내용 (JSON, UTF-8)           │
 * │ (앞이 큰 자리)    │                              │
 * └──────────────────┴──────────────────────────────┘
 * ```
 *
 * (docs/04-transport-spec.md 2.4)
 */

export const HEADER_BYTES = 4

/**
 * 한 메시지의 최대 크기.
 *
 * 이걸 넘는다고 주장하면 연결을 끊는다. 안 그러면 이상한 길이 값 하나로
 * 메모리를 통째로 잡아먹는다. 상대가 다른 버전이거나 누가 장난칠 수 있다.
 */
export const MAX_FRAME_BYTES = 1024 * 1024

/** 길이가 0이면 살아있는지 확인하는 신호다 */
export const HEARTBEAT = new Uint8Array([0, 0, 0, 0])

export function encodeFrame(payload: string): Result<Uint8Array, DomainError> {
  const body = new TextEncoder().encode(payload)

  if (body.byteLength > MAX_FRAME_BYTES) {
    return err(
      domainError(
        'too-long',
        `한 번에 보낼 수 있는 크기를 넘었다 (${body.byteLength}바이트)`,
        'frame',
      ),
    )
  }

  const frame = new Uint8Array(HEADER_BYTES + body.byteLength)
  writeLength(frame, body.byteLength)
  frame.set(body, HEADER_BYTES)

  return ok(frame)
}

function writeLength(target: Uint8Array, length: number): void {
  // 앞이 큰 자리(big-endian). 네트워크에서 쓰는 관례다.
  target[0] = (length >>> 24) & 0xff
  target[1] = (length >>> 16) & 0xff
  target[2] = (length >>> 8) & 0xff
  target[3] = length & 0xff
}

export function readLength(source: Uint8Array, offset = 0): number {
  const b0 = source[offset] ?? 0
  const b1 = source[offset + 1] ?? 0
  const b2 = source[offset + 2] ?? 0
  const b3 = source[offset + 3] ?? 0

  // >>> 0 을 붙이는 이유: 맨 앞 비트가 켜지면 자바스크립트가 음수로 읽는다
  return ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) >>> 0
}
