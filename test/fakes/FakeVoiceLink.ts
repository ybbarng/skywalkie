import type { CallSignalPayload } from '@/application/ports/Envelope'
import type { Unsubscribe } from '@/application/ports/MessageTransport'
import type {
  AudioMode,
  AudioRoute,
  AudioSession,
  VoiceLink,
  VoiceLinkState,
  VoiceStreams,
} from '@/application/ports/VoiceLink'
import type { CallKind } from '@/domain/call/CallState'
import type { DomainError } from '@/domain/shared/DomainError'
import { domainError } from '@/domain/shared/DomainError'
import { err, ok, type Result } from '@/domain/shared/Result'

/** 통화 길을 흉내 낸다. 실제 기기 없이 순서를 시험하려고 만든다 */
export class FakeVoiceLink implements VoiceLink {
  available = true
  /** 몇 번이나 닫혔나. 통화가 끝났는데 안 닫히는 걸 잡는다 */
  closeCount = 0
  micEnabled = false
  cameraEnabled = false
  cameraSwitched = 0
  /** -1 이면 계속 실패한다 */
  failOffer = false
  failAnswer = false
  addedCandidates: CallSignalPayload[] = []

  private candidateHandlers = new Set<(c: CallSignalPayload) => void>()
  private stateHandlers = new Set<(s: VoiceLinkState) => void>()

  isAvailable(): boolean {
    return this.available
  }

  async createOffer(_kind: CallKind): Promise<Result<CallSignalPayload, DomainError>> {
    if (this.failOffer) {
      return err(domainError('invalid-value', '길을 트지 못했다', 'call'))
    }
    return ok({ kind: 'offer', sdp: 'v=0 offer' })
  }

  async acceptOffer(
    _offer: CallSignalPayload,
    _kind: CallKind,
  ): Promise<Result<CallSignalPayload, DomainError>> {
    if (this.failAnswer) {
      return err(domainError('invalid-value', '답하지 못했다', 'call'))
    }
    return ok({ kind: 'answer', sdp: 'v=0 answer' })
  }

  async acceptAnswer(_answer: CallSignalPayload): Promise<Result<void, DomainError>> {
    return ok(undefined)
  }

  async addCandidate(candidate: CallSignalPayload): Promise<Result<void, DomainError>> {
    this.addedCandidates.push(candidate)
    return ok(undefined)
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
    this.micEnabled = enabled
    return ok(undefined)
  }

  setCameraEnabled(enabled: boolean): Result<void, DomainError> {
    this.cameraEnabled = enabled
    return ok(undefined)
  }

  async switchCamera(): Promise<Result<void, DomainError>> {
    this.cameraSwitched += 1
    return ok(undefined)
  }

  streams(): VoiceStreams {
    return { localUrl: null, remoteUrl: null }
  }

  async close(): Promise<void> {
    this.closeCount += 1
  }

  /** 시험에서 길의 상태가 바뀐 척한다 */
  emitState(state: VoiceLinkState): void {
    for (const handler of this.stateHandlers) handler(state)
  }

  /** 시험에서 주소 후보가 생긴 척한다 */
  emitCandidate(candidate: CallSignalPayload): void {
    for (const handler of this.candidateHandlers) handler(candidate)
  }

  /** 아무도 안 듣고 있나. 통화가 끝나면 그래야 한다 */
  hasListeners(): boolean {
    return this.candidateHandlers.size > 0 || this.stateHandlers.size > 0
  }
}

export class FakeAudioSession implements AudioSession {
  activeCount = 0
  deactivateCount = 0
  lastMode: AudioMode | null = null
  failActivate = false

  private routeHandlers = new Set<(r: AudioRoute) => void>()

  async activate(mode: AudioMode): Promise<Result<void, DomainError>> {
    this.lastMode = mode
    if (this.failActivate) {
      return err(domainError('invalid-value', '소리 길을 잡지 못했다', 'audio'))
    }
    this.activeCount += 1
    return ok(undefined)
  }

  async deactivate(): Promise<Result<void, DomainError>> {
    this.deactivateCount += 1
    return ok(undefined)
  }

  async currentRoute(): Promise<Result<AudioRoute, DomainError>> {
    return ok({ output: 'bluetooth', input: 'bluetooth', headphonesConnected: true })
  }

  onRouteChange(handler: (r: AudioRoute) => void): Unsubscribe {
    this.routeHandlers.add(handler)
    return () => this.routeHandlers.delete(handler)
  }

  emitRoute(route: AudioRoute): void {
    for (const handler of this.routeHandlers) handler(route)
  }
}
