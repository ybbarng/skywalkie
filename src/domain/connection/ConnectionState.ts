import { type DomainError, domainError } from '../shared/DomainError'
import { err, ok, type Result } from '../shared/Result'
import type { LinkKind } from './LinkKind'

/**
 * 연결이 지금 어느 단계인가.
 *
 * ```
 *   idle ──▶ searching ──▶ handshaking ──▶ connected
 *              ▲   ▲            │              │
 *              │   └── 실패 ────┘              │
 *              │                               │
 *              └─── 끊김 ──────────────────────┤
 *                                              │
 *                          switching ◀─────────┘ (더 좋은 길 발견)
 *                              │
 *                              └──▶ connected  (새 길이 열린 뒤에만)
 * ```
 *
 * 가장 중요한 규칙: **`switching` 에서 `connected` 로 갈 때는 새 길이
 * 반드시 있어야 한다.** 새 길 없이 옛 길을 놓으면 그 순간의 메시지가 사라진다.
 * (docs/04-transport-spec.md 6장)
 */

export const connectionPhases = [
  /** 아직 시작하지 않았거나 사용자가 껐다 */
  'idle',
  /** 상대를 찾는 중 */
  'searching',
  /** 찾았고 인사하는 중 */
  'handshaking',
  /** 대화할 수 있다 */
  'connected',
  /** 더 좋은 길로 옮기는 중. 옛 길은 아직 살아 있다 */
  'switching',
] as const

export type ConnectionPhase = (typeof connectionPhases)[number]

const allowedNext: Record<ConnectionPhase, readonly ConnectionPhase[]> = {
  idle: ['searching'],
  searching: ['handshaking', 'idle'],
  handshaking: ['connected', 'searching', 'idle'],
  connected: ['switching', 'searching', 'idle'],
  switching: ['connected', 'searching', 'idle'],
}

export class ConnectionState {
  private constructor(
    readonly phase: ConnectionPhase,
    /** 지금 쓰는 길. 아직 안 붙었으면 null */
    readonly link: LinkKind | null,
    /** 갈아타는 중일 때 옮겨 갈 길 */
    readonly pendingLink: LinkKind | null,
    /** 끊긴 뒤 몇 번째 다시 시도인가 */
    readonly retryAttempt: number,
  ) {}

  static idle(): ConnectionState {
    return new ConnectionState('idle', null, null, 0)
  }

  static connected(link: LinkKind): ConnectionState {
    return new ConnectionState('connected', link, null, 0)
  }

  /**
   * 상대를 찾기 시작한다. 이미 찾는 중이어도 다시 부를 수 있다.
   *
   * 찾는 중에 또 부르는 건 "다시 시도"라는 뜻이라 시도 횟수가 오른다.
   * 그래서 여기만 `moveTo` 의 "같은 상태면 그대로" 규칙을 따르지 않는다.
   * 이 값으로 다음 시도까지 얼마나 기다릴지 정한다.
   */
  startSearching(): Result<ConnectionState, DomainError> {
    if (this.phase !== 'searching' && !allowedNext[this.phase].includes('searching')) {
      return err(
        domainError(
          'invalid-transition',
          `${this.phase} 에서 searching 으로 갈 수 없다`,
          'phase',
        ),
      )
    }

    // 붙어 있다가 끊긴 것이면 처음부터 센다
    const attempt = this.phase === 'connected' ? 1 : this.retryAttempt + 1
    return ok(new ConnectionState('searching', null, null, attempt))
  }

  startHandshake(link: LinkKind): Result<ConnectionState, DomainError> {
    return this.moveTo(
      'handshaking',
      state => new ConnectionState(state, link, null, this.retryAttempt),
    )
  }

  /** 인사를 마쳤다 */
  establish(): Result<ConnectionState, DomainError> {
    if (this.phase === 'switching') {
      if (this.pendingLink === null) {
        // 새 길 없이 갈아타기를 끝내면 그 순간의 메시지가 사라진다
        return err(
          domainError(
            'invalid-transition',
            '옮겨 갈 길이 정해지지 않았는데 갈아타기를 끝낼 수 없다',
            'pendingLink',
          ),
        )
      }
      return ok(new ConnectionState('connected', this.pendingLink, null, 0))
    }

    if (this.link === null) {
      return err(domainError('invalid-transition', '길이 없는데 연결될 수 없다', 'link'))
    }

    return this.moveTo(
      'connected',
      state => new ConnectionState(state, this.link, null, 0),
    )
  }

  /** 더 좋은 길을 찾아 옮기기 시작한다. 옛 길은 아직 놓지 않는다 */
  startSwitching(to: LinkKind): Result<ConnectionState, DomainError> {
    if (this.link === to) {
      return err(domainError('invalid-value', '이미 쓰고 있는 길이다', 'pendingLink'))
    }

    return this.moveTo(
      'switching',
      state => new ConnectionState(state, this.link, to, this.retryAttempt),
    )
  }

  /** 갈아타기에 실패했다. 옛 길로 돌아간다 */
  abandonSwitch(): Result<ConnectionState, DomainError> {
    if (this.phase !== 'switching') {
      return err(domainError('invalid-transition', '갈아타는 중이 아니다', 'phase'))
    }

    if (this.link === null) {
      // 돌아갈 옛 길이 없으니 처음부터 다시 찾는다
      return this.startSearching()
    }

    return ok(new ConnectionState('connected', this.link, null, this.retryAttempt))
  }

  /** 연결이 끊겼다 */
  lose(): Result<ConnectionState, DomainError> {
    return this.startSearching()
  }

  /** 사용자가 껐다 */
  stop(): Result<ConnectionState, DomainError> {
    return this.moveTo('idle', () => ConnectionState.idle())
  }

  isUsable(): boolean {
    // 갈아타는 중에도 옛 길이 살아 있어서 메시지를 보낼 수 있다
    return this.phase === 'connected' || this.phase === 'switching'
  }

  isSettled(): boolean {
    return this.phase === 'connected'
  }

  private moveTo(
    next: ConnectionPhase,
    build: (phase: ConnectionPhase) => ConnectionState,
  ): Result<ConnectionState, DomainError> {
    if (this.phase === next) return ok(this)

    if (!allowedNext[this.phase].includes(next)) {
      return err(
        domainError(
          'invalid-transition',
          `${this.phase} 에서 ${next} 로 갈 수 없다`,
          'phase',
        ),
      )
    }

    return ok(build(next))
  }
}

export function canTransition(from: ConnectionPhase, to: ConnectionPhase): boolean {
  return from === to || allowedNext[from].includes(to)
}

/**
 * 다음 시도까지 기다릴 시간.
 *
 * 1, 2, 4, 8, 16, 30초로 늘린다. 계속 시도하면 배터리가 준다.
 * (docs/04-transport-spec.md 2.6)
 */
export const MAX_RETRY_DELAY_MS = 30_000

export function retryDelayMillis(attempt: number): number {
  if (attempt <= 0) return 0
  const doubled = 2 ** (attempt - 1) * 1000
  return Math.min(doubled, MAX_RETRY_DELAY_MS)
}
