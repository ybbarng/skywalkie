import type { CallSignalPayload } from '@/application/ports/Envelope'
import type { Unsubscribe } from '@/application/ports/MessageTransport'
import type {
  VoiceLink,
  VoiceLinkState,
  VoiceStreams,
} from '@/application/ports/VoiceLink'
import type { CallKind } from '@/domain/call/CallState'
import { type DomainError, domainError } from '@/domain/shared/DomainError'
import { err, ok, type Result } from '@/domain/shared/Result'
import { loadWebRtc } from './webrtcModule'

/**
 * 실제로 소리와 영상을 나른다.
 *
 * ## 서버가 하나도 없다
 *
 * ```ts
 * new RTCPeerConnection({ iceServers: [], iceCandidatePoolSize: 0 })
 * ```
 *
 * 같은 사설망이라 기기가 자기 주소를 후보로 내놓는 것만으로 길이 트인다.
 * STUN 도 TURN 도 필요 없다. **인터넷이 필요한 부분이 통째로 사라진다.**
 * (docs/06-voice-video-spec.md 1장)
 *
 * ## 여기서 예외가 위로 새면 안 된다
 *
 * 네이티브 모듈은 무슨 이유로든 터질 수 있다. 위층은 `Result` 만 안다.
 * 그래서 **모든 호출을 감싼다.** 하나라도 새면 통화가 아니라 앱이 죽는다.
 */
export class WebRtcVoiceLink implements VoiceLink {
  // biome-ignore lint/suspicious/noExplicitAny: 네이티브 모듈 타입이다
  private connection: any = null
  // biome-ignore lint/suspicious/noExplicitAny: 위와 같다
  private localStream: any = null
  // biome-ignore lint/suspicious/noExplicitAny: 위와 같다
  private remoteStream: any = null

  private candidateHandlers = new Set<(c: CallSignalPayload) => void>()
  private stateHandlers = new Set<(s: VoiceLinkState) => void>()
  private closing = false

  isAvailable(): boolean {
    return loadWebRtc().available
  }

  async createOffer(kind: CallKind): Promise<Result<CallSignalPayload, DomainError>> {
    const prepared = await this.prepare(kind)
    if (!prepared.ok) return prepared

    try {
      const offer = await this.connection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: kind === 'video',
      })
      await this.connection.setLocalDescription(offer)

