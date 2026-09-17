import { type DomainError, domainError } from '../shared/DomainError'
import { err, ok, type Result } from '../shared/Result'
import type { CharacterId } from './Character'
import type { PeerId } from './PeerId'

/**
 * 상대.
 *
 * 쓰는 사람이 둘뿐이라 이 앱에는 "나"와 "상대" 하나씩만 있다.
 * 친구 목록도, 추가하기도 없다.
 */

const MAX_NAME_LENGTH = 20

export class Peer {
  private constructor(
    readonly id: PeerId,
    readonly displayName: string,
    readonly character: CharacterId,
    /** 마지막으로 소식을 들은 시각. 한 번도 못 봤으면 null */
    readonly lastSeenAt: Date | null,
    /** 상대 앱이 지금 앞에 떠 있는가 */
    readonly isForeground: boolean,
  ) {}

  static create(input: CreatePeerInput): Result<Peer, DomainError> {
    const name = input.displayName.trim()

    if (name.length === 0) {
      return err(domainError('empty', '이름이 비어 있다', 'displayName'))
    }

    if (name.length > MAX_NAME_LENGTH) {
      return err(
        domainError(
          'too-long',
          `이름은 ${MAX_NAME_LENGTH}자까지 쓸 수 있다`,
          'displayName',
        ),
      )
    }

    return ok(new Peer(input.id, name, input.character, null, false))
  }

  /** 상대에게서 소식이 왔다 */
  seenAt(when: Date): Result<Peer, DomainError> {
    if (Number.isNaN(when.getTime())) {
      return err(domainError('invalid-value', '시각이 올바르지 않다', 'lastSeenAt'))
    }

    // 늦게 도착한 옛 신호가 시각을 되돌리지 않게 한다
    const next =
      this.lastSeenAt === null || when > this.lastSeenAt ? when : this.lastSeenAt

    return ok(
      new Peer(this.id, this.displayName, this.character, next, this.isForeground),
    )
  }

  /** 상대 앱이 앞으로 나왔거나 뒤로 갔다 */
  withForeground(isForeground: boolean): Peer {
    return new Peer(
      this.id,
      this.displayName,
      this.character,
      this.lastSeenAt,
      isForeground,
    )
  }

  withCharacter(character: CharacterId): Peer {
    return new Peer(
      this.id,
      this.displayName,
      character,
      this.lastSeenAt,
      this.isForeground,
    )
  }

  rename(displayName: string): Result<Peer, DomainError> {
    const validated = Peer.create({
      id: this.id,
      displayName,
      character: this.character,
    })
    if (!validated.ok) return validated

    // 이름만 바꾸고 나머지(마지막으로 본 시각 등)는 지킨다
    return ok(
      new Peer(
        this.id,
        validated.value.displayName,
        this.character,
        this.lastSeenAt,
        this.isForeground,
      ),
    )
  }

  /**
   * 화면에 보여줄 상태.
   *
   * 캐릭터 표정이 이 값을 따라간다. 글씨를 안 읽어도 상태를 알 수 있어야 한다.
   */
  presence(now: Date, staleAfterMillis: number): PeerPresence {
    if (this.lastSeenAt === null) return 'never-seen'

    const elapsed = now.getTime() - this.lastSeenAt.getTime()
    if (elapsed > staleAfterMillis) return 'away'

    return this.isForeground ? 'here' : 'background'
  }
}

export type PeerPresence =
  /** 한 번도 연결된 적 없다 */
  | 'never-seen'
  /** 앱을 보고 있다 */
  | 'here'
  /** 연결은 살아 있지만 앱이 뒤에 있다. 캐릭터가 잔다 */
  | 'background'
  /** 한동안 소식이 없다 */
  | 'away'

export interface CreatePeerInput {
  readonly id: PeerId
  readonly displayName: string
  readonly character: CharacterId
}

export const peerLimits = { maxNameLength: MAX_NAME_LENGTH } as const
