# T09 — 연결 상태와 자동 재연결

**단계** 연결 · **상태** 완료 · **먼저** T05, T08

## 목표

여러 길을 하나로 묶어 관리한다. 길이 바뀌어도 **위층은 아무것도 모른다.** 메시지를 하나도 흘리지 않는다.

## 근거

[04-transport-spec.md](../04-transport-spec.md) 6장 · [03-architecture.md](../03-architecture.md)

## 할 일

```
src/infrastructure/transport/
  CompositeTransport.ts     여러 길을 하나처럼 보이게
src/application/connection/
  EstablishLink.ts
  SelectBestLink.ts
  MonitorLink.ts
```

### 하나처럼 보이게 하기

`CompositeTransport`도 `MessageTransport` 약속을 지킨다. 그래서 위층은 이게 여러 길을 묶은 것인지 모른다.

```ts
new CompositeTransport([
  new TcpMessageTransport(),   // 먼저
  new BleMessageTransport(),   // 안 되면
])
```

나중에 길을 하나 더 붙여도 이 줄만 고치면 된다.

### 갈아탈 때 지키는 것

**이 카드에서 가장 중요한 부분이다.**

```
1. 새 길을 연다           (옛 길은 아직 살아 있다)
2. 새 길에서 인사를 마친다
3. 보낼 것을 새 길로 돌린다
4. 그제서야 옛 길을 놓는다
```

순서를 지키지 않으면 갈아타는 순간의 메시지가 사라진다. 갈아타는 동안 보낸 것은 대기 줄에 쌓았다가 3번에서 내보낸다.

### 다시 붙는 규칙

- 간격을 1, 2, 4, 8, 16, 30초로 늘린다. 계속 시도하면 배터리가 준다
- 같은 간격을 두 번 쓰지 않도록 약간의 무작위를 섞는다. 양쪽이 동시에 시도해 계속 어긋나는 걸 막는다
- 사용자가 직접 누르면 간격을 되감고 즉시 시도한다

### 상태 알리기

화면 맨 위 띠에 쓸 정보를 내보낸다.

```ts
{ state, linkKind, quality, peerName, lastSeenAt, pendingCount }
```

## 테스트

`LinkedTransportPair`를 만든다. 두 개의 가짜 연결을 서로 묶어 한쪽에 넣은 것이 다른 쪽으로 나오게 하는 도구다. **[09-testing.md](../09-testing.md) 5장의 핵심 도구이고 이 카드에서 만든다.**

```ts
const [a, b] = linkedTransportPair({
  latencyMs: 50,
  dropRate: 0.1,
  reorder: true,
})
```

시험할 것:
- 갈아타는 동안 보낸 메시지가 하나도 안 사라진다
- 새 길이 안 열리면 옛 길을 놓지 않는다
- 끊겼다 붙으면 놓친 것이 채워진다
- 양쪽이 동시에 보내도 각자의 순서가 유지된다
- 100통을 연달아 보내도 순서가 유지된다
- 10%를 일부러 잃어버려도 결국 전부 도착한다

## 끝난 걸 어떻게 아는가

- [x] `linkedTransportPair` 로 두 기기 대화 전 과정이 시험된다
- [x] 갈아탈 때 메시지 유실이 0건이다
- [x] 위층 코드에 `wifi` 나 `ble` 이라는 말이 나오지 않는다

## 하면서 알게 된 것

### 통합 테스트가 진짜 버그를 잡았다

**"양쪽이 동시에 보내도 각자의 순서가 유지된다"** 테스트가 실패했다.
스무 통을 보냈는데 한 통만 도착했다.

원인은 대화 상태를 다루는 방식이었다.

```ts
const next = await doSomething(this.conversation)
this.conversation = next            // ← 여기
```

`Conversation` 은 불변 값이라 바꿀 때마다 새것이 나온다. 그런데 보내기와
받기가 동시에 일어나면 **둘 다 같은 옛 값을 읽고** 각자 새 값을 만들어
덮어쓴다. 나중에 끝난 쪽이 이긴다. 그러면

- 받은 메시지가 대화에서 사라지거나
- 내 순번이 되돌아가 상대가 중복으로 보고 메시지를 버린다

이 앱은 **양쪽이 동시에 말하는 게 흔해서** 반드시 생기는 문제다.
비행기에서 발견했다면 손쓸 방법이 없었다.

`SerialQueue` 를 만들어 대화 상태를 건드리는 일을 한 줄에 세웠다.
실제 화면 코드도 같은 것을 쓴다.

### 갈아타는 순서를 상태 기계가 강제한다

[T04](./T04-domain-connection.md) 에서 `switching → connected` 로 갈 때
새 길이 반드시 있어야 하도록 만들어 두었는데, 여기서 그 값을 했다.
순서를 어기는 코드를 쓰면 상태 전이가 실패해서 바로 드러난다.

`CompositeTransport` 는 옮긴 뒤 **옛 길의 알림을 끊는다.** 안 그러면
옛 길이 "나 끊겼어"라고 알릴 때 위층이 진짜로 끊긴 줄 안다. 우리가
일부러 놓은 것인데도.

### 이름을 함수로 바꿨다

`LinkedTransportPair.create()` 처럼 static 메서드 하나만 있는 클래스는
그냥 함수여야 한다. 검사 도구가 잡아줘서 `linkedTransportPair()` 로 바꿨다.
