import { describe, expect, it } from 'vitest'
import {
  doodleContent,
  nudgeContent,
  photoContent,
  stickerContent,
  systemContent,
  textContent,
} from '@/domain/message/MessageContent'
import { notificationBody, worthNotifying } from './notify'

/**
 * 잠금 화면에 뜨는 글.
 *
 * **폰을 내려놔도 상대가 말을 걸면 알아야 한다.** 이게 없으면 앱을
 * 보고 있을 때만 대화가 된다.
 */

function must<T>(result: { ok: boolean; value?: T; error?: unknown }): T {
  if (!result.ok) throw new Error('만들지 못했다')
  return result.value as T
}

describe('무엇이 왔는지 한 줄로', () => {
  it('글은 그대로 보여준다', () => {
    // 열어보기 전에 무슨 말인지 알아야 열지 말지 정한다
    expect(notificationBody(must(textContent('기내식 나왔어')))).toBe('기내식 나왔어')
  })

  it('글이 아닌 것도 무엇이 왔는지는 알린다', () => {
    expect(notificationBody(must(stickerContent('aria', 'heart')))).toContain('이모티콘')
    expect(notificationBody(nudgeContent())).toContain('콕')
    expect(
      notificationBody(
        must(doodleContent([{ points: [{ x: 0, y: 0 }], color: 'me', width: 2 }])),
      ),
    ).toContain('낙서')
  })

  it('사진에 붙인 말이 있으면 그걸 보여준다', () => {
    // "사진을 보냈어요" 보다 "창밖 좀 봐" 가 알아보기 쉽다
    const photo = must(
      photoContent({
        assetId: '01JABCDEFGHJKMNPQRSTVWXYZ0',
        width: 100,
        height: 100,
        byteLength: 1000,
        caption: '창밖 좀 봐',
      }),
    )

    expect(notificationBody(photo)).toBe('창밖 좀 봐')
  })

  it('붙인 말이 없으면 사진이라고만 한다', () => {
    const photo = must(
      photoContent({
        assetId: '01JABCDEFGHJKMNPQRSTVWXYZ0',
        width: 100,
        height: 100,
        byteLength: 1000,
      }),
    )

    expect(notificationBody(photo)).toContain('사진')
  })

  it('어느 종류든 빈칸을 내놓지 않는다', () => {
    // 빈 알림이 뜨면 뭐가 왔는지 모른 채 열어봐야 한다
    const everything = [
      must(textContent('안녕')),
      must(stickerContent('aria', 'wave')),
      nudgeContent(),
      must(doodleContent([{ points: [{ x: 0, y: 0 }], color: 'me', width: 2 }])),
    ]

    for (const content of everything) {
      expect(notificationBody(content).length).toBeGreaterThan(0)
    }
  })
})

describe('띄울 만한가', () => {
  it('앱이 끼워 넣은 알림은 안 띄운다', () => {
    // **"연결이 끊겼어요" 가 뜰 때마다 폰이 울리면** 비행기에서 내내
    // 시끄럽다. 그건 앱을 열었을 때만 본다.
    expect(worthNotifying(systemContent('link-lost'))).toBe(false)
    expect(worthNotifying(systemContent('link-restored'))).toBe(false)
  })

  it('사람이 보낸 것은 띄운다', () => {
    expect(worthNotifying(must(textContent('안녕')))).toBe(true)
    expect(worthNotifying(nudgeContent())).toBe(true)
    expect(worthNotifying(must(stickerContent('aria', 'heart')))).toBe(true)
  })
})
