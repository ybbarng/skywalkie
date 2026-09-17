# 코드 구조

> 상태: 확정 · 최종 수정 2026-09-17

## 왜 이렇게 나누는가

이 앱의 핵심 난제는 하나다. **메시지가 지나갈 길이 여러 개이고, 비행 중에 그 길이 바뀐다.**

- 핫스팟이 열리면 Wi-Fi로 간다.
- 승무원이 핫스팟을 끄라고 하면 블루투스로 간다.
- 아이폰 앱이 만료되면 웹으로 간다.

"메시지를 보낸다"는 뜻은 이 셋 모두에서 같다. 달라지는 건 **어떻게 보내느냐**뿐이다.
그래서 **뜻은 안쪽에, 방법은 바깥쪽에** 둔다. 이게 이 문서 전체를 관통하는 원칙이다.

## 네 겹

```
┌─────────────────────────────────────────────────────┐
│  presentation   화면. 사람이 보고 누르는 것          │
│                 React 컴포넌트, 화면 상태            │
├─────────────────────────────────────────────────────┤
│  application    할 일. "메시지를 보낸다" 같은 절차   │
│                 유스케이스, 포트(약속)               │
├─────────────────────────────────────────────────────┤
│  domain         뜻. 메시지란 무엇인가                │
│                 엔티티, 값 객체, 도메인 규칙         │
├─────────────────────────────────────────────────────┤
│  infrastructure 방법. 실제로 어떻게 하는가           │
│                 소켓, 블루투스, 데이터베이스, WebRTC │
└─────────────────────────────────────────────────────┘
```

의존 방향은 한쪽이다.

```
presentation ──▶ application ──▶ domain
                      ▲
                      │ (약속을 지킨다)
              infrastructure
```

`domain`은 아무것도 import 하지 않는다. React도, SQLite도, 소켓도 모른다.
`infrastructure`는 `application`이 정한 약속(인터페이스)을 지키는 쪽이다. 화살표가 위를 향하는 이유가 이것이다 — **의존성 역전**.

### 이게 실제로 무슨 이득인가

블루투스 경로를 나중에 붙일 때, `domain`과 `application`과 `presentation`을 **한 줄도 고치지 않는다.** `infrastructure`에 파일 하나를 새로 두고 조립하는 곳에서 바꿔 끼우면 끝이다.

테스트도 같은 이유로 쉬워진다. 진짜 Wi-Fi 없이 가짜 연결을 끼우면 대화 전 과정을 컴퓨터에서 시험할 수 있다.

## 폴더

