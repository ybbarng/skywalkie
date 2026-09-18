import type { MessageContent } from '@/domain/message/MessageContent'

/**
 * 알림에 뜨는 글.
 *
 * **잠금 화면에 뜨는 글이라 한 줄이 전부다.** 누가 무슨 말을 했는지
 * 바로 보여야 열어볼지 정할 수 있다.
 *
 * 글이 아닌 것은 무엇이 왔는지만 적는다. 낙서를 글로 옮길 수는 없어도
 * "낙서를 보냈어요" 는 알 수 있다.
 */
export function notificationBody(content: MessageContent): string {
  switch (content.kind) {
    case 'text':
      // 잠금 화면은 두 줄쯤 보여준다. 길면 뒤가 잘리는데,
      // 그건 운영체제가 알아서 한다. 여기서 자르면 애매하게 잘린다.
      return content.text

    case 'sticker':
      return '이모티콘을 보냈어요'

    case 'doodle':
      return '낙서를 보냈어요'

    case 'photo':
      return content.caption ?? '사진을 보냈어요'

    case 'voice':
      return `음성 메시지를 보냈어요 (${Math.round(content.durationMs / 1000)}초)`

    case 'nudge':
      return '콕 찔렀어요'

    case 'system':
      // 앱이 끼워 넣은 알림까지 잠금 화면에 띄우면 시끄럽다
      return ''
  }
}

/**
 * 잠금 화면에 띄울 만한가.
 *
 * **앱이 끼워 넣은 알림은 안 띄운다.** "연결이 끊겼어요" 가 뜰 때마다
 * 폰이 울리면 비행기에서 내내 시끄럽다. 그건 앱을 열었을 때만 본다.
 */
export function worthNotifying(content: MessageContent): boolean {
  return content.kind !== 'system'
}

export const notificationChannel = {
  id: 'messages',
  name: '메시지',
  description: '상대가 말을 걸면 알려줘요',
} as const

/** 권한을 왜 물어보는지. 이유 없이 물으면 사람은 거절한다 */
export const notificationReason = '폰을 내려놔도 상대가 말을 걸면 알려드릴게요.'
