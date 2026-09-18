import type { StickerPose } from '@/domain/message/MessageContent'

/**
 * 이모티콘이 무슨 말인가.
 *
 * **그림만으로는 애매한 것이 있다.** 팔짱을 낀 건 "안 돼"인지 "추워"인지
 * 헷갈리고, 손을 든 건 인사인지 화장실인지 헷갈린다. 스물아홉 개나
 * 되니 더 그렇다.
 *
 * 그래서 **길게 누르면 무슨 말인지 알려준다.** 짧게 누르면 바로
 * 나가므로, 확인하고 싶을 때만 길게 누르면 된다.
 *
 * 말투는 보내는 사람이 하는 말 그대로다. "손 흔들기"가 아니라 "안녕"이다.
 * 고르는 사람이 **하고 싶은 말**을 찾지, 자세 이름을 찾지 않는다.
 */
export function stickerMeaning(pose: StickerPose): string {
  switch (pose) {
    // 건네는 말
    case 'wave':
      return '안녕'
    case 'thumbsUp':
      return '좋아'
    case 'heart':
      return '사랑해'
    case 'miss':
      return '보고 싶어'
    case 'laugh':
      return '웃겨'
    case 'wink':
      return '윙크'
    case 'shy':
      return '부끄러워'
    case 'excited':
      return '신나'
    case 'please':
      return '부탁해'
    case 'clap':
      return '잘했어'

    // 기분
    case 'think':
      return '궁금해'
    case 'surprised':
      return '깜짝이야'
    case 'no':
      return '안 돼'
    case 'angry':
      return '화났어'
    case 'stuffy':
      return '답답해'
    case 'loud':
      return '시끄러워'
    case 'scared':
      return '무서워'
    case 'cry':
      return '슬퍼'
    case 'sorry':
      return '미안해'
    case 'bored':
      return '심심해'

    // 몸
    case 'sleep':
      return '졸려'
    case 'stiff':
      return '뻐근해'
    case 'cold':
      return '추워'
    case 'hot':
      return '더워'
    case 'toilet':
      return '화장실 갈래'
    case 'eat':
      return '먹는 중'
    case 'hungry':
      return '배고파'
    case 'yummy':
      return '맛있어'
    case 'full':
      return '배불러'
  }
}

/** 화면 읽어주는 기능이 말할 것 */
export function describePose(pose: StickerPose): string {
  return `${stickerMeaning(pose)} 이모티콘`
}
