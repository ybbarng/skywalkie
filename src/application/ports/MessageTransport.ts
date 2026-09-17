import type { ConnectionState } from '@/domain/connection/ConnectionState'
import type { LinkKind } from '@/domain/connection/LinkKind'
import type { LinkQuality } from '@/domain/connection/LinkQuality'
import type { DomainError } from '@/domain/shared/DomainError'
import type { Result } from '@/domain/shared/Result'
import type { Envelope } from './Envelope'

/**
 * 메시지를 나르는 무언가.
 *
 * **이 약속이 이 앱 구조의 중심이다.** Wi-Fi 든 블루투스든 웹이든,
 * 심지어 테스트에서 쓰는 가짜든 전부 이 모양을 지킨다. 그래서 위층은
 * 지금 어느 길로 가는지 몰라도 된다.
 *
 * 연결 방식을 새로 붙일 때 고치는 곳은 여기를 구현하는 파일 하나와
 * 조립하는 곳뿐이다. 화면과 도메인은 한 줄도 안 바뀐다.
 * (docs/03-architecture.md)
 */
export interface MessageTransport {
  readonly kind: LinkKind

  /** 연결을 연다. 상대를 찾는 일까지 포함한다 */
  connect(): Promise<Result<void, DomainError>>

  /** 연결을 놓는다. 여러 번 불러도 안전해야 한다 */
  disconnect(): Promise<void>

  /**
   * 봉투를 보낸다.
   *
   * 실패를 예외로 던지지 않는다. 연결이 끊기는 건 이 앱에서 예외가 아니라
   * 늘 있는 일이라, 부르는 쪽이 반드시 다루게 만든다.
   */
  send(envelope: Envelope): Promise<Result<void, DomainError>>

  /** 봉투가 오면 알려준다 */
  onReceive(handler: (envelope: Envelope) => void): Unsubscribe

  /** 연결 상태가 바뀌면 알려준다 */
  onStateChange(handler: (state: ConnectionState) => void): Unsubscribe

  /** 지금 상태 */
  currentState(): ConnectionState

  /** 지금 연결이 얼마나 좋은가. 길을 고를 때 쓴다 */
  quality(): LinkQuality
}

/** 더 이상 알림을 받지 않겠다고 할 때 부른다 */
export type Unsubscribe = () => void
