# Skywalkie 작업 지침

비행기에서 두 사람이 인터넷 없이 대화하는 앱. React Native + Expo.

## 먼저 읽을 것

작업 전에 관련된 명세를 읽는다. **명세에 없는 것을 임의로 만들지 않고, 명세와 다르게 만들어야 하면 명세부터 고친다.**

| 무엇을 할 때 | 무엇을 읽나 |
|---|---|
| 무엇이든 | [docs/01-product-spec.md](./docs/01-product-spec.md) |
| 코드를 어디에 둘지 고민될 때 | [docs/03-architecture.md](./docs/03-architecture.md) |
| 통신을 건드릴 때 | [docs/04-transport-spec.md](./docs/04-transport-spec.md) |
| 메시지·저장·내보내기 | [docs/05-messaging-spec.md](./docs/05-messaging-spec.md) |
| 음성·영상 | [docs/06-voice-video-spec.md](./docs/06-voice-video-spec.md) |
| 화면 | [docs/07-design-system.md](./docs/07-design-system.md) |
| 빌드·배포 | [docs/08-build-release.md](./docs/08-build-release.md) |
| 테스트 | [docs/09-testing.md](./docs/09-testing.md) |

## 작업 방식

**작업 카드 단위로 진행한다.** [docs/tasks/README.md](./docs/tasks/README.md)에 25개가 있다.

```
1. 카드를 고르고 상태를 "진행 중"으로 바꾼다
2. 카드에 적힌 "할 일"을 만든다
3. 카드에 적힌 "끝난 걸 어떻게 아는가"를 전부 확인한다
4. pnpm verify 를 돌린다
5. 커밋한다
6. 카드 상태를 "완료"로 바꾼다
```

여러 카드를 한 커밋에 섞지 않는다.

## 절대 어기면 안 되는 것

### 층의 의존 방향

```
presentation ──▶ application ──▶ domain
                      ▲
              infrastructure
```

- `domain`은 **아무것도 import 하지 않는다.** React, Expo, Node 모듈 전부 금지
- `application`은 `domain`만
- `presentation`은 `infrastructure`를 직접 참조하지 않는다
- 조립은 `composition/container.ts` 한 곳에서만

`pnpm check:deps`가 검사한다. 이 검사를 우회하는 코드를 쓰지 않는다.

### 저장이 먼저, 전송이 나중

`SendMessage`는 반드시 이 순서다.

```
Message 만들기 → 저장 → 전송 → 상태 고치기
```

반대로 하면 전송 도중 앱이 죽었을 때 메시지가 사라진다.

### 시간과 식별자를 직접 만들지 않는다

`Date.now()`와 ULID 생성을 코드에서 직접 부르지 않는다. `Clock`과 `IdGenerator`를 주입받는다. 안 그러면 테스트가 어떤 날 갑자기 실패한다.

### 색을 직접 적지 않는다

화면 코드에 `#RRGGBB`가 나오면 안 된다. 반드시 `useTheme()`의 토큰을 거친다. 밝은 화면과 어두운 화면이 어긋나는 걸 막는다.

### 예외를 던지지 않는다

도메인과 응용 계층은 `Result`로 실패를 돌려준다. `infrastructure`는 바깥 세계의 예외를 전부 잡아 `Result`로 바꾼다. 예외가 위층으로 새지 않는다.

### 모르는 봉투가 와도 연결을 끊지 않는다

상대가 다른 버전의 앱일 수 있다. 조용히 무시하고 기록만 남긴다. 이 규칙이 없으면 한쪽만 업데이트했을 때 대화가 통째로 안 된다.

### 인터넷을 쓰지 않는다

외부 서버에 의존하는 코드를 넣지 않는다. STUN·TURN, 푸시 알림, 오류 수집, 원격 설정, 글꼴 내려받기 전부 금지. **비행기에서 인터넷이 없다.**

