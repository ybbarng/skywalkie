import { type DomainError, domainError } from '../shared/DomainError'
import { err, ok, type Result } from '../shared/Result'

/**
 * 메시지가 어디까지 갔나.
 *
 * ```
 *   draft ──▶ sending ──▶ delivered ──▶ read
 *     │          │
 *     │          ▼
 *     └──────▶ pending ──▶ (연결되면 다시 sending)
 *                │
 *                ▼
 *              failed ──▶ pending  (다시 보내기)
 * ```
 *
 * 핵심 규칙은 **뒤로 가지 않는다**는 것이다. 읽음이 된 메시지가
 * 전달됨으로 돌아가지 않는다. 늦게 도착한 옛 신호가 화면을 흔드는 걸 막는다.
 * (docs/05-messaging-spec.md 3장)
 */

export const deliveryStates = [
  /** 아직 보내지 않았다 */
  'draft',
  /** 보내는 중 */
  'sending',
  /** 연결이 끊겨 기다리는 중. 붙으면 자동으로 나간다 */
  'pending',
  /** 상대에게 닿았다 */
  'delivered',
  /** 상대가 읽었다. 끝 상태 */
  'read',
  /** 여러 번 시도했지만 못 갔다. 사용자가 다시 보낼 수 있다 */
  'failed',
] as const

export type DeliveryState = (typeof deliveryStates)[number]

/** 어느 상태에서 어디로 갈 수 있나 */
const allowedNext: Record<DeliveryState, readonly DeliveryState[]> = {
  draft: ['sending', 'pending'],
  sending: ['delivered', 'failed', 'pending'],
  pending: ['sending'],
  delivered: ['read'],
  // 끝 상태. 여기서는 어디로도 못 간다.
  read: [],
  failed: ['pending'],
}

export function canTransition(from: DeliveryState, to: DeliveryState): boolean {
  return allowedNext[from].includes(to)
}

export function transition(
  from: DeliveryState,
  to: DeliveryState,
): Result<DeliveryState, DomainError> {
  if (from === to) {
    // 같은 신호가 두 번 오는 건 흔하다. 오류로 보지 않고 그대로 둔다.
    return ok(from)
  }

  if (!canTransition(from, to)) {
    return err(
      domainError('invalid-transition', `${from} 에서 ${to} 로 갈 수 없다`, 'delivery'),
    )
  }

  return ok(to)
}

/** 더 이상 바뀌지 않는 상태인가 */
export function isFinal(state: DeliveryState): boolean {
  return allowedNext[state].length === 0
}

/** 연결이 돌아오면 내보내야 하는 상태인가 */
export function isWaitingToSend(state: DeliveryState): boolean {
  return state === 'pending' || state === 'draft'
}

/** 상대에게 닿았는가 */
export function hasReachedPeer(state: DeliveryState): boolean {
  return state === 'delivered' || state === 'read'
}
