/**
 * 순번을 보고 판단한다.
 *
 * 받는 쪽은 순번으로 세 가지를 안다.
 *
 *   · **빠졌나** — 5 다음에 7이 오면 6을 달라고 요청한다
 *   · **겹쳤나** — 이미 받은 순번이면 버린다. 길을 갈아탈 때 두 번 온다
 *   · **어긋났나** — 순서가 뒤바뀌어 와도 제자리에 끼운다
 *
 * (docs/04-transport-spec.md 3장)
 */
export class SeqTracker {
  private maxSeq = 0
  private readonly missing = new Set<number>()
  private readonly seen = new Set<number>()

  /**
   * 순번 하나를 보고 무엇인지 알려준다.
   *
   * @returns `new` 처음 보는 것 · `duplicate` 이미 본 것 · `gap` 빈틈을 만들며 온 것
   */
  observe(seq: number): SeqObservation {
    if (!Number.isInteger(seq) || seq < 1) return 'invalid'

    if (this.seen.has(seq)) return 'duplicate'

    this.seen.add(seq)

    if (seq <= this.maxSeq) {
      // 빠졌던 게 뒤늦게 왔다
      this.missing.delete(seq)
      return 'new'
    }

    const skipped = seq > this.maxSeq + 1
    for (let n = this.maxSeq + 1; n < seq; n += 1) this.missing.add(n)
    this.maxSeq = seq

    return skipped ? 'gap' : 'new'
  }

  /** 아직 안 온 순번들. 다시 붙었을 때 이것만 요청한다 */
  missingSeqs(): number[] {
    return [...this.missing].sort((a, b) => a - b)
  }

  highestSeq(): number {
    return this.maxSeq
  }

  hasGaps(): boolean {
    return this.missing.size > 0
  }

  /**
   * 상대가 인사하며 "나는 여기까지 보냈다"고 알려줬다.
   *
   * 그 사이에 우리가 못 받은 게 있으면 빈틈으로 적어둔다. 연결이 끊긴
   * 동안 상대가 보낸 것을 다시 붙자마자 알아채기 위해서다.
   */
  noteRemoteHighest(remoteHighest: number): void {
    if (!Number.isInteger(remoteHighest) || remoteHighest <= this.maxSeq) return

    for (let n = this.maxSeq + 1; n <= remoteHighest; n += 1) {
      if (!this.seen.has(n)) this.missing.add(n)
    }
    this.maxSeq = remoteHighest
  }

  /**
   * 상대가 "그 순번은 이제 없다"고 답했다.
   *
   * 영원히 요청하지 않도록 목록에서 지운다. 상대가 앱을 새로 깔았거나
   * 그 메시지를 지운 경우다.
   */
  giveUp(seqs: readonly number[]): void {
    for (const seq of seqs) this.missing.delete(seq)
  }

  reset(): void {
    this.maxSeq = 0
    this.missing.clear()
    this.seen.clear()
  }
}

export type SeqObservation = 'new' | 'duplicate' | 'gap' | 'invalid'