```
src/
├── domain/                     아무것도 모르는 순수한 층
│   ├── message/
│   │   ├── Message.ts              메시지 엔티티
│   │   ├── MessageId.ts            메시지 식별자 (값 객체)
│   │   ├── MessageContent.ts       내용 (텍스트·낙서·콕찌르기)
│   │   ├── DeliveryState.ts        보냄→전달됨→읽음 상태 전이
│   │   └── Conversation.ts         대화 (메시지의 집합, 애그리거트 루트)
│   ├── peer/
│   │   ├── Peer.ts                 상대방
│   │   ├── PeerId.ts               상대 식별자
│   │   └── Character.ts            캐릭터 선택
│   ├── connection/
│   │   ├── LinkQuality.ts          연결 품질 (값 객체)
│   │   ├── LinkKind.ts             연결 종류 (wifi | ble | web)
│   │   └── ConnectionState.ts      연결 상태 전이 규칙
│   ├── call/
│   │   ├── Call.ts                 통화
│   │   ├── CallMode.ts             누르고 말하기 | 항상 열기
│   │   └── AudioRoute.ts           소리가 나가는 곳 (이어폰·스피커)
│   └── shared/
│       ├── Result.ts               성공/실패를 값으로 다루기
│       ├── DomainEvent.ts          도메인 사건
│       └── Clock.ts                시간 (테스트에서 갈아끼움)
│
├── application/                할 일과 약속
│   ├── ports/                      바깥에 요구하는 약속들
│   │   ├── MessageTransport.ts         "메시지를 나르는 무언가"
│   │   ├── ConversationRepository.ts    "대화를 보관하는 무언가"
│   │   ├── PeerDiscovery.ts             "상대를 찾는 무언가"
│   │   ├── CallSession.ts               "통화를 여는 무언가"
│   │   ├── AudioSessionController.ts    "소리를 다루는 무언가"
│   │   ├── ArchiveWriter.ts             "대화를 파일로 꺼내는 무언가"
│   │   └── Vibration.ts                 "진동시키는 무언가"
│   ├── messaging/
│   │   ├── SendMessage.ts
│   │   ├── ReceiveMessage.ts
│   │   ├── LoadConversation.ts
│   │   ├── MarkAsRead.ts
│   │   └── FlushPendingMessages.ts      끊긴 동안 쌓인 것 내보내기
│   ├── connection/
│   │   ├── EstablishLink.ts
│   │   ├── SelectBestLink.ts            여러 길 중 고르기
│   │   └── MonitorLink.ts
│   ├── call/
│   │   ├── StartCall.ts
│   │   ├── PushToTalk.ts
│   │   └── SwitchCallMode.ts
│   └── archive/
│       ├── ExportConversation.ts
│       ├── ImportConversation.ts
│       └── AutoBackup.ts
│
├── infrastructure/             실제 방법
│   ├── transport/
│   │   ├── wifi/
│   │   │   ├── TcpMessageTransport.ts
│   │   │   ├── UdpPeerDiscovery.ts
│   │   │   └── frame/                   바이트를 메시지로 자르기
│   │   ├── ble/
│   │   │   ├── BleMessageTransport.ts
│   │   │   ├── BlePeerDiscovery.ts
│   │   │   └── chunk/                   긴 메시지를 조각내기
│   │   ├── web/
│   │   │   └── LocalHttpTransport.ts    비상용 웹 채팅
│   │   └── CompositeTransport.ts        여러 길을 하나로 묶기
│   ├── persistence/
│   │   ├── SqliteConversationRepository.ts
│   │   ├── migrations/
│   │   └── schema.ts
│   ├── call/
│   │   ├── WebRtcCallSession.ts
│   │   └── signaling/                   협상 정보 주고받기
│   ├── audio/
│   │   ├── AudioSessionController.ios.ts
│   │   └── AudioSessionController.android.ts
│   ├── archive/
│   │   ├── JsonArchiveWriter.ts
│   │   ├── HtmlArchiveWriter.ts
│   │   └── TextArchiveWriter.ts
│   └── platform/
│       ├── DeviceInfo.ts
│       └── SystemSettings.ts            설정 화면 열어주기
│
├── presentation/               화면
│   ├── screens/
│   ├── components/
│   ├── stores/                     zustand
│   ├── theme/                      색·글자·간격 토큰
│   ├── characters/                 SVG 캐릭터
│   └── hooks/
│
└── composition/                조립
    └── container.ts                어떤 구현을 끼울지 정하는 곳
```

## 층별로 지키는 규칙

### domain — 아무것도 모른다

- `import`는 같은 `domain` 안에서만. React, Expo, Node 모듈 전부 금지.
- 클래스는 항상 **올바른 상태로만** 만들어진다. 반쯤 채워진 메시지는 존재할 수 없다.
- 상태를 바꾸는 대신 새 값을 만든다(불변).
- 실패는 예외를 던지지 않고 `Result` 값으로 돌려준다. 부르는 쪽이 반드시 다루게 만든다.

```ts
// domain/message/Message.ts — 느낌만
export class Message {
  private constructor(
    readonly id: MessageId,
    readonly author: PeerId,
    readonly content: MessageContent,
    readonly sentAt: Date,
    readonly delivery: DeliveryState,
  ) {}

  static compose(author: PeerId, content: MessageContent, now: Date): Result<Message> {
    // 만들면서 규칙을 검사한다. 통과 못 하면 Message가 태어나지 않는다.
  }

  markDelivered(at: Date): Result<Message> {
    // 상태 전이 규칙이 여기 있다. 읽음 → 보냄 같은 역행은 막는다.
  }
}
```

