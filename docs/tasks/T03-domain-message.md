# T03 — 도메인: 메시지와 대화

**단계** 핵심 · **상태** 완료 · **먼저** T01

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

- `DeliveryState`의 **모든 전이 조합**을 표로 만들어 확인한다. 6×6이라 36가지다
- 같은 id를 두 번 넣으면 거절된다
- 순번 빈틈을 정확히 찾는다 (빈틈 없음, 하나 빔, 여러 개 빔, 앞이 빔)
- 4000자를 넘는 글은 거절된다
- 낙서의 좌표가 0~1을 벗어나면 거절된다

## 끝난 걸 어떻게 아는가

- [x] `src/domain`의 어떤 파일도 바깥을 import 하지 않는다 (`check:deps` 통과)
- [x] 도메인 테스트 적용 범위가 95% 이상이다 (99.4%)
- [x] 전이표 36가지가 전부 시험된다
- [x] 잘못된 입력으로 `Message`를 만들 방법이 없다

## 하면서 알게 된 것

### `Conversation` 이 메시지를 들고 있지 않게 했다

명세에 "전부를 메모리에 안고 있지 않는다"고 적었는데, 실제로 만들다 보니
무엇을 들고 있어야 하는지가 분명해졌다. 세 가지면 충분하다.

- 최근 본 식별자 4096개 — 중복을 저장소까지 가지 않고 걸러낸다
- 사람별 순번 진행 상황 — 빈틈을 찾는다
- 읽지 않은 개수

식별자를 4096개로 제한한 건 메모리 때문이다. 잊은 뒤에 같은 메시지가
또 와도 저장소의 기본 키가 막아준다. 여기서 거르는 건 최적화일 뿐이다.

### 순번을 되살리는 걸 빠뜨릴 뻔했다

앱을 껐다 켜면 `nextOutgoingSeq` 가 1로 돌아간다. 그러면 상대 쪽에서
이미 본 순번이라 메시지를 버린다. 저장소에서 되살린 내 메시지를 보고
그보다 뒤에서 이어가게 했고, 테스트로 고정했다.

### 시각을 두 개 두길 잘했다

받은 시각으로 줄 세우는 이유가 시차를 넘는 비행에서 분명해진다.
상대 폰이 먼저 시간대를 바꾸면 보낸 시각이 내 시각보다 앞설 수 있다.
`clockSkewMillis()` 가 음수가 나오는 경우를 테스트로 남겼다.

### 다음 카드로 넘긴 것

`PeerId` 는 [T04](./T04-domain-connection.md) 소속이지만 `Message` 가
필요로 해서 여기서 만들었다. `Peer` 엔티티와 캐릭터는 T04 에서 붙인다.
