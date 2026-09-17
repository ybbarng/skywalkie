/**
 * 진동시키는 무언가.
 *
 * 콕 찌르기와 누르고 말하기 버튼에서 쓴다. 누르고 말하기에서는
 * "이제 말해도 된다"를 손끝으로 알리는 신호라, 소리를 못 듣는 상황에서도
 * 동작해야 한다.
 */
export interface Vibration {
  /** 콕 찌르기를 받았다 */
  nudge(): Promise<void>

  /** 마이크가 열렸다. 이제 말해도 된다 */
  talkReady(): Promise<void>

  /** 가벼운 확인 */
  tap(): Promise<void>

  /** 뭔가 잘못됐다 */
  warn(): Promise<void>
}
