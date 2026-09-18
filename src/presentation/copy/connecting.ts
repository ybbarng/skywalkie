import { type HomeHotspot, homeHotspot } from '@/composition/hotspot'
import type { Profile } from '@/composition/services'
import { asObject, asSubject, asTopic } from './josa'

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
  /** 안드로이드: 핫스팟이 꺼져 있다. 처음이든 도중에 꺼졌든 */
  | 'need-hotspot'
  /** 안드로이드: 켰고 상대를 기다린다 */
  | 'waiting-for-peer'
  /** 아이폰: 상대 Wi-Fi 밖에 있다. 처음이든 도중에 빠졌든 */
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

/**
 * 핫스팟을 안 적어뒀을 때 이름 자리에 넣는 말.
 *
 * 예전처럼 **상대 화면을 보고 들어가는** 길로 되돌아간다.
 */
const UNKNOWN_WIFI = '상대 폰 이름'

/**
 * 상대를 부르는 말.
 *
 * 이름은 두 군데서 온다.
 *
 *   · 상대가 고른 이름 — 인사를 주고받아야 안다
 *   · 내가 붙여둔 별명 — 첫 실행 안내에서 적는다. "여자친구"
 *
 * 둘 다 없으면 "상대" 라고 쓴다.
 *
 * **"님" 을 붙이지 않는다.** 이름에는 붙여도 되지만 "여자친구님" 은
 * 어색하다. 대신 받침을 보고 조사를 고른다(`josa.ts`). 그래야
 * "여자친구가" 와 "지민이" 가 둘 다 맞는다.
 */
interface PeerWords {
  /** 지민 · 여자친구 · 상대 */
  readonly name: string
  /** 지민이 · 여자친구가 */
  readonly subject: string
  /** 지민은 · 여자친구는 */
  readonly topic: string
  /** 지민을 · 여자친구를 */
  readonly object: string
}

function wordsFor(peerName: string | null): PeerWords {
  const name = peerName === null || peerName.length === 0 ? '상대' : peerName

  return {
    name,
    subject: asSubject(name),
    topic: asTopic(name),
    object: asObject(name),
  }
}

/**
 * 핫스팟을 밖에서 받는다. 받지 않으면 `.env` 에 적어둔 것을 쓴다.
 * 적어두지 않았을 때 어떻게 말하는지를 시험할 수 있어야 해서 열어뒀다.
 *
 * `peerName` 이 `null` 이면 아직 상대를 모른다는 뜻이다.
 */
export function copyFor(
  phase: ConnectPhase,
  peerName: string | null,
  hotspot: HomeHotspot | null = homeHotspot,
): PhaseCopy {
  const peer = wordsFor(peerName)

  switch (phase) {
    // 처음 켤 때와 비행기에서 꺼졌을 때 둘 다 여기로 온다.
    // **둘 다 할 일이 같으므로** 두 경우에 다 맞는 말로 적는다.
    // 처음 켤 때와 비행기에서 꺼졌을 때 둘 다 여기로 온다.
    // **둘 다 할 일이 같으므로** 두 경우에 다 맞는 말로 적는다.
    case 'need-hotspot':
      return {
        title: '핫스팟만 켜면 연결돼요',
        detail: `켜두면 ${peer.subject} 들어올 때 저절로 연결돼요.\n비행기 모드를 켜면 같이 꺼지니 그때마다 다시 켜주세요.`,
        action: '핫스팟 켜러 가기',
      }

    case 'waiting-for-peer':
      return {
        title: '이제 기다리기만 하면 돼요',
        detail: `${peer.subject} Wi-Fi 에 들어오면 저절로 연결돼요.\n더 누를 것은 없어요.`,
      }

    // 이름을 앱이 알고 있으니 물어볼 필요가 없다.
    // 안 보이는 건 상대가 껐기 때문일 수 있다는 것까지 알려준다.
    // **내가 잘못한 게 아니라는 걸 알아야 마음이 놓인다.**
    case 'need-wifi':
      return {
        title: 'Wi-Fi 만 고르면 연결돼요',
        detail:
          hotspot === null
            ? `설정에서 ${peer.name} 폰 이름을 골라주세요.\n고르고 나면 저절로 연결돼요.`
            : `Wi-Fi 목록에서 ${hotspot.ssid} 를 골라주세요.\n고르고 나면 저절로 연결돼요.`,
        action: 'Wi-Fi 고르러 가기',
      }

    case 'looking':
      return {
        title: '연결하는 중이에요',
        detail: `${peer.object} 찾고 있어요.\n더 누를 것은 없어요.`,
      }

    case 'found':
      return {
        title: `${peer.object} 찾았어요`,
        detail: '바로 연결할게요.',
      }

    case 'joining':
      return {
        title: '연결하는 중',
        detail: '잠깐만요.',
      }

    case 'recovering':
      return {
        title: '잠깐 멀어졌어요',
        detail: '알아서 다시 연결할게요. 그동안 쓴 말은 사라지지 않아요.',
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
      '{peer.topic} Wi-Fi 만 켜면 돼요',
      '거기에 {wifi} 가 떠 있어야 해요',
      '비행기 모드를 켰어도 Wi-Fi 는 따로 켤 수 있어요',
    ],
  },
  guest: {
    title: '목록에 안 보이나요?',
    lines: [
      '{peer.name} 쪽에서 아직 안 켰을 수도 있어요. 조금 뒤에 다시 보세요',
      '목록에 {wifi} 가 있는지 보고, 없으면 아래로 당겨 새로고침해 보세요',
      '비행기 모드를 켰어도 Wi-Fi 는 따로 켤 수 있어요',
    ],
  },
} as const

export function longHintFor(
  role: Role,
  peerName: string | null,
  hotspot: HomeHotspot | null = homeHotspot,
) {
  const hint = takingLong[role]
  const peer = wordsFor(peerName)
  const wifi = hotspot?.ssid ?? UNKNOWN_WIFI

  return {
    title: hint.title,
    lines: hint.lines.map(line =>
      line
        .replace('{peer.topic}', peer.topic)
        .replace('{peer.name}', peer.name)
        .replace('{wifi}', wifi),
    ),
  }
}
