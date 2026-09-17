import { ulid } from 'ulid'
import type { IdGenerator } from '@/domain/shared/IdGenerator'

/**
 * 실제 ULID 를 만든다.
 *
 * 앞 10자리가 시각이라 정렬만 하면 시간순이 되고, 두 기기가 각자 만들어도
 * 겹치지 않는다. 그 성질 덕에 보관 파일을 합칠 때 중복 판단 기준으로 쓴다.
 */
export const ulidGenerator: IdGenerator = {
  next: () => ulid(),
}

/**
 * 상대 식별자와 여섯 자리 코드를 만든다.
 *
 * 앱을 처음 켤 때 한 번만 부른다. 이 값이 사라지면 상대와 다시
 * 짝을 맺어야 한다.
 */
export function makePeerId(): string {
  // ULID 를 그대로 쓴다. 26자에 겹치지 않고, 영문과 숫자뿐이라
  // 파일 이름과 주소에 그대로 들어간다.
  return ulid()
}