      return ok({ kind: 'offer', sdp: offer.sdp, media: kind })
    } catch (cause) {
      return err(wrap(cause, '통화를 걸지 못했다'))
    }
  }

  async acceptOffer(
    offer: CallSignalPayload,
    kind: CallKind,
  ): Promise<Result<CallSignalPayload, DomainError>> {
    const prepared = await this.prepare(kind)
    if (!prepared.ok) return prepared

    const loaded = loadWebRtc()
    if (!loaded.available) return err(domainError('not-found', loaded.why, 'call'))

    try {
      await this.connection.setRemoteDescription(
        new loaded.module.RTCSessionDescription({ type: 'offer', sdp: offer.sdp }),
      )

      const answer = await this.connection.createAnswer()
      await this.connection.setLocalDescription(answer)

      return ok({ kind: 'answer', sdp: answer.sdp })
    } catch (cause) {
      return err(wrap(cause, '통화를 받지 못했다'))
    }
  }

  async acceptAnswer(answer: CallSignalPayload): Promise<Result<void, DomainError>> {
    const loaded = loadWebRtc()
    if (!loaded.available || this.connection === null) {
      return err(domainError('not-found', '통화 길이 없다', 'call'))
    }

    try {
      await this.connection.setRemoteDescription(
        new loaded.module.RTCSessionDescription({ type: 'answer', sdp: answer.sdp }),
      )
      return ok(undefined)
    } catch (cause) {
      return err(wrap(cause, '상대의 답을 받아들이지 못했다'))
    }
  }

  async addCandidate(candidate: CallSignalPayload): Promise<Result<void, DomainError>> {
    const loaded = loadWebRtc()
    if (!loaded.available || this.connection === null) {
      return err(domainError('not-found', '통화 길이 없다', 'call'))
    }

    if (candidate.candidate === undefined) return ok(undefined)

    try {
      await this.connection.addIceCandidate(
        new loaded.module.RTCIceCandidate({
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid,
          sdpMLineIndex: candidate.sdpMLineIndex,
        }),
      )
      return ok(undefined)
    } catch (cause) {
      // 후보 하나가 안 붙어도 다른 후보로 이어질 수 있다
      return err(wrap(cause, '주소 후보를 더하지 못했다'))
    }
  }

  onCandidate(handler: (c: CallSignalPayload) => void): Unsubscribe {
    this.candidateHandlers.add(handler)
    return () => this.candidateHandlers.delete(handler)
  }

  onStateChange(handler: (s: VoiceLinkState) => void): Unsubscribe {
    this.stateHandlers.add(handler)
    return () => this.stateHandlers.delete(handler)
  }

  setMicrophoneEnabled(enabled: boolean): Result<void, DomainError> {
    return this.setTrackEnabled('audio', enabled)
  }

  setCameraEnabled(enabled: boolean): Result<void, DomainError> {
    return this.setTrackEnabled('video', enabled)
  }

  async switchCamera(): Promise<Result<void, DomainError>> {
    try {
      const tracks = this.localStream?.getVideoTracks?.() ?? []
      for (const track of tracks) track._switchCamera?.()
      return ok(undefined)
    } catch (cause) {
      return err(wrap(cause, '카메라를 바꾸지 못했다'))
    }
  }

  streams(): VoiceStreams {
    try {
      return {
        localUrl: this.localStream?.toURL?.() ?? null,
        remoteUrl: this.remoteStream?.toURL?.() ?? null,
      }
    } catch {
      return { localUrl: null, remoteUrl: null }
    }
  }

  /**
   * 전부 닫는다.
   *
   * **여러 번 불러도 안전하다.** 그리고 무엇이 실패하든 나머지는
   * 계속 닫는다. 하나가 터져서 마이크가 남으면 안 된다.
   */
  async close(): Promise<void> {
    if (this.closing) return
    this.closing = true

    try {
      const tracks = this.localStream?.getTracks?.() ?? []
      for (const track of tracks) {
        try {
          track.stop()
        } catch {
          // 이 트랙 하나는 못 멈췄다. 나머지는 계속 멈춘다.
        }
      }
    } catch {
      // 트랙 목록을 못 읽었다
    }

    try {
      this.connection?.close?.()
    } catch {
      // 이미 닫혔다
    }

    this.connection = null
    this.localStream = null
    this.remoteStream = null
    this.candidateHandlers.clear()
    this.stateHandlers.clear()
    this.closing = false
  }

  /** 길을 열고 마이크(와 카메라)를 잡는다 */
  private async prepare(kind: CallKind): Promise<Result<void, DomainError>> {
    const loaded = loadWebRtc()
    if (!loaded.available) return err(domainError('not-found', loaded.why, 'call'))

    // 이미 열려 있으면 그대로 쓴다
    if (this.connection !== null) return ok(undefined)

    try {
      this.connection = new loaded.module.RTCPeerConnection({
        // 바깥 서버를 하나도 안 쓴다. 같은 사설망이라 필요 없다.
        iceServers: [],
        iceCandidatePoolSize: 0,
      })
    } catch (cause) {
      return err(wrap(cause, '통화 길을 열지 못했다'))
    }

    const media = await this.grabMedia(loaded.module, kind)
    if (!media.ok) {
      await this.close()
      return media
    }

    this.listen()
    return ok(undefined)
  }

  private async grabMedia(
    // biome-ignore lint/suspicious/noExplicitAny: 네이티브 모듈 타입이다
    module: any,
    kind: CallKind,
  ): Promise<Result<void, DomainError>> {
    try {
      this.localStream = await module.mediaDevices.getUserMedia({
        audio: true,
        video: kind === 'video' ? { facingMode: 'user' } : false,
      })

      for (const track of this.localStream.getTracks()) {
        this.connection.addTrack(track, this.localStream)
      }

      // **마이크는 꺼진 채로 시작한다.** 누르고 말하기가 기본이라
      // 열어두면 첫 마디가 그냥 나간다.
      this.setTrackEnabled('audio', false)

      return ok(undefined)
    } catch (cause) {
      // 권한이 없을 때 여기로 온다. 화면이 "설정에서 허용해 주세요"를 띄운다.
      return err(wrap(cause, '마이크를 쓸 수 없다'))
    }
  }

  private listen(): void {
    try {
      this.connection.addEventListener('icecandidate', (event: unknown) => {
        const candidate = (event as { candidate?: Record<string, unknown> }).candidate
        if (candidate === null || candidate === undefined) return

        const text = String(candidate.candidate ?? '')
        // **바깥으로 나가려는 후보는 버린다.** 어차피 닿지 않아서
        // 기다리는 시간만 길어진다. (명세 1장)
        if (!isPrivateCandidate(text)) return

        this.emitCandidate({
          kind: 'candidate',
          candidate: text,
          sdpMid: candidate.sdpMid === null ? undefined : String(candidate.sdpMid ?? ''),
          sdpMLineIndex:
            typeof candidate.sdpMLineIndex === 'number'
              ? candidate.sdpMLineIndex
              : undefined,
        })
      })

      this.connection.addEventListener('track', (event: unknown) => {
        const streams = (event as { streams?: unknown[] }).streams ?? []
        this.remoteStream = streams[0] ?? null
      })

      this.connection.addEventListener('connectionstatechange', () => {
        this.emitState(readState(this.connection?.connectionState))
      })

      this.connection.addEventListener('iceconnectionstatechange', () => {
        this.emitState(readState(this.connection?.iceConnectionState))
      })
    } catch {
      // 알림을 못 붙였다. 통화는 될 수도 있지만 상태를 모른다.
      // 그래도 앱은 돈다.
    }
  }

  private setTrackEnabled(
    kind: 'audio' | 'video',
    enabled: boolean,
  ): Result<void, DomainError> {
    try {
      const tracks =
        kind === 'audio'
          ? (this.localStream?.getAudioTracks?.() ?? [])
          : (this.localStream?.getVideoTracks?.() ?? [])

      for (const track of tracks) track.enabled = enabled
      return ok(undefined)
    } catch (cause) {
      return err(wrap(cause, '마이크를 다루지 못했다'))
    }
  }

  private emitCandidate(candidate: CallSignalPayload): void {
    for (const handler of this.candidateHandlers) {
      try {
        handler(candidate)
      } catch {
        // 듣는 쪽 잘못이다. 나머지에게는 계속 알린다.
      }
    }
  }

  private emitState(state: VoiceLinkState | null): void {
    if (state === null) return
    for (const handler of this.stateHandlers) {
      try {
        handler(state)
      } catch {
        // 위와 같다
      }
    }
  }
}

