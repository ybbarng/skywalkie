# T05 — 응용: 약속과 메시지 절차

**단계** 핵심 · **상태** 대기 · **먼저** T03, T04

## 목표

"메시지를 보낸다"는 절차를 적는다. 어떤 길로 보내는지는 모른 채로.

## 근거

[03-architecture.md](../03-architecture.md) application 규칙 · [05-messaging-spec.md](../05-messaging-spec.md) 3장

## 할 일

### 바깥에 요구하는 약속

```
src/application/ports/
  MessageTransport.ts       메시지를 나르는 무언가
  ConversationRepository.ts 대화를 보관하는 무언가
  PeerDiscovery.ts          상대를 찾는 무언가
  Vibration.ts              진동시키는 무언가
```

`MessageTransport`가 핵심이다. Wi-Fi든 블루투스든 웹이든 이 약속을 지킨다.

```ts
interface MessageTransport {
  readonly kind: LinkKind
  send(envelope: Envelope): Promise<Result<void>>
  onReceive(handler: (e: Envelope) => void): Unsubscribe
  onStateChange(handler: (s: ConnectionState) => void): Unsubscribe
  connect(): Promise<Result<void>>
  disconnect(): Promise<void>
}
```

### 절차

```
src/application/messaging/
  SendMessage.ts
  ReceiveMessage.ts
  LoadConversation.ts
  MarkAsRead.ts
  FlushPendingMessages.ts
```

**`SendMessage`의 순서가 중요하다.**

```
1. Message를 만든다 (실패하면 여기서 끝)
2. 저장한다                        ← 먼저 저장
3. 보낸다
4. 결과에 따라 상태를 고친다
```

반대로 하면 전송 도중 앱이 죽었을 때 메시지가 사라진다. 저장을 먼저 하면 최악의 경우에도 "보내려던 것"이 남는다.

전송에 실패하면 `pending`으로 둔다. 실패로 두지 않는다. 연결이 돌아오면 자동으로 나가야 하기 때문이다.

**`ReceiveMessage`는 중복을 걸러낸다.** 이미 있는 id면 조용히 버리고 받았다는 답만 다시 보낸다. 답이 유실돼서 상대가 다시 보낸 경우이기 때문이다.

**`FlushPendingMessages`는 순서를 지킨다.** 쌓인 순번 순서대로 하나씩 내보낸다. 한꺼번에 병렬로 보내면 순서가 뒤바뀐다.

### 가짜 부품

```
test/fakes/
  FakeMessageTransport.ts
  FakeConversationRepository.ts
  FakeClock.ts
  FakeIdGenerator.ts
```

## 테스트

- 전송이 실패해도 메시지가 저장되어 있다
- 저장이 실패하면 전송을 시도하지 않는다
- 같은 메시지를 두 번 받아도 하나만 남고, 받았다는 답은 두 번 간다
- 쌓인 메시지가 순번 순서대로 나간다
- 5번 실패하면 멈추고 `failed`가 된다
- 다시 보내는 간격이 1, 2, 4, 8, 16, 30초로 늘어난다 (`FakeClock`으로 시간을 돌려 확인)

## 끝난 걸 어떻게 아는가

- [ ] 응용 계층이 React와 Expo를 import 하지 않는다
- [ ] 적용 범위 90% 이상
- [ ] 진짜 Wi-Fi 없이 모든 테스트가 돈다
