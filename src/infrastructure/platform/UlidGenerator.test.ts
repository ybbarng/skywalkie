import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { makePeerId, ulidGenerator } from './UlidGenerator'

/**
 * 식별자를 만들 수 있는가.
 *
 * **이게 안 되면 앱이 통째로 안 돈다.** 프로필도 못 만들고 메시지도 못
 * 만든다. 실제로 첫 실행 안내에서 "다음" 이 안 먹었고, 오류가 화면에
 * 안 떠서 버튼이 고장 난 것처럼 보였다.
 *
 * **테스트가 1600 개가 넘는데 이 자리만 비어 있었다.** 다른 시험들은
 * 전부 가짜 생성기를 넣어 돌리니 진짜가 도는지 아무도 안 봤다.
 * 여기가 그 구멍을 막는다.
 */

/**
 * **React Native 를 진짜로 재현한다.**
 *
 * `ulid` 는 Node 용과 브라우저용이 따로 있다. vitest 는 Node 용을 쓰는데
 * 그건 Node 의 `crypto` 를 찾아 쓰므로 **잘못된 코드도 통과한다.**
 * React Native 는 브라우저용을 쓰고, 그건 `globalThis.crypto` 만 본다.
 * 거기에 없으면 던진다. **이것이 폰에서만 터졌던 이유다.**
 *
 * 그래서 여기서는 브라우저용을 직접 불러 `crypto` 를 치우고 확인한다.
 */
/** React Native 가 쓰는 쪽을 파일째로 불러온다 */
async function loadBrowserUlid(): Promise<{
  ulid: () => string
  monotonicFactory: (prng: () => number) => () => string
}> {
  const here = dirname(fileURLToPath(import.meta.url))
  const path = resolve(here, '../../../node_modules/ulid/dist/browser/index.js')
  return import(pathToFileURL(path).href)
}

describe('난수가 없는 곳에서도 만든다', () => {
  const realCrypto = globalThis.crypto

  beforeAll(() => {
    // biome-ignore lint/suspicious/noExplicitAny: 없는 환경을 흉내 낸다
    delete (globalThis as any).crypto
  })

  afterAll(() => {
    // biome-ignore lint/suspicious/noExplicitAny: 위와 같다
    ;(globalThis as any).crypto = realCrypto
  })

  it('난수를 안 주면 브라우저용은 던진다', async () => {
    // 폰에서 나던 오류를 그대로 재현한다.
    // ULIDError: Failed to find a reliable PRNG (PRNG_DETECT)
    const browserUlid = await loadBrowserUlid()

    expect(() => browserUlid.ulid()).toThrow(/PRNG/)
  })

  it('난수를 주면 브라우저용도 잘 만든다', async () => {
    // **우리가 하는 방식이 이것이다.** 난수를 직접 주면 `crypto` 가
    // 없어도 된다.
    const browserUlid = await loadBrowserUlid()
    const nextUlid = browserUlid.monotonicFactory(() => Math.random())

    expect(() => nextUlid()).not.toThrow()
    expect(nextUlid()).toHaveLength(26)
  })
})

describe('식별자를 만든다', () => {
  it('부르면 값이 나온다', () => {
    // **여기가 핵심이다.** 예전에는 이 줄에서 던졌다.
    // ULIDError: Failed to find a reliable PRNG (PRNG_DETECT)
    expect(() => ulidGenerator.next()).not.toThrow()
  })

  it('상대 식별자도 만든다', () => {
    expect(() => makePeerId()).not.toThrow()
  })

  it('26자다', () => {
    // 파일 이름과 주소에 그대로 들어가는 길이다
    expect(ulidGenerator.next()).toHaveLength(26)
    expect(makePeerId()).toHaveLength(26)
  })

  it('영문 대문자와 숫자뿐이다', () => {
    // 소문자나 기호가 섞이면 파일 이름으로 못 쓴다
    expect(ulidGenerator.next()).toMatch(/^[0-9A-Z]{26}$/)
  })
})

describe('겹치지 않는다', () => {
  it('천 개를 만들어도 다 다르다', () => {
    const made = new Set<string>()
    for (let i = 0; i < 1000; i += 1) made.add(ulidGenerator.next())

    expect(made.size).toBe(1000)
  })

  it('두 기기가 각자 만들어도 안 겹친다', () => {
    // 우리 둘이 동시에 말할 수 있다
    const mine = Array.from({ length: 500 }, () => ulidGenerator.next())
    const hers = Array.from({ length: 500 }, () => makePeerId())

    expect(new Set([...mine, ...hers]).size).toBe(1000)
  })
})

describe('시간순으로 늘어선다', () => {
  it('나중에 만든 것이 항상 뒤에 온다', () => {
    // **같은 밀리초 안에서도 지켜져야 한다.** 빨리 보낸 두 마디가
    // 뒤집혀 보이면 대화가 이상해진다.
    const made = Array.from({ length: 200 }, () => ulidGenerator.next())
    const sorted = [...made].sort()

    expect(sorted).toEqual(made)
  })
})
