import { describe, expect, it } from 'vitest'
import { SerialQueue } from './SerialQueue'

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

describe('한 번에 하나씩', () => {
  it('넣은 순서대로 실행한다', async () => {
    const queue = new SerialQueue()
    const order: number[] = []

    await Promise.all([
      queue.run(async () => {
        await sleep(20)
        order.push(1)
      }),
      queue.run(async () => {
        await sleep(5)
        order.push(2)
      }),
      queue.run(async () => {
        order.push(3)
      }),
    ])

    expect(order).toEqual([1, 2, 3])
  })

  it('앞의 일이 끝나기 전에 뒤의 일이 시작되지 않는다', async () => {
    const queue = new SerialQueue()
    let running = 0
    let maxConcurrent = 0

    await Promise.all(
      Array.from({ length: 10 }, () =>
        queue.run(async () => {
          running += 1
          maxConcurrent = Math.max(maxConcurrent, running)
          await sleep(2)
          running -= 1
        }),
      ),
    )

    expect(maxConcurrent).toBe(1)
  })

  it('결과를 그대로 돌려준다', async () => {
    const queue = new SerialQueue()

    const result = await queue.run(async () => 42)

    expect(result).toBe(42)
  })
})

describe('덮어쓰기 막기', () => {
  it('같은 값을 동시에 고쳐도 하나도 잃지 않는다', async () => {
    // 이게 이 클래스를 만든 이유다. 큐 없이 하면 마지막 것만 남는다.
    const queue = new SerialQueue()
    let counter = 0

    await Promise.all(
      Array.from({ length: 50 }, () =>
        queue.run(async () => {
          const read = counter
          await sleep(1)
          counter = read + 1
        }),
      ),
    )

    expect(counter).toBe(50)
  })

  it('큐를 안 쓰면 실제로 값을 잃는다', async () => {
    // 위 테스트가 무엇을 막고 있는지 보여준다
    let counter = 0

    await Promise.all(
      Array.from({ length: 50 }, async () => {
        const read = counter
        await sleep(1)
        counter = read + 1
      }),
    )

    expect(counter).toBeLessThan(50)
  })
})

describe('실패했을 때', () => {
  it('실패를 부르는 쪽에 돌려준다', async () => {
    const queue = new SerialQueue()

    await expect(
      queue.run(async () => {
        throw new Error('잘못됐다')
      }),
    ).rejects.toThrow('잘못됐다')
  })

  it('한 번 실패해도 줄이 막히지 않는다', async () => {
    // 실패했다고 그 뒤로 아무것도 못 하면 앱이 멈춘 것처럼 보인다
    const queue = new SerialQueue()

    const failed = queue.run(async () => {
      throw new Error('잘못됐다')
    })
    await failed.catch(() => undefined)

    const after = await queue.run(async () => '이어서 돈다')

    expect(after).toBe('이어서 돈다')
  })

  it('실패한 일 뒤에 줄 선 것도 순서대로 돈다', async () => {
    const queue = new SerialQueue()
    const order: string[] = []

    const failing = queue.run(async () => {
      order.push('실패')
      throw new Error('잘못됐다')
    })
    const following = queue.run(async () => {
      order.push('그다음')
    })

    await failing.catch(() => undefined)
    await following

    expect(order).toEqual(['실패', '그다음'])
  })
})

describe('줄 상태 보기', () => {
  it('줄에 선 개수를 알려준다', async () => {
    const queue = new SerialQueue()

    const slow = queue.run(() => sleep(10))
    expect(queue.pending()).toBe(1)

    await slow
    expect(queue.pending()).toBe(0)
  })

  it('전부 끝날 때까지 기다릴 수 있다', async () => {
    const queue = new SerialQueue()
    let done = 0

    for (let i = 0; i < 5; i += 1) {
      void queue.run(async () => {
        await sleep(2)
        done += 1
      })
    }

    await queue.drain()

    expect(done).toBe(5)
  })
})
