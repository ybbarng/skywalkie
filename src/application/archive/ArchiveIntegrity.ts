import { type DomainError, domainError } from '@/domain/shared/DomainError'
import { err, ok, type Result } from '@/domain/shared/Result'
import type { Hasher } from '../ports/FileStore'
import type { ArchiveIntegrity } from './ArchiveFormat'

/**
 * 파일이 온전한지 알아보는 값.
 *
 * **막으려는 것은 파일이 잘렸는데 모르고 넘어가는 일이다.** 절반만
 * 되살아났는데 다 됐다고 하면, 사라진 절반을 영영 못 찾는다. 아이폰
 * 앱을 다시 깐 뒤에는 되돌릴 파일 말고 남은 게 없다.
 *
 * 메시지 id 를 정렬해 이어 요약한다. 정렬하는 이유는 **꺼낸 순서가
 * 달라도 같은 값이 나와야** 하기 때문이다. 순서가 값에 영향을 주면
 * 멀쩡한 파일을 거절하게 된다.
 */

/** 요약하기 전의 글. 이 모양을 바꾸면 예전 파일을 못 읽는다 */
export function checksumInput(ids: readonly string[]): string {
  return [...ids].sort().join('\n')
}

export async function computeIntegrity(
  hasher: Hasher,
  ids: readonly string[],
): Promise<Result<ArchiveIntegrity, DomainError>> {
  const digest = await hasher.sha256(checksumInput(ids))
  if (!digest.ok) return digest

  const sorted = [...ids].sort()

  return ok({
    messageCount: ids.length,
    checksum: `sha256:${digest.value}`,
    firstMessageId: sorted[0] ?? null,
    lastMessageId: sorted[sorted.length - 1] ?? null,
  })
}

/**
 * 적혀 있던 값과 실제로 읽은 것을 맞춰본다.
 *
 * 어긋나면 **멈춘다.** 반쯤 되돌리고 나서 알려주면 이미 늦다.
 * 무엇이 어긋났는지 사람이 읽을 수 있게 적어 돌려준다.
 */
export function compareIntegrity(
  claimed: ArchiveIntegrity,
  actual: ArchiveIntegrity,
): Result<void, DomainError> {
  if (claimed.messageCount !== actual.messageCount) {
    return err(
      domainError(
        'invalid-value',
        `파일에는 ${claimed.messageCount}건이라고 적혀 있는데 ${actual.messageCount}건만 들어 있어요. 파일이 잘린 것 같아요`,
        'integrity',
      ),
    )
  }

  // 꺼내는 쪽이 중간에 멈췄을 때를 잡는다.
  //
  // 이 경우는 파일 자체는 멀쩡하다. 적힌 건수와 든 건수가 맞고
  // 검증값도 맞는다. **꺼내다 만 상태 그대로 앞뒤가 맞기 때문이다.**
  // 저장소가 "이만큼 있다"고 했던 수와 견주는 것만이 단서다.
  if (claimed.sourceCount !== undefined && claimed.sourceCount > claimed.messageCount) {
    const missing = claimed.sourceCount - claimed.messageCount
    return err(
      domainError(
        'invalid-value',
        `꺼내는 도중에 멈춘 파일이에요. ${missing}건이 빠져 있어요. 다시 꺼내주세요`,
        'integrity',
      ),
    )
  }

  if (claimed.checksum !== actual.checksum) {
    return err(
      domainError(
        'invalid-value',
        '파일이 조금 달라졌어요. 옮기는 중에 망가졌을 수 있어요',
        'integrity',
      ),
    )
  }

  return ok(undefined)
}
