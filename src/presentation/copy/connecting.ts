import type { Profile } from '@/composition/services'

/**
 * 연결 화면에 쓰는 글.
 *
 * **여자친구는 이 앱이 어떻게 돌아가는지 모른다.** 떨어져 앉아 물어볼
 * 수도 없다. 그래서 여기 있는 글이 유일한 설명이다.
 *
 * 쓸 때 지킬 것
 *   · 기술 용어를 쓰지 않는다 — 게이트웨이, 브로드캐스트, IP, 소켓
 *   · 진행 숫자를 보여주지 않는다 — "96/253" 은 불안만 준다
 *   · 지금 무슨 일이 일어나는지 한 줄로, 할 일이 있으면 한 가지만
 *   · 기다리라는 말 대신 무엇을 기다리는지 적는다
 */

export type Role = Profile['role']

/** 지금 어느 단계인가. 기술이 아니라 사람이 보는 단계다 */
export type ConnectPhase =
  /** 안드로이드: 핫스팟을 아직 안 켰다 */
  | 'need-hotspot'
  /** 안드로이드: 켰고 상대를 기다린다 */
  | 'waiting-for-peer'
  /** 아이폰: 상대 Wi-Fi 에 아직 안 붙었다 */
  | 'need-wifi'
  /** 아이폰: 붙었고 상대를 찾는 중 */
  | 'looking'
  /** 찾았다 */
  | 'found'
  /** 붙는 중 */
  | 'joining'
  /** 끊겨서 다시 붙는 중 */
  | 'recovering'

interface PhaseCopy {
  readonly title: string
  readonly detail: string
  /** 사람이 할 일이 있으면 그 버튼 이름 */
  readonly action?: string
}

export function copyFor(phase: ConnectPhase, peerName: string): PhaseCopy {
  switch (phase) {
    case 'need-hotspot':
      return {
        title: '내 폰으로 이어줄게요',
        detail: `${peerName}님이 들어올 수 있게 잠깐만 설정을 열어요.\n한 번만 켜두면 나머지는 알아서 됩니다.`,
        action: '핫스팟 켜러 가기',
      }

    case 'waiting-for-peer':
      return {
        title: '준비됐어요',
        detail: `${peerName}님이 들어오기를 기다리는 중이에요.\n들어오면 바로 알려드릴게요.`,
      }

    case 'need-wifi':
      return {
        title: `${peerName}님을 찾는 중`,
        detail: `설정에서 ${peerName}님 폰 이름을 골라주세요.\n화면을 보여달라고 하면 이름이 크게 떠 있어요.`,
        action: 'Wi-Fi 고르러 가기',
      }

    case 'looking':
      return {
        title: '거의 다 됐어요',
        detail: '근처를 둘러보는 중이에요. 곧 만나요.',
      }

    case 'found':
      return {
        title: `${peerName}님을 찾았어요`,
        detail: '바로 이어드릴게요.',
      }

    case 'joining':
      return {
        title: '이어지는 중',
        detail: '잠깐만요.',
      }

    case 'recovering':
      return {
        title: '잠깐 멀어졌어요',
        detail: '알아서 다시 이어드릴게요. 그동안 쓴 말은 사라지지 않아요.',
      }
  }
}

/**
 * 오래 걸릴 때 덧붙이는 말.
 *
 * 처음부터 보여주면 "안 되나 보다" 싶어진다. 한참 지난 뒤에만 띄운다.
 */
export const takingLong = {
  host: {
    title: '아직 안 들어왔나요?',
    lines: [
      `${'{peer}'}님 폰에서 Wi-Fi 목록을 열어달라고 해보세요`,
      '내 폰 이름이 거기 떠 있어야 해요',
      '비행기 모드를 켰어도 Wi-Fi 는 따로 켤 수 있어요',
    ],
  },
  guest: {
    title: '목록에 안 보이나요?',
    lines: [
      `${'{peer}'}님에게 핫스팟을 켰는지 물어보세요`,
      'Wi-Fi 목록을 아래로 당겨 새로고침해 보세요',
      '비행기 모드를 켰어도 Wi-Fi 는 따로 켤 수 있어요',
    ],
  },
} as const

export function longHintFor(role: Role, peerName: string) {
  const hint = takingLong[role]
  return {
    title: hint.title,
    lines: hint.lines.map(line => line.replace('{peer}', peerName)),
  }
}
