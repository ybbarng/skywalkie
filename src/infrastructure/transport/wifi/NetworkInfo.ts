import * as Network from 'expo-network'
import { type DomainError, domainError } from '@/domain/shared/DomainError'
import { err, ok, type Result } from '@/domain/shared/Result'
import { type ConnectionRole, roleFor } from './DiscoveryPlan'
import { type Ipv4, isPrivateAddress, parseIpv4 } from './NetworkAddress'

/**
 * 내가 지금 어느 망에 있나.
 *
 * `expo-network` 를 감싸는 얇은 층이다. 판단은 전부 `NetworkAddress` 와
 * `DiscoveryPlan` 이 하고, 여기서는 주소를 받아오기만 한다.
 */
export interface NetworkSnapshot {
  readonly self: Ipv4
  readonly role: ConnectionRole
  /** 핫스팟 같은 사설망에 붙어 있는가 */
  readonly onPrivateNetwork: boolean
}

export async function readNetwork(): Promise<Result<NetworkSnapshot, DomainError>> {
  let address: string
  try {
    address = await Network.getIpAddressAsync()
  } catch (cause) {
    return err(
      domainError(
        'not-found',
        `내 주소를 알아내지 못했다: ${cause instanceof Error ? cause.message : cause}`,
        'network',
      ),
    )
  }

  const self = parseIpv4(address)
  if (!self.ok) return self

  // 0.0.0.0 은 아직 주소를 못 받았다는 뜻이다.
  // Wi-Fi 를 방금 켰을 때 잠깐 이 값이 나온다.
  if (self.value.text === '0.0.0.0') {
    return err(domainError('not-found', '아직 Wi-Fi 주소를 받지 못했다', 'network'))
  }

  return ok({
    self: self.value,
    role: roleFor(self.value),
    onPrivateNetwork: isPrivateAddress(self.value),
  })
}

/**
 * 주소를 받을 때까지 기다린다.
 *
 * Wi-Fi 를 켜거나 핫스팟에 붙은 직후에는 주소가 없다. 사용자가 설정 화면에서
 * 돌아온 순간 바로 확인하면 아직 못 받은 상태라 실패한다.
 */
export async function waitForNetwork(
  options: WaitOptions,
): Promise<Result<NetworkSnapshot, DomainError>> {
  const deadline = options.now() + options.timeoutMs

  for (;;) {
    const snapshot = await readNetwork()
    if (snapshot.ok && snapshot.value.onPrivateNetwork) return snapshot

    if (options.now() >= deadline) {
      return snapshot.ok
        ? err(domainError('not-found', '사설망에 붙지 않았다', 'network'))
        : snapshot
    }

    await options.sleep(options.pollIntervalMs)
  }
}

export interface WaitOptions {
  readonly timeoutMs: number
  readonly pollIntervalMs: number
  now(): number
  sleep(ms: number): Promise<void>
}
