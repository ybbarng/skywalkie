# T03 — 도메인: 메시지와 대화

**단계** 핵심 · **상태** 대기 · **먼저** T01

## 목표

"메시지란 무엇인가"를 코드로 적는다. 아무것도 import 하지 않는 순수한 층이라 컴퓨터에서 전부 시험할 수 있다.

## 근거

[05-messaging-spec.md](../05-messaging-spec.md) 1~4장 · [03-architecture.md](../03-architecture.md) domain 규칙

## 할 일

### 값 객체

```
src/domain/shared/
  Result.ts         성공/실패를 값으로. 예외를 던지지 않는다
  DomainError.ts    무엇이 잘못됐는지
  Clock.ts          시간을 주입받기 위한 약속
  IdGenerator.ts    ULID를 주입받기 위한 약속

src/domain/message/
  MessageId.ts      ULID를 감싼 값. 아무 문자열이나 들어오지 못한다
  MessageContent.ts Text | Doodle | Nudge | System
  DeliveryState.ts  상태와 전이 규칙
  Message.ts        엔티티
  Conversation.ts   애그리거트 루트
```

### 지켜야 할 것

**`Message`는 올바른 상태로만 태어난다.** 생성자를 감추고 `compose`를 통해서만 만들게 한다. 검사를 통과 못 하면 `Message`가 존재하지 않는다.

```ts
static compose(input: ComposeInput): Result<Message>
```

**상태는 뒤로 가지 않는다.** `DeliveryState`가 직접 막는다.

```ts
전이표:
  draft    → sending, pending
  sending  → delivered, failed, pending
  pending  → sending
  delivered→ read
  failed   → pending          (다시 보내기)
  read     → (없음)           ← 끝 상태
```

읽음에서 어디로도 못 간다. 늦게 도착한 옛 신호가 화면을 흔드는 걸 막는다.

**`Conversation`이 중복과 빈틈을 판단한다.**

```ts
accept(message): Result<Conversation>    이미 있는 id면 거절
missingSeqs(peerId): number[]            "3, 4, 6이 왔으니 5가 없다"
unreadCount(): number
```

`Conversation`이 모든 메시지를 안고 있지 않는다. 판단에 필요한 최소한(본 id의 집합, 순번의 범위)만 가진다. 메시지가 수만 개가 되어도 문제없어야 한다.

**시간과 식별자를 직접 만들지 않는다.** `Clock`과 `IdGenerator`를 받아 쓴다. 그래야 테스트에서 시간을 돌리고 같은 값을 재현할 수 있다.

## 테스트

[09-testing.md](../09-testing.md)의 도메인 항목을 전부 만든다. 특히:

- `DeliveryState`의 **모든 전이 조합**을 표로 만들어 확인한다. 7×7이라 49가지다
- 같은 id를 두 번 넣으면 거절된다
- 순번 빈틈을 정확히 찾는다 (빈틈 없음, 하나 빔, 여러 개 빔, 앞이 빔)
- 4000자를 넘는 글은 거절된다
- 낙서의 좌표가 0~1을 벗어나면 거절된다

## 끝난 걸 어떻게 아는가

- [ ] `src/domain`의 어떤 파일도 바깥을 import 하지 않는다 (`check:deps` 통과)
- [ ] 도메인 테스트 적용 범위가 95% 이상이다
- [ ] 전이표 49가지가 전부 시험된다
- [ ] 잘못된 입력으로 `Message`를 만들 방법이 없다
