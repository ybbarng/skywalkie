import type { Profile } from '@/composition/services'

/**
 * 첫 실행 안내에 쓰는 글.
 *
 * **말을 나눌 수 없는 두 사람이 각자 화면만 보고 연결에 성공해야 한다.**
 * 그래서 여기 있는 글이 곧 제품의 질이다.
 *
 * 쓸 때 지킬 것
 *   · 한 단계에 할 일 하나만 적는다
 *   · "무엇을 누르면 되는지"를 먼저 적는다
 *   · 상대가 할 일을 같이 적지 않는다. 헷갈린다
 *
 * (docs/07-design-system.md 8장 · T12)
 */

export type Role = Profile['role']

export interface ConnectStep {
  readonly title: string
  readonly detail: string
  /** 설정 화면으로 데려다줄 수 있는 단계인가 */
  readonly opensSettings?: boolean
}

/**
 * 역할마다 할 일이 완전히 다르다.
 *
 * 핫스팟을 켜는 쪽은 "열어주고 보여주는" 일을, 붙는 쪽은 "찾아서 붙는"
 * 일을 한다. 두 벌을 한 화면에 같이 보여주면 자기 것이 어느 쪽인지
 * 헷갈린다.
 */
export const connectSteps: Record<Role, readonly ConnectStep[]> = {
  host: [
    {
      title: '핫스팟을 켜요',
      detail: '내 폰이 작은 Wi-Fi 공유기가 돼요. 인터넷이 없어도 두 폰을 이어줍니다.',
      opensSettings: true,
    },
    {
      title: '이름과 비밀번호를 보여줘요',
      detail: '설정 화면에 떠 있어요. 상대가 그걸 보고 들어옵니다.',
    },
    {
      title: '자리에 앉으면 핫스팟만 다시 켜요',
      detail:
        '비행기 모드를 켜면 핫스팟이 꺼져요. 다시 켜기만 하면 상대는 알아서 들어옵니다.',
    },
  ],
  guest: [
    {
      title: '상대 폰 이름을 Wi-Fi 목록에서 골라요',
      detail: '상대가 보여주는 화면에 이름과 비밀번호가 떠 있어요.',
      opensSettings: true,
    },
    {
      title: '들어가면 알아서 찾아요',
      detail: '주소를 입력할 일은 없어요. 앱이 상대를 스스로 찾습니다.',
    },
    {
      title: '자리에 앉으면 Wi-Fi 만 켜면 돼요',
      detail:
        '폰이 기억하고 있어서 비밀번호를 다시 넣을 일은 없어요. 알아서 다시 들어갑니다.',
    },
  ],
}

/**
 * 왜 내가 이 역할인지 한 줄로 알려준다.
 *
 * **고르게 하지 않는다.** 아이폰은 앱에서 핫스팟을 켤 수 없어서
 * 선택지가 실질적으로 하나뿐이다. 물어보면 헷갈림만 는다.
 */
export const roleReason = {
  host: '안드로이드 폰이라 핫스팟을 여는 쪽을 맡아요',
  guest: '아이폰이라 들어가는 쪽을 맡아요',
} as const

/**
 * 새 말이 왔을 때 어떻게 알릴까.
 *
 * **기본은 진동이다.** 비행기는 시끄러워서 소리는 잘 안 들리고,
 * 상대는 이어폰을 꽂고 있어서 오히려 놀란다. 옆자리 승객도 있다.
 */
export const alertModeChoice = {
  vibrate: {
    label: '진동',
    detail: '주머니에 넣어둬도 알 수 있어요. 옆자리에는 안 들려요.',
  },
  sound: {
    label: '소리',
    detail: '소리까지 나요. 비행기가 시끄러우면 이게 나을 수 있어요.',
  },
  silent: {
    label: '무음',
    detail: '아무 소리도 진동도 없어요. 알림 목록에만 쌓입니다.',
  },
} as const

export const audioModeChoice = {
  'push-to-talk-brief': {
    label: '말할 때만 잠깐',
    detail: '버튼을 누를 때만 마이크가 켜져요. 음악이 대부분 시간 동안 온전합니다.',
    recommended: true,
  },
  'phone-mic': {
    label: '폰에 대고 말하기',
    detail: '이어폰은 듣기만 해요. 음악 음질이 계속 좋지만 폰을 입 가까이 들어야 해요.',
    recommended: false,
  },
  'like-a-call': {
    label: '전화처럼',
    detail: '이어폰으로 듣고 말해요. 편하지만 음악 음질이 통화 내내 떨어집니다.',
    recommended: false,
  },
} as const

/** 연결 안내 맨 위에 붙이는 말 */
export const connectIntro = {
  host: '떨어져 앉기 전에 지금 해두세요. 한 번 이어두면 자리에서는 핫스팟만 다시 켜면 됩니다.',
  guest:
    '떨어져 앉기 전에 지금 해두세요. 한 번 들어가두면 폰이 기억해서 자리에서는 알아서 들어갑니다.',
} as const

export const welcome = {
  title: '비행기에서도 이야기해요',
  lines: [
    '떨어져 앉아도 괜찮아요.',
    '기내 Wi-Fi 를 사지 않아도 되고,',
    '두 폰만 있으면 됩니다.',
  ],
  note: '먼저 몇 가지만 정할게요. 1분이면 끝나요.',
}

/** 왜 이 권한이 필요한지. 이유 없이 물으면 사람은 거절한다 */
export const permissionReasons = {
  nearby: '같은 Wi-Fi 에 있는 상대 폰을 찾으려면 필요해요.',
  microphone: '상대에게 목소리를 전하려면 필요해요.',
  notification: '메시지가 오면 알려드릴게요.',
} as const
