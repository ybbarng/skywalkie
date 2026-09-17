/**
 * 식별자를 주입받기 위한 약속.
 *
 * 만드는 값은 ULID다. 시각이 앞에 들어가 있어서 정렬하면 시간순이 되고,
 * 두 기기가 각자 만들어도 겹치지 않는다. 그래서 내보낸 파일을 합칠 때
 * 같은 메시지인지 판단하는 기준으로 쓸 수 있다. (docs/05-messaging-spec.md 1장)
 *
 * 실제 구현은 infrastructure 에 둔다. 도메인은 만드는 방법을 몰라야
 * 테스트에서 정해진 값이 나오게 할 수 있다.
 */
export interface IdGenerator {
  next(): string
}
