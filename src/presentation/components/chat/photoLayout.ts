/**
 * 사진을 화면에 어떻게 앉힐지 정한다.
 *
 * 그리는 일에서 떼어낸 이유는 **시험할 수 있어야 하기 때문이다.**
 * 화면 파일은 react-native 를 들여와서 시험에서 읽을 수 없다.
 *
 * **찌그러진 사진은 다시 볼 마음이 안 든다.** 비율을 지키는 것이
 * 여기서 가장 중요하다.
 */

/** 화면에서 사진이 차지할 최대 너비 */
export const MAX_PHOTO_WIDTH = 240

/** 아주 작은 사진도 이만큼은 보인다 */
export const MIN_PHOTO_SIZE = 80

export function fitWithin(
  width: number,
  height: number,
  maxWidth: number = MAX_PHOTO_WIDTH,
  maxHeight: number = maxWidth * 1.6,
): { width: number; height: number } {
  // 크기를 모를 때도 네모는 그린다. 안 그러면 빈 자리만 남는다.
  if (width <= 0 || height <= 0) {
    return { width: maxWidth, height: maxWidth }
  }

  // 1 을 넘지 않게 막아 원본보다 크게 늘리지 않는다. 흐려지기만 한다.
  const scale = Math.min(maxWidth / width, maxHeight / height, 1)

  return {
    width: Math.max(MIN_PHOTO_SIZE, Math.round(width * scale)),
    height: Math.max(MIN_PHOTO_SIZE, Math.round(height * scale)),
  }
}