### application — 절차를 적는다

- 유스케이스 하나는 **하나의 일**을 한다. `execute` 하나만 밖으로 낸다.
- 필요한 것은 전부 생성자로 받는다(의존성 주입). 안에서 직접 만들지 않는다.
- 여기서도 React와 Expo를 모른다.

```ts
// application/messaging/SendMessage.ts — 느낌만
export class SendMessage {
  constructor(
    private readonly transport: MessageTransport,
    private readonly repository: ConversationRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: SendMessageInput): Promise<Result<Message>> {
    // 1. 메시지를 만든다
    // 2. 먼저 저장한다 (전송에 실패해도 남는다)
    // 3. 보낸다
    // 4. 결과에 따라 상태를 고친다
  }
}
```

**먼저 저장하고 나중에 보내는 순서**가 중요하다. 반대로 하면 전송 도중 앱이 죽었을 때 메시지가 사라진다.

### infrastructure — 약속을 지킨다

- `application/ports`의 인터페이스를 구현한다.
- 바깥 세계의 오류를 전부 잡아서 `Result`로 바꾼다. 예외가 위층으로 새지 않는다.
- 플랫폼별로 갈릴 땐 파일 이름으로 나눈다(`.ios.ts` / `.android.ts`).

### presentation — 보여주고 받는다

- 화면은 유스케이스를 부르기만 한다. 규칙을 화면에 쓰지 않는다.
- 도메인 객체를 화면이 직접 다루지 않는다. 보기 좋은 형태로 바꿔서 넘긴다.
- 스타일은 반드시 토큰을 거친다. 색을 직접 적지 않는다.

## 조립하는 곳

모든 부품을 어디서 끼울지는 `composition/container.ts` 한 곳에서 정한다.
이 파일만이 "지금 Wi-Fi를 쓸지 블루투스를 쓸지"를 안다.

```ts
// composition/container.ts — 느낌만
export function createContainer(): Container {
  const repository = new SqliteConversationRepository(db)
  const transport = new CompositeTransport([
    new TcpMessageTransport(),   // 먼저 시도
    new BleMessageTransport(),   // 안 되면 이것
  ])
  return {
    sendMessage: new SendMessage(transport, repository, systemClock),
    // ...
  }
}
```

테스트에선 이 함수만 바꿔 가짜 부품을 끼운다.

## 두 기기가 주고받는 말

연결 방식이 달라도 **주고받는 내용의 형식은 같다.** 그래야 Wi-Fi에서 블루투스로 갈아타도 코드가 그대로다.

형식은 `zod`로 정의하고 받을 때마다 검사한다. 상대가 보낸 것을 믿지 않는다 — 버전이 다른 앱끼리 붙을 수 있기 때문이다.

자세한 규약은 [04-transport-spec.md](./04-transport-spec.md)에 있다.

## 코드가 규칙을 어기지 못하게 막기

사람이 조심하는 것으로는 부족하다. 도구로 막는다.

- **의존 방향 검사**: `domain`이 바깥을 import 하면 검사에서 걸리게 한다. biome 규칙과 별도 검사 스크립트로 확인한다.
- **타입 엄격 모드**: `strict: true`에 더해 `noUncheckedIndexedAccess`까지 켠다.
- **커밋 전 자동 검사**: lefthook으로 커밋할 때 검사와 테스트를 돌린다.

## 관련 문서

- 제품이 무엇인지: [01-product-spec.md](./01-product-spec.md)
- 왜 이 기술인지: [02-tech-decisions.md](./02-tech-decisions.md)
- 연결 규약: [04-transport-spec.md](./04-transport-spec.md)
- 테스트: [09-testing.md](./09-testing.md)
