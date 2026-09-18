/**
 * 배터리에 대해 하는 말.
 *
 * **비행기에서 폰이 죽으면 대화가 끝난다.** 핫스팟을 연 쪽은 특히
 * 빨리 준다. 상대가 갑자기 조용해졌을 때 그게 잠든 것인지 폰이 죽은
 * 것인지 알 수 있어야 한다.
 *
 * 숫자만 띄우지 않는다. **무엇을 하면 되는지**를 같이 적는다.
 */

/** 이 아래로 내려가면 상대에게도 보여준다 */
export const SHOW_PEER_BATTERY_BELOW = 0.3

/** 이 아래로 내려가면 내 화면에 무엇을 하라고 알린다 */
export const WARN_MY_BATTERY_BELOW = 0.2

/** 이 아래면 통화와 영상을 접자고 한다 */
export const URGE_SAVING_BELOW = 0.15

export function peerBatteryNote(level: number, peerName: string): string | null {
  if (level > SHOW_PEER_BATTERY_BELOW) return null

  const percent = Math.round(level * 100)

  if (level <= URGE_SAVING_BELOW) {
    return `${peerName}님 폰이 ${percent}%예요. 곧 꺼질 수 있어요`
  }

  return `${peerName}님 폰이 ${percent}% 남았어요`
}

/**
 * 내 배터리에 대해 할 말.
 *
 * 핫스팟을 연 쪽은 더 빨리 준다. 그 사실을 알려줘야 왜 이렇게 빨리
 * 주는지 납득한다.
 */
export function myBatteryNote(
  level: number,
  role: 'host' | 'guest',
  callActive: boolean,
): string | null {
  if (level > WARN_MY_BATTERY_BELOW) return null

  const percent = Math.round(level * 100)

  if (callActive) {
    return `배터리가 ${percent}%예요. 통화를 끊으면 오래 갑니다`
  }

  if (role === 'host') {
    // 핫스팟이 배터리를 가장 많이 먹는다. 하지만 끄면 대화가 끊긴다.
    // **끄라고 하지 않는다.** 대신 왜 빨리 주는지 알려준다.
    return `배터리가 ${percent}%예요. 핫스팟이 배터리를 많이 써요. 보조 배터리를 꽂아주세요`
  }

  return `배터리가 ${percent}%예요. 화면을 어둡게 하면 오래 갑니다`
}

/** 영상 통화를 접자고 할 때가 됐나 (명세 5장) */
export function shouldSuggestVideoOff(level: number): boolean {
  return level <= 0.2
}
