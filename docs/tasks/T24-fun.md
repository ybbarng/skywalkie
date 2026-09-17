# T24 — 둘이서 할 만한 것들

**단계** 2단계 · **상태** 대기 · **먼저** T13

## 목표

기내에서 열 시간을 같이 보낼 장치들.

## 근거

[01-product-spec.md](../01-product-spec.md) F11

## 할 일

각각 독립적이라 **하고 싶은 것부터 하나씩** 해도 된다.

### 콕 찌르기

```
src/application/messaging/SendNudge.ts
src/infrastructure/platform/HapticVibration.ts
```

한 번 누르면 상대 폰이 짧게 진동한다. 말 없이 "자니?" 하는 용도다.

- 3초에 한 번으로 제한한다. 안 그러면 장난이 된다
- 대화에도 한 줄로 남는다
- 앱이 뒤에 있어도 진동한다

### 낙서 주고받기

```
app/doodle.tsx
src/presentation/components/doodle/
  DoodleCanvas.tsx
  DoodleRenderer.tsx
```

손가락으로 그린 그림을 보낸다.

- 그림 파일이 아니라 **선의 좌표**로 저장한다([05-messaging-spec.md](../05-messaging-spec.md)). 작고 선명하다
- 색은 토큰 이름으로 저장해 밝은/어두운 화면에서 알맞게 나온다
- 받으면 **그려지는 과정이 재생된다.** 그냥 나타나는 것보다 재밌다
- 지우개와 되돌리기

### 같이 보기

```
src/application/presence/SharePresence.ts
```

지금 듣는 노래나 보는 영화를 서로에게 알린다.

- 안드로이드는 다른 앱이 무슨 소리를 내는지 알 수 있다
- 아이폰은 그게 막혀 있어 **직접 적어서** 알린다
- 화면 위쪽에 "지금 ○○ 듣는 중"으로 작게 뜬다

### 남은 시간

```
app/(tabs)/settings.tsx 안의 설정
src/presentation/components/FlightTimer.tsx
```

목적지 도착까지 남은 시간을 둘이 같은 화면으로 본다.

- 출발할 때 총 비행 시간을 한 번 넣는다
- 두 폰이 같은 값을 보게 맞춘다
- 대화 화면 위에 작게 띄우거나 끌 수 있다
- 다 되면 둘 다에게 알림이 간다

### 질문 카드

```
src/presentation/components/QuestionCard.tsx
src/presentation/copy/questions.ts
```

"지금 제일 하고 싶은 거" 같은 질문이 한 장씩 나온다. 둘이 각자 답하고, **둘 다 답하면 서로의 답이 보인다.**

- 질문은 앱에 넣어둔다. 인터넷이 필요 없다
- 백 개쯤 준비한다. 가벼운 것부터 깊은 것까지
- 한 번 나온 질문은 다시 안 나온다
- 답한 것은 대화에 남는다

## 테스트

- 콕 찌르기가 3초에 한 번으로 제한된다
- 낙서가 오가고 재생된다
- 낙서 색이 밝은/어두운 화면에서 다르게 나온다
- 남은 시간이 두 폰에서 같다
- 질문이 겹치지 않는다
- 한쪽만 답하면 상대 답이 안 보인다

## 끝난 걸 어떻게 아는가

- [ ] 다섯 가지가 전부 되거나, 안 한 것이 문서에 적혀 있다
- [ ] 전부 블루투스로도 된다 (낙서만 예외)