새 라이브러리를 넣을 때 인터넷을 쓰는지 확인한다.

## 판단이 필요할 때 기준

### 두 기기 사이가 가장 위험하다

이 앱의 버그는 대부분 "두 기기가 다르게 생각할 때" 생긴다. 그래서 통신 규약 코드([T07](./docs/tasks/T07-protocol.md))와 연결 관리([T09](./docs/tasks/T09-link-manager.md))의 테스트가 가장 값지다. 여기는 넉넉히 시험한다.

### 고칠 기회가 한 번뿐이다

비행기 안에서 버그를 발견하면 그걸로 끝이다. 앱 스토어 업데이트도 서버 수정도 없다. **"나중에 고치지"가 통하지 않는다.**

### 화면은 설명이다

말을 나눌 수 없는 두 사람이 각자 화면만 보고 연결에 성공해야 한다([T12](./docs/tasks/T12-onboarding.md)). 오류 메시지에 코드나 영어를 띄우지 않고, **무엇이 잘못됐고 무엇을 누르면 되는지**를 적는다.

### 대화가 앱보다 오래 산다

아이폰 앱은 7일마다 만료된다. 메시지를 지우거나 못 읽게 만드는 변경은 하지 않는다. 표를 고칠 때도 예전 대화가 살아남아야 한다.

## 글쓰기

사용자에게 보이는 글(화면 문구, 커밋 메시지, 문서, 주석)은 **일상 한국어**로 쓴다.

- 영어를 음역하지 않는다: 스킵 ❌ → 건너뛰다
- 한자어를 무겁게 조합하지 않는다: 회귀 ❌ → 기존 동작이 깨진다
- 명사로 끝내지 않는다: "연결 실패" ❌ → "연결하지 못했어요"
- 코드 식별자(함수명·타입명)는 원문 그대로

## 의존성을 새로 넣을 때

`pnpm add` 를 그냥 쓰면 막힌다. pnpm 이 **배포된 지 7일이 안 된 버전을 설치하지 않기** 때문이다(공급망 공격 방어, pnpm 10.32 기본값). 이 보호는 그대로 두고 넣을 때만 푼다.

```bash
pnpm deps:add <패키지>       새로 넣기
pnpm deps:remove <패키지>    빼기
pnpm deps:expo <패키지>      Expo SDK 버전에 맞춰 넣기
```

`pnpm install` 은 그냥 된다. 잠금 파일에 있는 버전은 검사하지 않는다.

## 핫스팟 값

늘 쓰는 핫스팟 이름과 비밀번호는 `.env` 에 둔다. 저장소가 공개라 코드에 적지 않는다.

```bash
cp .env.example .env
```

`EXPO_PUBLIC_` 로 시작하는 값은 **빌드할 때 앱 안에 박힌다.** 바꾸면 다시 빌드해야 하고,
앱 파일을 뜯으면 보인다. 저장소에 안 올라가는 것까지가 여기서 얻는 것이다.

읽을 때는 `process.env.EXPO_PUBLIC_...` 를 **글자 그대로 적는다.** 변수에 담아 돌려
읽으면 값이 안 박힌다. 안 채웠으면 `homeHotspot` 이 `null` 이고, 앱은 멈추지 않고
이름을 알려주는 안내만 빠진다.

## 명령

```bash
pnpm verify          # 전부 (커밋 전에 이것만 돌리면 된다)
pnpm test            # 테스트
pnpm test:watch
pnpm typecheck
pnpm lint
pnpm check:deps      # 층 규칙

pnpm start           # 개발
pnpm dev:android
pnpm dev:ios
```

## 커밋

- 한국어로 쓴다
- 작업 카드 번호를 앞에 붙인다: `T07: 봉투 형식과 바이트 자르기`
- 하나의 카드 = 하나 이상의 커밋. 여러 카드를 한 커밋에 섞지 않는다
- `git checkout` 대신 `git switch` / `git restore`
