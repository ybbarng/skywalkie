import { router } from 'expo-router'
import { View } from 'react-native'
import type {
  DiscoveryMethod,
  DiscoveryProgress,
} from '@/application/ports/PeerDiscovery'
import type { ConnectionState } from '@/domain/connection/ConnectionState'
import { Character } from '../characters/Character'
import { useTheme } from '../theme/ThemeProvider'
import { Button } from './Button'
import { Card } from './Card'
import { Icon } from './Icon'
import { Text } from './Text'

/**
 * 상대를 찾는 동안 보여주는 화면.
 *
 * **빙글빙글 도는 표시만 두면 사용자는 앱이 멈춘 줄 안다.** 지금 무엇을
 * 하는 중인지, 얼마나 걸리는지, 안 되면 무엇을 누르면 되는지 보여준다.
 * (docs/07-design-system.md 8장)
 */

interface ConnectingViewProps {
  state: ConnectionState | null
  progress: DiscoveryProgress | null
  /** 이만큼 지나도 못 찾으면 코드 입력을 권한다 */
  showManualHint: boolean
  peerCharacter: Parameters<typeof Character>[0]['id']
  onRetry(): void
}

export function ConnectingView({
  state,
  progress,
  showManualHint,
  peerCharacter,
  onRetry,
}: ConnectingViewProps) {
  const theme = useTheme()

  return (
    <View
      style={{
        alignItems: 'center',
        gap: theme.spacing.lg,
        paddingHorizontal: theme.spacing.xl,
        paddingVertical: theme.spacing['2xl'],
      }}
    >
      <Character id={peerCharacter} expression="disconnected" size={120} />

      <View style={{ alignItems: 'center', gap: theme.spacing.xs }}>
        <Text variant="heading">상대를 찾고 있어요</Text>
        <Text variant="caption" color="textMuted" align="center">
          주소를 입력할 필요 없어요. 앱이 스스로 찾습니다.
        </Text>
      </View>

      <Card style={{ alignSelf: 'stretch', gap: theme.spacing.sm }}>
        {progress?.selfAddress !== undefined && (
          <Step done label={`Wi-Fi 에 연결됨 (${progress.selfAddress})`} />
        )}

        {steps.map(step => (
          <Step
            key={step.method}
            label={step.label}
            active={progress?.method === step.method}
            done={isDone(step.method, progress)}
            detail={detailFor(step.method, progress)}
          />
        ))}

        <Step label="연결" done={state?.isUsable() ?? false} />
      </Card>

      {showManualHint && (
        <Card raised style={{ alignSelf: 'stretch', gap: theme.spacing.md }}>
          <Text variant="bodyStrong">잘 안 되나요?</Text>
          <Text variant="caption" color="textMuted">
            두 폰이 같은 Wi-Fi 에 있는지 확인해 주세요. 그래도 안 되면 코드를 직접 입력해
            붙을 수 있어요.
          </Text>
          <Button
            label="코드로 연결하기"
            tone="neutral"
            fullWidth
            onPress={() => router.push('/pair-code')}
          />
          <Button label="다시 찾기" tone="ghost" fullWidth onPress={onRetry} />
        </Card>
      )}
    </View>
  )
}

interface StepInfo {
  readonly method: DiscoveryMethod
  readonly label: string
}

/** 화면에 보여줄 단계들. 실제 순서와 같다 */
const steps: readonly StepInfo[] = [
  { method: 'gateway', label: '상대 폰에 바로 걸어보는 중' },
  { method: 'broadcast', label: '같은 Wi-Fi 에 대고 부르는 중' },
  { method: 'scan', label: '주소를 하나씩 살펴보는 중' },
]

function Step({
  label,
  active = false,
  done = false,
  detail,
}: {
  label: string
  active?: boolean
  done?: boolean
  detail?: string
}) {
  const theme = useTheme()

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
      <View style={{ width: 18, alignItems: 'center' }}>
        {done ? (
          <Icon name="check" size={16} color="success" />
        ) : active ? (
          <View
            style={{
              width: 7,
              height: 7,
              borderRadius: 3.5,
              backgroundColor: theme.colors.me,
            }}
          />
        ) : (
          <View
            style={{
              width: 5,
              height: 5,
              borderRadius: 2.5,
              backgroundColor: theme.colors.textFaint,
            }}
          />
        )}
      </View>

      <Text
        variant="caption"
        color={done ? 'text' : active ? 'me' : 'textFaint'}
        style={{ flex: 1 }}
      >
        {label}
        {detail !== undefined && ` · ${detail}`}
      </Text>
    </View>
  )
}

function isDone(method: DiscoveryMethod, progress: DiscoveryProgress | null): boolean {
  if (progress === null) return false
  if (progress.method === method) return progress.phase === 'succeeded'

  // 앞 단계는 이미 지나갔다는 뜻이다
  const order = steps.findIndex(s => s.method === method)
  const current = steps.findIndex(s => s.method === progress.method)
  return order >= 0 && current > order
}

function detailFor(
  method: DiscoveryMethod,
  progress: DiscoveryProgress | null,
): string | undefined {
  if (progress === null || progress.method !== method) return undefined
  if (progress.checked === undefined || progress.total === undefined) return undefined

  return `${progress.checked}/${progress.total}`
}