/**
 * 사설망 주소 후보인가.
 *
 * 같은 Wi-Fi 안에서만 통화한다. 바깥 주소는 어차피 닿지 않으므로
 * 버려서 시간을 아낀다. mDNS 로 가려진 후보(`.local`)도 같은 망이라 쓴다.
 */
export function isPrivateCandidate(candidate: string): boolean {
  if (candidate.length === 0) return false
  if (candidate.includes('.local')) return true

  // "candidate:1 1 udp 2122260223 192.168.43.5 51703 typ host ..."
  const match = candidate.match(/\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/)
  if (match === null) return false

  const a = Number(match[1])
  const b = Number(match[2])

  if (a === 10) return true
  if (a === 192 && b === 168) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 169 && b === 254) return true

  return false
}

function readState(raw: unknown): VoiceLinkState | null {
  switch (raw) {
    case 'connected':
    case 'completed':
      return 'connected'
    case 'connecting':
    case 'checking':
    case 'new':
      return 'connecting'
    case 'disconnected':
      return 'interrupted'
    case 'failed':
      return 'failed'
    case 'closed':
      return 'closed'
    default:
      return null
  }
}

function wrap(cause: unknown, what: string): DomainError {
  const detail = cause instanceof Error ? cause.message : String(cause)
  return domainError('invalid-value', `${what}: ${detail}`, 'call')
}
