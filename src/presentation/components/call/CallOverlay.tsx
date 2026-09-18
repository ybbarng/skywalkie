import { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'
import type { CallState } from '@/domain/call/CallState'
import type { CharacterId } from '@/domain/peer/Character'
import { Character } from '../../characters/Character'
import {
  canRetry,
  endMessage,
  needsSettings,
  phaseLabel,
  pushToTalk,
} from '../../copy/call'
import { useTheme } from '../../theme/ThemeProvider'
import { Button } from '../Button'
import { Icon } from '../Icon'
import { Text } from '../Text'
import { VideoStage } from './VideoStage'

/**
 * 통화 창.
 *
 * 대화 화면 위에 덮인다. **글씨를 안 읽어도 무엇을 누를지 보여야 한다.**
 * 받는 버튼은 초록, 끊는 버튼은 빨강, 크기를 크게 둔다.
 */

interface CallOverlayProps {
  state: CallState
  peerName: string
  /** 통화는 이어져야 걸리니 보통 안다. 그래도 모를 때를 허용한다 */
  peerCharacter: CharacterId | null
  myCharacter: CharacterId
  localUrl: string | null
  remoteUrl: string | null
  cameraOn: boolean
  onToggleCamera: () => void
  onSwitchCamera: () => void
  talking: boolean
  locked: boolean
  muted: boolean
  notice: string | null
  onAccept: () => void
  onDecline: () => void
  onHangUp: () => void
  onTalkStart: () => void
  onTalkEnd: () => void
  onToggleLock: () => void
  onToggleMute: () => void
  onRetry: () => void
  onDismissNotice: () => void
  onClose: () => void
}

export function CallOverlay(props: CallOverlayProps) {
  const theme = useTheme()
  const { state } = props

  if (state.phase === 'idle') return null

  // 영상 통화 중이면 얼굴이 화면을 채운다
  if (state.kind === 'video' && state.phase === 'active') {
    return (
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: theme.colors.bg,
        }}
      >
        <VideoStage
          localUrl={props.localUrl}
          remoteUrl={props.remoteUrl}
          peerCharacter={props.peerCharacter}
          myCharacter={props.myCharacter}
          peerVideoOff={props.remoteUrl === null}
        />

        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: theme.spacing['3xl'],
            flexDirection: 'row',
            justifyContent: 'center',
            gap: theme.spacing.lg,
          }}
        >
          <SmallButton
            icon={props.cameraOn ? 'video' : 'videoOff'}
            label={props.cameraOn ? '영상 끄기' : '영상 켜기'}
            onPress={props.onToggleCamera}
          />
          <RoundButton
            tone="danger"
            icon="phoneOff"
            label="끊기"
            onPress={props.onHangUp}
          />
          <SmallButton
            icon="refresh"
            label="앞뒤 바꾸기"
            onPress={props.onSwitchCamera}
          />
        </View>
      </View>
    )
  }

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: theme.colors.bg,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.lg,
        padding: theme.spacing.xl,
      }}
    >
      <Character id={props.peerCharacter} expression={expressionFor(state)} size={160} />

      <View style={{ alignItems: 'center', gap: theme.spacing.xs }}>
        <Text variant="heading">{props.peerName}</Text>
        <Text color="textMuted">{phaseLabel(state.phase, props.peerName)}</Text>

        {state.phase === 'active' && <CallTimer since={state.since} />}
      </View>

      {props.notice !== null && (
        <Pressable onPress={props.onDismissNotice}>
          <Text variant="caption" color="danger" align="center">
            {props.notice}
          </Text>
        </Pressable>
      )}

      {state.phase === 'ended' ? (
        <Ended {...props} />
      ) : state.needsAnswer() ? (
        <Answering onAccept={props.onAccept} onDecline={props.onDecline} />
      ) : (
        <Talking {...props} />
      )}
    </View>
  )
}

function Answering({
  onAccept,
  onDecline,
}: {
  onAccept: () => void
  onDecline: () => void
}) {
  const theme = useTheme()

  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing.xl }}>
      <RoundButton tone="danger" icon="phoneOff" label="거절" onPress={onDecline} />
      <RoundButton tone="success" icon="phone" label="받기" onPress={onAccept} />
    </View>
  )
}

