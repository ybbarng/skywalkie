import { FakeClock } from '@test/fakes/FakeClock'
import { FakeConversationRepository } from '@test/fakes/FakeConversationRepository'
import {
  HER,
  ME,
  makeDraft,
  makeReceived,
  makeText,
  ulidSequence,
} from '@test/support/factories'
import { describe, expect, it } from 'vitest'
import { doodleContent, systemContent } from '@/domain/message/MessageContent'
import type { DomainError } from '@/domain/shared/DomainError'
import { ok, type Result } from '@/domain/shared/Result'
import { sha256Hex } from '@/infrastructure/archive/Sha256'
import type { Hasher } from '../ports/FileStore'
import { ExportConversation } from './ExportConversation'
import { escapeHtml } from './renderHtml'

/**
 * 사람이 읽는 두 형식.
 *
 * 되돌릴 수는 없다. **읽으려고 만드는 것이다.** 그래서 여기서 볼 것은
 * "빠짐없이 들어갔나"와 "깨지지 않나" 두 가지다.
 */

const hasher: Hasher = {
  async sha256(value: string): Promise<Result<string, DomainError>> {
    return ok(sha256Hex(value))
  },
}

const people = [
  { peerId: ME, displayName: '나', character: 'orion' },
  { peerId: HER, displayName: '지민', character: 'aria' },
]

async function exporterWith(
  fill: (repository: FakeConversationRepository) => Promise<void>,
): Promise<ExportConversation> {
  const repository = new FakeConversationRepository()
  await fill(repository)
  return new ExportConversation({ repository, hasher, clock: new FakeClock() })
}

describe('HTML 로 꺼내기', () => {
  it('바깥에서 아무것도 불러오지 않는다', async () => {
    // **비행기에서 열어볼 수 있어야 한다.** 글꼴이든 스타일이든
    // 바깥에서 가져오게 해두면 인터넷이 없을 때 전부 빈칸이 된다.
    const exporter = await exporterWith(async repository => {
      await repository.save(makeDraft({ content: makeText('안녕') }))
    })

    const html = await exporter.toHtml({ people, me: ME })

    expect(html.ok).toBe(true)
    if (!html.ok) return
    expect(html.value).not.toContain('http://')
    expect(html.value).not.toContain('https://')
    expect(html.value).not.toContain('<script')
  })

  it('밝은 화면과 어두운 화면을 둘 다 그린다', async () => {
    const exporter = await exporterWith(async repository => {
      await repository.save(makeDraft())
    })

    const html = await exporter.toHtml({ people, me: ME })

    expect(html.ok).toBe(true)
    if (!html.ok) return
    expect(html.value).toContain('prefers-color-scheme: dark')
  })

  it('내가 한 말과 상대가 한 말을 가른다', async () => {
    const nextId = ulidSequence()
    const exporter = await exporterWith(async repository => {
      await repository.save(makeDraft({ id: nextId(), content: makeText('내가 한 말') }))
      await repository.save(
        makeReceived({ id: nextId(), content: makeText('상대가 한 말') }),
      )
    })

    const html = await exporter.toHtml({ people, me: ME })

    expect(html.ok).toBe(true)
    if (!html.ok) return
    expect(html.value).toContain('class="row mine"')
    expect(html.value).toContain('class="row"')
    expect(html.value).toContain('내가 한 말')
    expect(html.value).toContain('상대가 한 말')
  })

  it('낙서를 SVG 로 그린다', async () => {
    // 그림 파일로 바꾸면 파일이 커지고 크게 볼 때 흐려진다
    const doodle = doodleContent([
      {
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        color: 'me',
        width: 3,
      },
    ])
    if (!doodle.ok) throw new Error('낙서를 만들지 못했다')

    const exporter = await exporterWith(async repository => {
      await repository.save(makeDraft({ content: doodle.value }))
    })

    const html = await exporter.toHtml({ people, me: ME })

    expect(html.ok).toBe(true)
    if (!html.ok) return
    expect(html.value).toContain('<svg')
    expect(html.value).toContain('<path d="M0.0 0.0 L280.0 180.0"')
  })

  it('앱이 끼워 넣은 알림은 가운데 한 줄로 적는다', async () => {
    const exporter = await exporterWith(async repository => {
      await repository.save(makeDraft({ content: systemContent('link-lost') }))
    })

    const html = await exporter.toHtml({ people, me: ME })

    expect(html.ok).toBe(true)
    if (!html.ok) return
    expect(html.value).toContain('연결이 끊겼어요')
  })
})

