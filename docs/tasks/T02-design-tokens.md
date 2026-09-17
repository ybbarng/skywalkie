# T02 — 디자인 토큰과 밝기 모드

**단계** 기반 · **상태** 대기 · **먼저** T01

## 목표

색·글자·간격을 한곳에 모으고, 밝은 화면과 어두운 화면이 자동으로 바뀐다. 이 뒤로 만드는 모든 화면이 이 토큰만 쓴다.

## 근거

[07-design-system.md](../07-design-system.md) 2~5장

## 할 일

### 토큰 정의

```
src/presentation/theme/
  colors.ts        어두운/밝은 두 벌
  typography.ts    글자 크기와 굵기
  spacing.ts       간격과 모서리
  motion.ts        움직임 시간
  tokens.ts        위를 하나로 묶은 타입
```

색 값은 [07-design-system.md](../07-design-system.md)의 표를 그대로 옮긴다.

### 테마 공급

```ts
const { colors, typography, spacing } = useTheme()
```

- 기본은 기기 설정을 따른다 (`useColorScheme`).
- 설정에서 고른 값이 있으면 그것을 우선한다.
- 고른 값은 기기에 저장한다.
- 바뀔 때 0.2초에 걸쳐 색이 서서히 변한다.

### 기본 부품

토큰만 쓰는 부품 몇 개를 먼저 만든다. 이 뒤로 화면을 만들 때 이것들을 조립한다.

```
src/presentation/components/
  Text.tsx           글자 이름(body, caption 등)으로 쓴다
  Button.tsx         누르면 0.96배로 줄었다 돌아온다
  Card.tsx
  Sheet.tsx          아래에서 올라오는 것
  HelpTip.tsx        물음표. 누르면 설명이 뜬다
  Icon.tsx           SVG 아이콘 모음
```

`HelpTip`이 특히 중요하다. [07-design-system.md](../07-design-system.md) 8장의 "처음 쓰는 사람을 위한 장치"가 여기서 시작된다.

### 설명 문구 모으기

```
src/presentation/copy/help.ts
```

물음표를 눌렀을 때 뜨는 글을 전부 여기 모은다. 화면 코드에 글이 흩어지면 나중에 다듬기 어렵다.

### 움직임 줄이기

기기에서 "동작 줄이기"를 켠 사람에게는 모든 움직임을 없앤다. `useReducedMotion`을 한 번 만들어 모든 부품이 쓰게 한다.

## 끝난 걸 어떻게 아는가

- [ ] 기기 설정을 바꾸면 앱 색이 따라 바뀐다
- [ ] 앱 안에서 밝기 모드를 고르면 그게 유지된다
- [ ] 두 모드 모두에서 글자와 바탕의 대비가 4.5대 1 이상이다 (테스트로 확인)
- [ ] "동작 줄이기"를 켜면 움직임이 사라진다
- [ ] 화면 코드에 `#` 로 시작하는 색이 하나도 없다 (검사로 확인)
