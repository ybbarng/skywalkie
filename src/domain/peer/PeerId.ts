import { type DomainError, domainError } from '../shared/DomainError'
import { err, ok, type Result } from '../shared/Result'

/**
 * 상대 식별자.
 *
 * 앱을 처음 켤 때 한 번 만들어 기기에 저장한다. 두 기기가 서로를
 * 알아보는 기준이고, 보관 파일에도 들어가서 "누가 한 말인지"를 나눈다.
 *
 * T04 에서 Peer 엔티티가 이 값을 쓴다. 여기서는 형식만 정한다.
 */

const MIN_LENGTH = 8
const MAX_LENGTH = 64
const PEER_ID_PATTERN = /^[A-Za-z0-9_-]+$/

declare const brand: unique symbol

export type PeerId = string & { readonly [brand]: 'PeerId' }

export function peerId(value: string): Result<PeerId, DomainError> {
  if (value.length === 0) {
    return err(domainError('empty', '상대 식별자가 비어 있다', 'peerId'))
  }

  if (value.length < MIN_LENGTH || value.length > MAX_LENGTH) {
    return err(
      domainError(
        'invalid-value',
        `상대 식별자는 ${MIN_LENGTH}자에서 ${MAX_LENGTH}자 사이여야 한다 (지금 ${value.length}자)`,
        'peerId',
      ),
    )
  }

  if (!PEER_ID_PATTERN.test(value)) {
    // 파일 이름과 URL 에 그대로 들어갈 수 있어야 한다
    return err(
      domainError(
        'invalid-value',
        '상대 식별자에는 영문, 숫자, 밑줄, 붙임표만 쓸 수 있다',
        'peerId',
      ),
    )
  }

  return ok(value as PeerId)
}

export function samePeer(a: PeerId, b: PeerId): boolean {
  return a === b
}

export const peerIdLimits = { min: MIN_LENGTH, max: MAX_LENGTH } as const
