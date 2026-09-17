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
      title: '비행기 모드를 켜요',
      detail: '기내에서는 켜야 해요. 집에서 미리 해볼 때도 똑같이 켜보세요.',
    },
    {
      title: 'Wi-Fi 를 켜요',
      detail: '비행기 모드를 켠 뒤에도 Wi-Fi 는 따로 켤 수 있어요.',
    },
    {
      title: '핫스팟을 켜요',
      detail: '내 폰이 작은 Wi-Fi 공유기가 돼요. 인터넷이 없어도 두 폰을 이어줍니다.',
      opensSettings: true,
    },
    {
      title: '이 화면을 상대에게 보여줘요',
      detail: '상대가 이 이름을 목록에서 찾아 비밀번호를 넣으면 됩니다.',
    },
  ],
  guest: [
    {
      title: '비행기 모드를 켜요',
      detail: '기내에서는 켜야 해요. 집에서 미리 해볼 때도 똑같이 켜보세요.',
    },
    {
      title: 'Wi-Fi 를 켜요',
      detail: '비행기 모드를 켠 뒤에도 Wi-Fi 는 따로 켤 수 있어요.',
    },
    {
      title: '상대 폰 이름을 목록에서 골라요',
      detail: '상대가 보여주는 화면에 이름과 비밀번호가 크게 떠 있어요.',
      opensSettings: true,
    },
    {
      title: '붙으면 알아서 찾아요',
      detail: '주소를 입력할 필요 없어요. 앱이 상대를 스스로 찾습니다.',
    },
  ],
}

export const roleChoice = {
  host: {
    label: '내가 열어줄게요',
    detail: '핫스팟을 켜서 둘만의 Wi-Fi 를 만듭니다. 안드로이드 폰이 여기 해당해요.',
    hint: '배터리를 조금 더 씁니다',
  },
  guest: {
    label: '상대 것에 붙을게요',
    detail: '상대가 만든 Wi-Fi 에 들어갑니다. 아이폰이 여기 해당해요.',
    hint: '핫스팟은 아이폰에서 잘 안 돼요',
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
