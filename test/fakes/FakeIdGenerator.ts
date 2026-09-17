import { makeUlid } from '@test/support/factories'
import type { IdGenerator } from '@/domain/shared/IdGenerator'

/**
 * 정해진 값이 나오는 식별자 생성기.
 *
 * 실제와 같은 ULID 형식을 만든다. 임의의 문자열을 쓰면 형식 검사를
 * 통과하지 못해 실제와 다른 경로를 타게 된다.
 */
export class FakeIdGenerator implements IdGenerator {
  private counter = 0
  readonly issued: string[] = []

  constructor(private readonly startMillis = 1758000000000) {}

  next(): string {
    const id = makeUlid(this.startMillis + this.counter, this.counter)
    this.counter += 1
    this.issued.push(id)
    return id
  }
}
