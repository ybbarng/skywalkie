# T01 — 프로젝트 뼈대와 개발 도구

**단계** 기반 · **상태** 대기 · **먼저 끝나야 하는 카드** 없음

## 목표

코드를 쓸 수 있는 상태를 만든다. 폴더 구조가 서고, 검사 도구가 돌고, 커밋할 때 자동으로 확인된다.

## 근거

[03-architecture.md](../03-architecture.md) 폴더 구조 · [02-tech-decisions.md](../02-tech-decisions.md) D3, D9 · [08-build-release.md](../08-build-release.md) 개발 환경

## 할 일

### 뼈대 세우기

```bash
pnpm create expo-app . --template blank-typescript
```

`app.config.ts`에 이름(Skywalkie), 식별자(`com.ybbarng.skywalkie`), 권한, 배경 모드를 적는다.

### 폴더 만들기

[03-architecture.md](../03-architecture.md)의 구조 그대로 빈 폴더와 `index.ts`를 둔다.

```
src/{domain,application,infrastructure,presentation,composition}
test/{fakes,integration}
```

### 타입 규칙

`tsconfig.json`에 엄격하게 잡는다.

```jsonc
{
  "strict": true,
  "noUncheckedIndexedAccess": true,   // 배열에서 꺼낸 값이 없을 수 있음을 강제
  "noImplicitOverride": true,
  "exactOptionalPropertyTypes": true,
  "paths": { "@/*": ["./src/*"] }
}
```

`noUncheckedIndexedAccess`는 처음에 귀찮지만, 없는 값을 꺼내 쓰는 실수를 컴파일 단계에서 막는다. 비행기에서 터질 오류 하나를 미리 잡는 값어치가 있다.

### 검사 도구

biome를 넣는다. 들여쓰기 공백 2칸, 나머지는 권장 설정을 따른다.

### 층이 규칙을 어기는지 검사하기

`scripts/check-deps.ts`를 만든다. 각 층의 파일이 무엇을 import 하는지 훑어서 아래를 어기면 실패시킨다.

```
domain         → 아무것도 import 하지 않는다 (domain 안쪽만 허용)
application    → domain 만
infrastructure → domain, application 만
presentation   → domain, application 만 (infrastructure 직접 참조 금지)
composition    → 전부 허용
```

이 검사가 없으면 층 구분은 지켜지지 않는다. 사람은 반드시 어긴다.

### 테스트 도구

vitest를 넣는다. 설정은 최소로 두고, React Native 코드를 다루는 테스트만 별도 환경을 쓴다.

### 커밋 전 자동 검사

lefthook을 넣는다.

```yaml
pre-commit:  biome + tsc
pre-push:    전체 검사 (verify)
```

### 명령 모음

`package.json`에 [09-testing.md](../09-testing.md)에 적은 명령들을 넣는다.

### git 설정

`.gitignore`에 `ios/`, `android/`, `node_modules/`, `.env.local`, `*.keystore`를 넣는다.
네이티브 폴더를 넣지 않는 이유는 [08-build-release.md](../08-build-release.md)에 적혀 있다.

## 끝난 걸 어떻게 아는가

- [ ] `pnpm verify`가 통과한다
- [ ] `pnpm check:deps`가 돌고, 일부러 규칙을 어긴 파일을 넣으면 실패한다
- [ ] 커밋할 때 자동 검사가 돈다
- [ ] `pnpm expo prebuild`가 성공한다
- [ ] 빈 화면이 두 폰에서 뜬다
