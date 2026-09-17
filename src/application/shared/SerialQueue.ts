/**
 * 한 번에 하나씩 처리한다.
 *
 * **왜 필요한가.** 대화 상태(`Conversation`)는 불변 값이라 바꿀 때마다 새것이
 * 나온다. 그래서 이렇게 쓴다.
 *
 * ```ts
 * const next = await doSomething(this.conversation)
 * this.conversation = next            // ← 여기가 위험하다
 * ```
 *
 * 보내기와 받기가 동시에 일어나면 둘 다 **같은 옛 값을 읽고** 각자 새 값을
 * 만들어 덮어쓴다. 나중에 끝난 쪽이 이긴다. 그러면
 *
 * - 받은 메시지가 대화에서 사라지거나
 * - 내 순번이 되돌아가 상대가 중복으로 보고 메시지를 버린다
 *
 * 이 앱은 양쪽이 동시에 말하는 게 흔해서 반드시 생긴다. 실제로 두 기기
 * 통합 테스트가 이걸 잡았다.
 *
 * 그래서 대화 상태를 건드리는 일은 전부 이 줄에 세워 하나씩 처리한다.
 */
export class SerialQueue {
  private tail: Promise<unknown> = Promise.resolve()
  private depth = 0

  /**
   * 앞의 일이 끝난 뒤에 실행한다.
   *
   * 실패해도 줄이 막히지 않는다. 한 번 실패했다고 그 뒤로 아무것도
   * 못 하게 되면 앱이 멈춘 것처럼 보인다.
   */
  run<T>(work: () => Promise<T>): Promise<T> {
    this.depth += 1

    const result = this.tail.then(work, work)

    // 실패를 삼켜서 다음 일이 이어지게 한다.
    // 실패 자체는 부르는 쪽이 돌려받은 약속으로 다룬다.
    this.tail = result.then(
      () => undefined,
      () => undefined,
    )

    return result.finally(() => {
      this.depth -= 1
    })
  }

  /** 지금 줄에 서 있는 일의 개수. 화면에 "처리 중"을 띄울 때 쓴다 */
  pending(): number {
    return this.depth
  }

  /** 줄에 선 일이 전부 끝날 때까지 기다린다 */
  async drain(): Promise<void> {
    await this.tail
  }
}