function Talking(props: CallOverlayProps) {
  const theme = useTheme()
  const live = props.state.isLive()

  return (
    <View style={{ alignItems: 'center', gap: theme.spacing.lg }}>
      {live && (
        <>
          {/*
            누르고 말하기.
            **누르는 동안만 열린다.** 위로 밀면 잠긴다.
          */}
          <Pressable
            onPressIn={props.onTalkStart}
            onPressOut={props.onTalkEnd}
            onLongPress={props.onToggleLock}
            accessibilityRole="button"
            accessibilityLabel={props.talking ? '말하는 중' : '누르고 말하기'}
            style={{
              width: 200,
              height: 200,
              borderRadius: 100,
              alignItems: 'center',
              justifyContent: 'center',
              gap: theme.spacing.sm,
              backgroundColor: props.talking
                ? theme.colors.success
                : theme.colors.surfaceRaised,
              borderWidth: 3,
              borderColor: props.locked ? theme.colors.me : theme.colors.border,
            }}
          >
            <Icon name="mic" size={44} />
            <Text variant="bodyStrong" align="center">
              {props.locked
                ? pushToTalk.locked
                : props.talking
                  ? pushToTalk.talking
                  : pushToTalk.idle}
            </Text>
          </Pressable>

          <Text variant="caption" color="textFaint">
            {pushToTalk.hint}
          </Text>
        </>
      )}

      <RoundButton tone="danger" icon="phoneOff" label="끊기" onPress={props.onHangUp} />
    </View>
  )
}

function Ended(props: CallOverlayProps) {
  const theme = useTheme()
  const reason = props.state.endReason

  return (
    <View style={{ alignItems: 'center', gap: theme.spacing.md }}>
      <Text color="textMuted" align="center">
        {endMessage(reason, props.peerName)}
      </Text>

      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        {canRetry(reason) && <Button label="다시 걸기" onPress={props.onRetry} />}
        {needsSettings(reason) && (
          <Button label="설정 열기" tone="neutral" onPress={props.onRetry} />
        )}
        <Button label="닫기" tone="neutral" onPress={props.onClose} />
      </View>
    </View>
  )
}

/** 통화 중 곁들이는 작은 버튼 */
function SmallButton({
  icon,
  label,
  onPress,
}: {
  icon: 'video' | 'videoOff' | 'refresh'
  label: string
  onPress: () => void
}) {
  const theme = useTheme()

  return (
    <View style={{ alignItems: 'center', gap: theme.spacing.xs }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.surfaceRaised,
        }}
      >
        <Icon name={icon} size={22} />
      </Pressable>
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
    </View>
  )
}

function RoundButton({
  tone,
  icon,
  label,
  onPress,
}: {
  tone: 'success' | 'danger'
  icon: 'phone' | 'phoneOff'
  label: string
  onPress: () => void
}) {
  const theme = useTheme()

  return (
    <View style={{ alignItems: 'center', gap: theme.spacing.xs }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor:
            tone === 'success' ? theme.colors.success : theme.colors.danger,
        }}
      >
        <Icon name={icon} size={30} color="onStatus" />
      </Pressable>
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
    </View>
  )
}

/** 통화한 시간. 1초마다 늘어난다 */
function CallTimer({ since }: { since: Date }) {
  const seconds = useElapsedSeconds(since)
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60

  return (
    <Text variant="caption" color="textFaint">
      {`${minutes}:${String(rest).padStart(2, '0')}`}
    </Text>
  )
}

function expressionFor(state: CallState) {
  if (state.phase === 'active') return 'speaking' as const
  if (state.phase === 'ended') return 'disconnected' as const
  if (state.phase === 'ringing') return 'idle' as const
  return 'listening' as const
}

function useElapsedSeconds(since: Date): number {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const tick = () =>
      setSeconds(Math.max(0, Math.floor((Date.now() - since.getTime()) / 1000)))
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [since])

  return seconds
}
