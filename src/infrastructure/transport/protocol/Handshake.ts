import type { HelloAckPayload, HelloPayload } from '@/application/ports/Envelope'
import { PROTOCOL_VERSION } from '@/application/ports/Envelope'
import { pairingCode } from '@/domain/peer/PairingCode'
import { type DomainError, domainError } from '@/domain/shared/DomainError'
import { err, ok, type Result } from '@/domain/shared/Result'

/**
 * 처음 만나 인사하기.
 *
 * 연결되면 곧바로 서로를 확인한다. **이 절차를 마치기 전에는 아무것도
 * 주고받지 않는다.** 같은 Wi-Fi 에 다른 사람이 붙어 있을 수 있기 때문이다.
 *
 * (docs/04-transport-spec.md 2.5)
 */

/** 이 버전보다 낮으면 붙지 않는다 */
export const MIN_SUPPORTED_VERSION = 1

export interface HandshakeDecision {
  readonly accepted: boolean
  readonly reason?: HelloAckPayload['reason']
  /** 둘이 함께 쓸 규약 버전. 낮은 쪽에 맞춘다 */
  readonly agreedVersion: number
  /** 상대가 우리보다 새 버전인가. 화면에 알릴 때 쓴다 */
  readonly peerIsNewer: boolean
}

/**
 * 상대의 인사를 받아들일지 정한다.
 *
 * 코드가 맞아야 받아들인다. 그게 "우리 둘"임을 확인하는 유일한 방법이다.
 */
export function judgeHello(
  input: JudgeHelloInput,
): Result<HandshakeDecision, DomainError> {
  const mine = pairingCode(input.myPairingCode)
  if (!mine.ok) {
    return err(domainError('invalid-value', '내 코드가 올바르지 않다', 'pairingCode'))
  }

  const theirs = pairingCode(input.hello.pairingCode)
  if (!theirs.ok) {
    return ok({
      accepted: false,
      reason: 'code-mismatch',
      agreedVersion: PROTOCOL_VERSION,
      peerIsNewer: false,
    })
  }

  if (mine.value !== theirs.value) {
    return ok({
      accepted: false,
      reason: 'code-mismatch',
      agreedVersion: PROTOCOL_VERSION,
      peerIsNewer: false,
    })
  }

  if (input.hello.v < MIN_SUPPORTED_VERSION) {
    // 너무 낡은 앱이라 말이 안 통한다
    return ok({
      accepted: false,
      reason: 'version-too-old',
      agreedVersion: PROTOCOL_VERSION,
      peerIsNewer: false,
    })
  }

  // 버전이 달라도 붙는다. 낮은 쪽에 맞춰 말하면 된다.
  // 여기서 끊으면 한쪽만 업데이트했을 때 대화가 통째로 안 된다.
  return ok({
    accepted: true,
    agreedVersion: Math.min(PROTOCOL_VERSION, input.hello.v),
    peerIsNewer: input.hello.v > PROTOCOL_VERSION,
  })
}

export interface JudgeHelloInput {
  readonly hello: HelloPayload & { readonly v: number }
  readonly myPairingCode: string
}

/**
 * 인사를 마친 뒤 못 받은 게 있는지 본다.
 *
 * 상대가 "나는 여기까지 보냈다"고 알려준 값과 내가 받은 값을 비교한다.
 * 다시 붙자마자 놓친 것을 채우기 위해서다.
 */
export function missingAfterHandshake(
  myHighestFromPeer: number,
  peerHighestSent: number,
  knownMissing: readonly number[],
): number[] {
  const missing = new Set(knownMissing)

  for (let seq = myHighestFromPeer + 1; seq <= peerHighestSent; seq += 1) {
    missing.add(seq)
  }

  return [...missing].sort((a, b) => a - b)
}

/** 인사가 이 시간 안에 안 끝나면 연결을 끊고 처음부터 다시 한다 */
export const HANDSHAKE_TIMEOUT_MS = 5000
