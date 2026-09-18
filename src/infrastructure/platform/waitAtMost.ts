/**
 * 아무리 오래 걸려도 여기까지만 기다린다.
 *
 * **바깥 세계는 예외만 던지는 게 아니라 영영 답을 안 하기도 한다.**
 * 예외는 잡으면 되지만 답이 없는 것은 잡을 수가 없다. 기다리는 쪽은
 * 그대로 멎고, 화면은 눌러도 아무 일이 없다. **오류도 안 뜬다.**
 *
 * 실제로 여기서 크게 데었다. 첫 실행 안내에서 "다음" 을 누르면 이름을
 * 저장하고 넘어가는데, 저장이 답을 안 해서 **안내를 통째로 못 넘어갔다.**
 * 앱을 깔고도 대화를 시작조차 할 수 없었고, 로그에 오류 한 줄이 없어
 * 원인을 찾는 데 한참 걸렸다.
 *
 * 그래서 **기다리는 곳마다 끝을 둔다.** 못 기다리면 못 기다린 대로
 * 넘어간다. 설정 한 줄을 못 남기는 것이, 앱을 못 쓰는 것보다 훨씬 낫다.
 *
 * ```ts
 * const saved = await waitAtMost(Storage.setItem(key, value), 3000)
 * // saved 가 false 여도 화면은 이미 다음으로 넘어간다
 * ```
 */

/** 기기가 느릴 수 있다. 넉넉히 주되 사람이 포기할 만큼은 아니게 */
export const STORAGE_PATIENCE_MS = 3000

/**
 * 약속이 제때 끝났나.
 *
 * 끝났으면 `true`, 시간이 지났거나 실패했으면 `false`. **던지지 않는다.**
 * 부르는 쪽이 `try` 로 감싸는 걸 잊어도 안전해야 한다.
 */
export async function waitAtMost(
  work: Promise<unknown>,
  patienceMs: number = STORAGE_PATIENCE_MS,
): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined

  const giveUp = new Promise<false>(resolve => {
    timer = setTimeout(() => resolve(false), patienceMs)
  })

  try {
    const finished = await Promise.race([work.then(() => true), giveUp])
    return finished
  } catch {
    // 실패한 것도 못 기다린 것과 같이 본다. 부르는 쪽이 할 일이 같다.
    return false
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

/**
 * 값을 가져오되 제때 안 오면 포기한다.
 *
 * 못 가져오면 `fallback` 을 준다. **없는 것과 못 읽은 것을 같이 본다.**
 * 둘 다 "모른다" 이고, 모를 때 할 일은 같다.
 */
export async function valueAtMost<T>(
  work: Promise<T>,
  fallback: T,
  patienceMs: number = STORAGE_PATIENCE_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined

  const giveUp = new Promise<T>(resolve => {
    timer = setTimeout(() => resolve(fallback), patienceMs)
  })

  try {
    return await Promise.race([work, giveUp])
  } catch {
    return fallback
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}
