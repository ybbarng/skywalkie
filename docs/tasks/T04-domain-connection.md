# T04 — 도메인: 연결과 상대

**단계** 핵심 · **상태** 대기 · **먼저** T01

## 목표

"연결되어 있다", "이 길이 저 길보다 낫다", "상대는 누구인가"를 코드로 적는다.

## 근거

[04-transport-spec.md](../04-transport-spec.md) 6장 · [01-product-spec.md](../01-product-spec.md) F6

## 할 일

```
src/domain/peer/
  PeerId.ts
  Peer.ts           상대의 이름, 캐릭터, 마지막으로 본 시각
  Character.ts      캐릭터 선택
  PairingCode.ts    여섯 자리 코드

src/domain/connection/
  LinkKind.ts       wifi | ble | web
  LinkQuality.ts    신호 세기, 응답 시간, 유실률 → 점수
  ConnectionState.ts 상태와 전이
```

### 연결 상태 전이

[04-transport-spec.md](../04-transport-spec.md)의 그림 그대로다.

```
idle → searching → handshaking → connected
                        ↑             │
                        └── 실패 ─────┤
                                      │
                   switching ◀────────┤ (더 좋은 길 발견)
                                      │
                    idle   ◀──────────┘ (사용자가 끔)
```

갈아탈 때 지켜야 할 것: **`switching`은 새 길이 열린 뒤에만 `connected`로 간다.** 중간에 메시지를 흘리지 않기 위해서다. 이 규칙을 상태 전이가 직접 강제한다.

### 길 고르기 점수

```ts
score = 기본점수 × 품질계수

기본점수:  wifi 100, ble 40, web 30
품질계수:  신호 세기와 응답 시간으로 0.3 ~ 1.0
```

점수 차이가 **20점 이상 날 때만** 갈아탄다. 안 그러면 두 길 사이를 계속 오간다.

### 여섯 자리 코드

- 앱을 처음 켤 때 만든다
- 헷갈리는 글자를 뺀다: `0`과 `O`, `1`과 `I`와 `l`
- 남는 것: `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` (32자)
- 화면에 크게 띄워 상대에게 보여주는 용도라 읽기 쉬워야 한다

## 테스트

- 연결 상태의 모든 전이 조합
- `switching`에서 새 길 없이 `connected`로 갈 수 없다
- 점수 계산이 맞다
- 20점 미만 차이로는 갈아타지 않는다
- 여섯 자리 코드에 헷갈리는 글자가 없다

## 끝난 걸 어떻게 아는가

- [ ] 바깥을 import 하지 않는다
- [ ] 적용 범위 95% 이상
- [ ] 두 길 사이를 왔다 갔다 하는 상황을 만들어도 갈아타지 않는다
