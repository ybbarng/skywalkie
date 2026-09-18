import { describe, expect, it } from 'vitest'
import { copyFor, longHintFor } from './connecting'

/**
 * 핫스팟 값은 `.env` 에서 온다.
 *
 * **안 적어뒀을 때가 문제다.** 그대로 끼워 넣으면 화면에 `undefined` 가
 * 뜬다. 떨어져 앉아 물어볼 수도 없는 사람에게 그런 글이 보이면
 * 앱이 고장 난 줄 안다. 그래서 없을 때 무슨 말을 하는지를 시험한다.
 */

const ours = { ssid: 'our-hotspot', password: 'secret' }

describe('Wi-Fi 에 들어가라고 말할 때', () => {
  it('이름을 알면 그 이름을 짚어준다', () => {
    // 이름을 알면 물어볼 필요가 없다. 그게 이 값을 둔 이유다.
    const copy = copyFor('need-wifi', '지민', ours)

    expect(copy.detail).toContain('our-hotspot')
  })

  it('이름을 모르면 상대 화면을 보라고 한다', () => {
    // 예전에 하던 방식으로 되돌아간다. 되긴 된다.
    const copy = copyFor('need-wifi', '지민', null)

    expect(copy.detail).toContain('지민')
    expect(copy.detail).not.toContain('undefined')
  })

  it('어느 쪽이든 누를 것은 하나다', () => {
    expect(copyFor('need-wifi', '지민', ours).action).toBe('Wi-Fi 고르러 가기')
    expect(copyFor('need-wifi', '지민', null).action).toBe('Wi-Fi 고르러 가기')
  })
})

describe('오래 걸릴 때 덧붙이는 도움말', () => {
  it('이름을 알면 목록에서 무엇을 찾을지 알려준다', () => {
    const hint = longHintFor('guest', '지민', ours)

    expect(hint.lines.join('\n')).toContain('our-hotspot')
  })

  it('이름을 몰라도 자리를 비워두지 않는다', () => {
    const hint = longHintFor('guest', '지민', null)
    const text = hint.lines.join('\n')

    expect(text).not.toContain('{wifi}')
    expect(text).not.toContain('undefined')
  })

  it('누구를 가리키는지 이름으로 바꿔 넣는다', () => {
    const hint = longHintFor('host', '지민', ours)
    const text = hint.lines.join('\n')

    expect(text).toContain('지민')
    expect(text).not.toContain('{peer}')
  })
})

describe('연결 화면 글에는', () => {
  const phases = [
    'need-hotspot',
    'waiting-for-peer',
    'need-wifi',
    'looking',
    'found',
    'joining',
    'recovering',
  ] as const

  it.each(phases)('%s 단계에 기술 용어를 쓰지 않는다', phase => {
    // 여자친구는 이 앱이 어떻게 돌아가는지 모른다.
    // 게이트웨이나 소켓 같은 말이 뜨면 물어볼 사람도 없다.
    const copy = copyFor(phase, '지민', ours)
    const text = `${copy.title}\n${copy.detail}`

    for (const word of ['게이트웨이', '브로드캐스트', '소켓', 'IP', 'TCP']) {
      expect(text).not.toContain(word)
    }
  })

  it.each(phases)('%s 단계에 할 말이 비어 있지 않다', phase => {
    const copy = copyFor(phase, '지민', ours)

    expect(copy.title.length).toBeGreaterThan(0)
    expect(copy.detail.length).toBeGreaterThan(0)
  })
})
