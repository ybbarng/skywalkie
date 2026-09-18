import { openDatabaseAsync } from 'expo-sqlite'
import type { ConversationRepository } from '@/application/ports/ConversationRepository'
import type { MessageTransport } from '@/application/ports/MessageTransport'
import type { DomainError } from '@/domain/shared/DomainError'
import { err, ok, type Result } from '@/domain/shared/Result'
import { ExpoSqlDatabase } from '@/infrastructure/persistence/ExpoSqlDatabase'
import { migrate } from '@/infrastructure/persistence/migrations'
import { SqliteConversationRepository } from '@/infrastructure/persistence/SqliteConversationRepository'
import { CompositeTransport } from '@/infrastructure/transport/CompositeTransport'
import type { ConnectionRole } from '@/infrastructure/transport/wifi/DiscoveryPlan'
import { WifiLink } from '@/infrastructure/transport/wifi/WifiLink'

/**
 * 어떤 구현을 끼울지 정하는 유일한 곳.
 *
 * **이 파일만이 "지금 Wi-Fi 를 쓸지 블루투스를 쓸지"를 안다.** 나머지
 * 코드는 약속만 보고 일한다. 그래서 길을 하나 더 붙일 때 고치는 곳이
 * 여기 한 줄이다. (docs/03-architecture.md)
 */

export interface Container {
  readonly repository: ConversationRepository
  readonly transport: MessageTransport
  dispose(): Promise<void>
}

let current: Container | null = null

export async function createContainer(
  options: ContainerOptions,
): Promise<Result<Container, DomainError>> {
  if (current !== null) return ok(current)

  const raw = await openDatabaseAsync('skywalkie.db').catch(() => null)
  if (raw === null) {
    return err({
      code: 'not-found',
      detail: '대화를 담을 곳을 열지 못했다',
      field: 'database',
    })
  }

  const db = new ExpoSqlDatabase(raw)

  const migrated = await migrate(db)
  if (!migrated.ok) return migrated

  const repository = new SqliteConversationRepository(db)

  // 지금은 Wi-Fi 하나뿐이다. 블루투스(T20)와 웹(T21)이 여기 붙는다.
  //
  // WifiLink 가 찾기와 다시 붙기를 맡는다. TcpMessageTransport 를 그대로
  // 쓰면 붙는 쪽이 상대 주소를 몰라 아무것도 못 한다.
  const transport = new CompositeTransport([
    new WifiLink(options.role, {
      peerAddress: options.peerAddress,
      pairingCode: options.pairingCode,
    }),
  ])

  const container: Container = {
    repository,
    transport,
    async dispose() {
      await transport.disconnect()
      await db.close()
      current = null
    },
  }

  current = container
  return ok(container)
}

export interface ContainerOptions {
  readonly role: ConnectionRole
  /** 이미 아는 주소. 코드로 연결하기에서 넘어온다 */
  readonly peerAddress?: string
  /** 우리 둘만의 코드. 외칠 때 같이 보낸다 */
  readonly pairingCode?: string
}

/** 이미 만들어 둔 것. 없으면 null */
export function currentContainer(): Container | null {
  return current
}
