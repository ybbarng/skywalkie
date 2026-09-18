import { View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import type { Message } from '@/domain/message/Message'
import type { CharacterId } from '@/domain/peer/Character'
import type { PeerId } from '@/domain/peer/PeerId'
import { Sticker } from '../../characters/Sticker'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useTheme } from '../../theme/ThemeProvider'
import { Icon } from '../Icon'
import { Text } from '../Text'
import { DeliveryMark } from './DeliveryMark'

interface MessageBubbleProps {
  message: Message
  me: PeerId
  /** 바로 앞 메시지와 같은 사람이 보낸 것인가 */
  grouped: boolean
  /** 시각을 보여줄지. 연달아 온 것 중 마지막에만 보여준다 */
  showTime: boolean
  onRetry?: () => void
}

export function MessageBubble({
  message,
  me,
  grouped,
  showTime,
  onRetry,
}: MessageBubbleProps) {
  const theme = useTheme()
  const reducedMotion = useReducedMotion()
  const mine = message.isMine(me)

  if (message.content.kind === 'system') {
    return <SystemNotice message={message} />
  }

  const bubbleColor = mine ? theme.colors.me : theme.colors.peer
  const textColor = mine ? theme.colors.meText : theme.colors.peerText

  // **이모티콘은 말풍선에 안 담는다.** 그림이 이미 말이라
  // 테두리를 두르면 답답해 보인다.
  const bare = message.content.kind === 'sticker'

  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeInDown.duration(theme.duration.bubble)}
      style={{
        alignSelf: mine ? 'flex-end' : 'flex-start',
        maxWidth: '82%',
        marginTop: grouped ? theme.spacing.xs : theme.spacing.md,
      }}
    >
      <View
        style={
          bare
            ? undefined
            : {
                backgroundColor: bubbleColor,
                borderRadius: theme.radius.xl,
                // 말하는 쪽 아래 모서리만 각지게. 꼬리 없이도 누구 말인지 안다.
                borderBottomRightRadius: mine ? theme.radius.sm : theme.radius.xl,
                borderBottomLeftRadius: mine ? theme.radius.xl : theme.radius.sm,
                paddingHorizontal: theme.spacing.lg,
                paddingVertical: theme.spacing.md,
              }
        }
      >
        <BubbleContent message={message} textColor={textColor} />
      </View>

      {showTime && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            alignSelf: mine ? 'flex-end' : 'flex-start',
            gap: theme.spacing.xs,
            marginTop: 2,
            paddingHorizontal: theme.spacing.xs,
          }}
        >
          <Text variant="caption" color="textFaint">
            {formatTime(message.orderedAt())}
          </Text>
          {mine && <DeliveryMark state={message.delivery} onRetry={onRetry} />}
        </View>
      )}
    </Animated.View>
  )
}

function BubbleContent({ message, textColor }: { message: Message; textColor: string }) {
  const theme = useTheme()

  switch (message.content.kind) {
    case 'text':
      return <Text style={{ color: textColor }}>{message.content.text}</Text>

    case 'nudge':
      return (
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}
        >
          <Icon name="alert" size={18} />
          <Text style={{ color: textColor }}>콕 찔렀어요</Text>
        </View>
      )

    case 'sticker':
      return (
        <Sticker
          character={message.content.character as CharacterId}
          pose={message.content.pose}
          size={120}
        />
      )

    case 'doodle':
      // T24 에서 실제 그림으로 바뀐다
      return <Text style={{ color: textColor }}>낙서를 보냈어요</Text>

    case 'system':
      return null
  }
}

/** 앱이 끼워 넣는 알림. 말풍선이 아니라 가운데 작은 글로 */
function SystemNotice({ message }: { message: Message }) {
  const theme = useTheme()
  if (message.content.kind !== 'system') return null

  return (
    <View style={{ alignItems: 'center', marginVertical: theme.spacing.md }}>
      <Text variant="caption" color="textFaint">
        {noticeText(message.content.notice)}
      </Text>
    </View>
  )
}

function noticeText(notice: string): string {
  switch (notice) {
    case 'link-lost':
      return '연결이 끊겼어요'
    case 'link-restored':
      return '다시 연결됐어요'
    case 'switched-to-bluetooth':
      return '블루투스로 바뀌었어요 · 지금은 글만 주고받을 수 있어요'
    case 'switched-to-wifi':
      return 'Wi-Fi 로 바뀌었어요'
    case 'call-ended':
      return '통화가 끝났어요'
    case 'conversation-imported':
      return '대화를 불러왔어요'
    default:
      return ''
  }
}

function formatTime(at: Date): string {
  const hours = at.getHours()
  const minutes = at.getMinutes().toString().padStart(2, '0')
  const period = hours < 12 ? '오전' : '오후'
  const displayHours = hours % 12 === 0 ? 12 : hours % 12

  return `${period} ${displayHours}:${minutes}`
}
