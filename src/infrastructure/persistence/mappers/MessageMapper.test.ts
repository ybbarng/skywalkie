import { HER, makeDraft, makeReceived, makeText, makeUlid } from '@test/support/factories'
import { describe, expect, it } from 'vitest'
import {
  doodleContent,
  nudgeContent,
  systemContent,
} from '@/domain/message/MessageContent'
import type { MessageRow } from '../schema'
import { MessageMapper } from './MessageMapper'

describe('도메인과 표 사이 옮기기', () => {
  it('글 메시지를 옮겼다 되돌려도 같다', () => {
    const original = makeReceived({ content: makeText('34열 창가야') })

    const row = MessageMapper.toRow(original)
    const restored = MessageMapper.toDomain(row)

    expect(restored.ok && restored.value.id).toBe(original.id)
    expect(restored.ok && restored.value.content).toEqual(original.content)
    expect(restored.ok && restored.value.seq).toBe(original.seq)
    expect(restored.ok && restored.value.delivery).toBe(original.delivery)
  })

  it('낙서를 옮겼다 되돌려도 좌표가 그대로다', () => {
    const doodle = doodleContent([
      {
        points: [
          { x: 0.1, y: 0.2 },
          { x: 0.8, y: 0.9 },
        ],
        color: 'me',
        width: 3,
      },
    ])
    if (!doodle.ok) throw new Error('앞선 단계가 실패했다')
    const original = makeDraft({ content: doodle.value })

    const restored = MessageMapper.toDomain(MessageMapper.toRow(original))

    expect(restored.ok && restored.value.content).toEqual(doodle.value)
  })

  it('콕 찌르기와 앱 알림도 옮긴다', () => {
    const nudge = makeDraft({ content: nudgeContent() })
    const system = makeDraft({
      id: makeUlid(1758000001000),
      content: systemContent('link-lost'),
    })

    expect(MessageMapper.toDomain(MessageMapper.toRow(nudge)).ok).toBe(true)
    expect(MessageMapper.toDomain(MessageMapper.toRow(system)).ok).toBe(true)
  })

  it('받은 시각이 없는 메시지도 옮긴다', () => {
    const mine = makeDraft()

    const row = MessageMapper.toRow(mine)
    const restored = MessageMapper.toDomain(row)

    expect(row.received_at).toBeNull()
    expect(restored.ok && restored.value.receivedAt).toBeNull()
  })

  it('어느 길로 왔는지 함께 적는다', () => {
    const row = MessageMapper.toRow(makeReceived(), 'ble')

    expect(row.link_kind).toBe('ble')
  })
})

describe('읽을 때도 검사한다', () => {
  function row(overrides: Partial<MessageRow> = {}): MessageRow {
    return {
      id: makeUlid(1758000000000),
      author_id: HER,
      content_kind: 'text',
      content_body: JSON.stringify({ kind: 'text', text: '안녕' }),
      sent_at: 1758000000000,
      received_at: 1758000001000,
      seq: 1,
      delivery: 'delivered',
      link_kind: null,
      ...overrides,
    }
  }

  it('식별자가 망가졌으면 거절한다', () => {
    const result = MessageMapper.toDomain(row({ id: 'broken' }))

    expect(result.ok).toBe(false)
  })

  it('내용이 JSON 이 아니면 거절한다', () => {
    // 손으로 고친 보관 파일이 들어올 수 있다
    const result = MessageMapper.toDomain(row({ content_body: '{{{' }))

    expect(!result.ok && result.error.detail).toContain('읽지 못했다')
  })

  it('종류와 내용이 어긋나면 거절한다', () => {
    const result = MessageMapper.toDomain(
      row({
        content_kind: 'doodle',
        content_body: JSON.stringify({ kind: 'text', text: 'x' }),
      }),
    )

    expect(!result.ok && result.error.detail).toContain('어긋난다')
  })

  it('모르는 전달 상태면 거절한다', () => {
    // 나중 버전이 만든 값이 옛 앱에 들어올 수 있다
    const result = MessageMapper.toDomain(row({ delivery: 'teleported' }))

    expect(!result.ok && result.error.detail).toContain('모르는 전달 상태')
  })

  it('순번이 0이면 거절한다', () => {
    const result = MessageMapper.toDomain(row({ seq: 0 }))

    expect(result.ok).toBe(false)
  })

  it('거절해도 앱이 죽지 않는다', () => {
    // 예외를 던지지 않고 값으로 돌려준다
    expect(() => MessageMapper.toDomain(row({ content_body: 'null' }))).not.toThrow()
  })
})
