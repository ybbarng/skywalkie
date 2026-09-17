# T22 — 사진 주고받기

**단계** 2단계 · **상태** 대기 · **먼저** T13, T19

## 목표

창밖 풍경이나 기내식을 찍어 보낸다.

## 근거

[01-product-spec.md](../01-product-spec.md) F9 · [05-messaging-spec.md](../05-messaging-spec.md) 사진 항목

## 할 일

```
src/domain/message/content/Photo.ts
src/application/ports/AssetTransfer.ts
src/application/assets/
  SendPhoto.ts
  ReceiveAsset.ts
  ResumeTransfer.ts
src/infrastructure/assets/
  AssetChunker.ts
  AssetStore.ts           기기에 저장
  ImageResizer.ts         줄이기
  BlurHashEncoder.ts      흐릿한 미리보기 만들기
src/presentation/components/chat/
  PhotoBubble.tsx
  PhotoViewer.tsx
```

### 보내기 전에 줄인다

원본을 그대로 보내면 몇 MB짜리가 사설망을 막는다.

- 긴 변을 1600픽셀로 맞추고 JPEG 품질 80으로 다시 저장한다
- 대개 몇백 KB로 준다
- 원본을 보낼지 고를 수 있게 하되, 시간이 걸린다고 미리 알린다

### 흐릿한 미리보기

`blurHash`는 스무 자 남짓한 짧은 글자에 사진의 색과 형태를 담는다. **메시지 봉투에 같이 들어가므로 사진이 오기 전에 흐릿한 모습이 즉시 뜬다.** 받는 동안 빈 네모를 보고 있지 않아도 된다.

### 나르기

```
message (blurHash 포함) → asset_offer → asset_request → asset_chunk ... → asset_complete
```

- 한 조각은 48 KB
- 받는 쪽이 어디까지 받았는지 기억한다. **끊겼다 붙으면 못 받은 조각만 다시 요청한다**
- 전부 받으면 검증값을 대조한다. 어긋나면 그 사진만 다시 받는다
- 진행률을 말풍선 위에 보여준다

### 저장

- 앱 폴더 `photos/` 아래에 `assetId`를 이름으로 저장한다
- **보내는 쪽도 줄인 사진을 같은 곳에 저장한다.** 내가 보낸 사진도 나중에 다시 봐야 한다
- 내보내기에 포함한다. HTML 파일에는 사진을 안에 박아 넣어 파일 하나로 열리게 한다

### 블루투스일 때

보내지 않는다. 대기 줄에 두고 Wi-Fi가 열리면 내보낸다. "Wi-Fi가 연결되면 보낼게요"라고 알린다.

## 테스트

- 조각내고 다시 붙이면 원래 파일과 같다
- 중간에 끊기면 받은 데까지 기억하고 이어받는다
- 검증값이 어긋나면 다시 받는다
- 여러 사진을 동시에 보내도 섞이지 않는다
- 저장 공간이 부족하면 알린다
- 블루투스 상태에서는 대기한다

## 끝난 걸 어떻게 아는가

- [ ] 사진이 오간다
- [ ] 흐릿한 미리보기가 즉시 뜬다
- [ ] 끊겨도 이어받는다
- [ ] 내보내기에 사진이 포함된다