describe('꺾쇠가 들어간 말은', () => {
  it('파일을 깨뜨리지 않는다', async () => {
    // **`<` 하나로 파일이 통째로 깨진다.** 대화에 꺾쇠가 들어가는 건
    // 흔한 일이다. "<-- 이거 봐" 같은 말을 쓴다.
    const exporter = await exporterWith(async repository => {
      await repository.save(
        makeDraft({ content: makeText('<script>alert(1)</script> <-- 이거 봐') }),
      )
    })

    const html = await exporter.toHtml({ people, me: ME })

    expect(html.ok).toBe(true)
    if (!html.ok) return
    expect(html.value).not.toContain('<script>alert(1)')
    expect(html.value).toContain('&lt;script&gt;')
  })

  it('이름에 들어가도 마찬가지다', async () => {
    const exporter = await exporterWith(async repository => {
      await repository.save(makeDraft())
    })

    const html = await exporter.toHtml({
      people: [{ peerId: ME, displayName: '<b>나</b>', character: 'orion' }],
      me: ME,
    })

    expect(html.ok).toBe(true)
    if (!html.ok) return
    expect(html.value).toContain('&lt;b&gt;')
  })

  it('바꾼 글자를 두 번 바꾸지 않는다', () => {
    // & 를 먼저 바꿔야 한다. 나중에 바꾸면 &lt; 가 &amp;lt; 가 된다.
    expect(escapeHtml('a & b < c')).toBe('a &amp; b &lt; c')
  })
})

describe('글로 꺼내기', () => {
  it('누가 언제 무슨 말을 했는지 적는다', async () => {
    const exporter = await exporterWith(async repository => {
      await repository.save(makeDraft({ content: makeText('34열 창가야') }))
    })

    const text = await exporter.toText({ people })

    expect(text.ok).toBe(true)
    if (!text.ok) return
    expect(text.value).toContain('나: 34열 창가야')
    expect(text.value).toMatch(/\[\d{2}:\d{2}\]/)
  })

  it('글이 아닌 것도 무엇이었는지 남긴다', async () => {
    // 낙서는 글로 옮길 수 없지만, 있었다는 것은 남아야 한다
    const doodle = doodleContent([
      { points: [{ x: 0.1, y: 0.2 }], color: 'me', width: 2 },
    ])
    if (!doodle.ok) throw new Error('낙서를 만들지 못했다')

    const exporter = await exporterWith(async repository => {
      await repository.save(makeDraft({ content: doodle.value }))
    })

    const text = await exporter.toText({ people })

    expect(text.ok).toBe(true)
    if (!text.ok) return
    expect(text.value).toContain('낙서 1줄')
  })

  it('날짜가 바뀌면 사이에 적는다', async () => {
    const nextId = ulidSequence()
    const exporter = await exporterWith(async repository => {
      await repository.save(
        makeDraft({ id: nextId(), seq: 1, now: new Date('2026-09-18T10:00:00') }),
      )
      await repository.save(
        makeDraft({ id: nextId(), seq: 2, now: new Date('2026-09-19T10:00:00') }),
      )
    })

    const text = await exporter.toText({ people })

    expect(text.ok).toBe(true)
    if (!text.ok) return
    expect(text.value).toContain('2026년 9월 18일')
    expect(text.value).toContain('2026년 9월 19일')
  })

  it('모르는 사람이면 식별자를 그대로 보여준다', async () => {
    // 상대 기기에서 만든 파일을 열 때 이럴 수 있다. 멈추지 않는다.
    const exporter = await exporterWith(async repository => {
      await repository.save(makeReceived())
    })

    const text = await exporter.toText({ people: [] })

    expect(text.ok).toBe(true)
    if (!text.ok) return
    expect(text.value).toContain(HER)
  })
})
