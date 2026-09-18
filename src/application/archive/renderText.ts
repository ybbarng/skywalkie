import type { ArchivedMessage, ArchivedPerson } from './ArchiveFormat'

/**
 * 어디서든 열리는 가장 단순한 형태.
 *
 * 되돌릴 수는 없다. **읽으려고 만드는 것이다.** 메모장이든 메일이든
 * 어디에 붙여넣어도 그대로 읽힌다.
 *
 * 시각은 꺼내는 기기의 시간대로 적는다. 여행에서 돌아와 읽을 때
 * 익숙한 시각으로 보이는 편이 낫다.
 */

export function renderTextHeader(people: readonly ArchivedPerson[]): string {
  const names = people.map(person => person.displayName).join(' · ')
  return `${names}\n${'─'.repeat(30)}\n\n`
}

export function renderTextMessage(
  message: ArchivedMessage,
  nameOf: (peerId: string) => string,
): string {
  const at = new Date(message.receivedAt ?? message.sentAt)
  return `[${formatTime(at)}] ${nameOf(message.author)}: ${describe(message)}\n`
}

/** 날짜가 바뀌면 사이에 넣는다 */
export function renderDateBreak(at: Date): string {
  return `\n── ${formatDate(at)} ──\n\n`
}

/** 내용을 한 줄 글로. 글이 아닌 것도 무엇이었는지는 남긴다 */
export function describe(message: ArchivedMessage): string {
  const content = message.content

  switch (content.kind) {
    case 'text':
      return content.text
    case 'doodle':
      return `(낙서 ${content.strokes.length}줄)`
    case 'sticker':
      return `(${poseWord(content.pose)})`
    case 'nudge':
      return '(콕 찔렀어요)'
    case 'system':
      return `(${systemNotice(content.notice)})`
  }
}

/** 자세를 글로. 이모티콘은 글로 옮길 수 없지만 무엇이었는지는 남는다 */
export function poseWord(pose: string): string {
  switch (pose) {
    case 'wave':
      return '손 흔들기'
    case 'sleep':
      return '자는 중'
    case 'heart':
      return '하트'
    case 'laugh':
      return '웃음'
    case 'cry':
      return '울음'
    case 'thumbsUp':
      return '엄지척'
    case 'eat':
      return '먹는 중'
    case 'bored':
      return '심심해'
    default:
      // 모르는 자세가 와도 멈추지 않는다. 다른 버전이 보낸 것일 수 있다.
      return '이모티콘'
  }
}

export function systemNotice(notice: string): string {
  switch (notice) {
    case 'link-lost':
      return '연결이 끊겼어요'
    case 'link-restored':
      return '다시 이어졌어요'
    case 'switched-to-bluetooth':
      return '블루투스로 바꿨어요'
    case 'switched-to-wifi':
      return 'Wi-Fi 로 바꿨어요'
    case 'call-ended':
      return '통화가 끝났어요'
    case 'conversation-imported':
      return '대화를 되돌렸어요'
    default:
      // 모르는 알림이 와도 멈추지 않는다. 다른 버전이 만든 파일일 수 있다.
      return '알림'
  }
}

export function formatTime(at: Date): string {
  const hour = String(at.getHours()).padStart(2, '0')
  const minute = String(at.getMinutes()).padStart(2, '0')
  return `${hour}:${minute}`
}

export function formatDate(at: Date): string {
  return `${at.getFullYear()}년 ${at.getMonth() + 1}월 ${at.getDate()}일`
}

/** 같은 날인가. 날짜 구분선을 넣을지 정하는 데 쓴다 */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}
