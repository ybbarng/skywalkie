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

    expect(text).toContain('지민님은')
    expect(text).not.toContain('{peer')
  })

  it('상대를 모르면 이름 자리를 "상대" 로 채운다', () => {
    const host = longHintFor('host', null, ours).lines.join('\n')
    const guest = longHintFor('guest', null, ours).lines.join('\n')

    expect(host).toContain('상대는')
    expect(guest).toContain('상대 쪽에서')
    expect(`${host}\n${guest}`).not.toContain('{peer')
  })
})

/**
 * 상대 이름은 인사를 주고받아야 안다.
 *
 * **첫 연결 전에는 모른다.** 그런데 이 화면은 바로 그때 뜬다.
 * 예전에는 아무 이름이나 끼워 넣어서, 여자친구가 한 번도 말한 적 없는
 * 이름이 자기 화면에 떴다. 모를 때는 모른다고 적는다.
 */
describe('상대를 아직 모를 때', () => {
  const phases = [
    'need-hotspot',
    'waiting-for-peer',
    'need-wifi',
    'looking',
    'found',
    'joining',
    'recovering',
  ] as const

  it.each(phases)('%s 단계에 이름 자리를 비워두지 않는다', phase => {
    const copy = copyFor(phase, null, ours)
    const text = `${copy.title}\n${copy.detail}`

    expect(text).not.toContain('undefined')
    expect(text).not.toContain('null')
    expect(text.length).toBeGreaterThan(0)
  })

  it.each(phases)('%s 단계에 조사가 어긋나지 않는다', phase => {
    // "상대이" · "상대은" · "상대을" 은 한국어가 아니다.
    const copy = copyFor(phase, null, ours)
    const text = `${copy.title}\n${copy.detail}`

    for (const broken of ['상대이', '상대은', '상대을']) {
      expect(text).not.toContain(broken)
    }
  })

  it('이름을 알면 "님" 을 붙이고 조사를 맞춘다', () => {
    expect(copyFor('need-hotspot', '지민', ours).detail).toContain('지민님이')
    expect(copyFor('found', '지민', ours).title).toBe('지민님을 찾았어요')
  })

  it('이름을 모르면 "님" 을 붙이지 않는다', () => {
    // "상대님" 은 사람을 부르는 말이 아니다.
    expect(copyFor('need-hotspot', null, ours).detail).toContain('상대가')
    expect(copyFor('found', null, ours).title).toBe('상대를 찾았어요')
    expect(copyFor('need-hotspot', null, ours).detail).not.toContain('상대님')
  })

  it('빈 이름을 받아도 모르는 것으로 본다', () => {
    // 인사는 받았는데 이름이 비었다. "님이" 만 떠 있으면 안 된다.
    expect(copyFor('need-hotspot', '', ours).detail).toContain('상대가')
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
