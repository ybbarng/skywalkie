import { type DomainError, domainError } from '../shared/DomainError'
import { err, ok, type Result } from '../shared/Result'

/**
 * 메시지에 담을 수 있는 것.
 *
 * 사진과 이모티콘은 2단계(T22, T23)에서 붙인다. 지금은 자리만 비워둔다.
 * (docs/05-messaging-spec.md 2장)
 */

export const MAX_TEXT_LENGTH = 4000
export const MAX_STROKES = 200
export const MAX_POINTS_PER_STROKE = 1000

export interface TextContent {
  readonly kind: 'text'
  readonly text: string
}

/**
 * 낙서.
 *
 * 그림 파일이 아니라 선의 좌표로 담는다. 크기가 훨씬 작아 블루투스로도
 * 나를 수 있고, 화면 크기가 달라도 선명하게 다시 그린다.
 */
export interface DoodleContent {
  readonly kind: 'doodle'
  readonly strokes: readonly Stroke[]
}

export interface Stroke {
  /** 0~1 사이 비율 좌표. 화면 크기와 무관하게 그린다 */
  readonly points: readonly Point[]
  /**
   * 색 토큰의 이름이다. `#FF0000` 같은 실제 색이 아니다.
   * 어두운 화면과 밝은 화면에서 각각 알맞은 색으로 나오게 하기 위해서다.
   */
  readonly color: string
  readonly width: number
}

export interface Point {
  readonly x: number
  readonly y: number
}

/**
 * 사진.
 *
 * **바이트는 여기 담기지 않는다.** 사진은 봉투 하나에 안 들어가서
 * 따로 조각내어 나른다. 여기 담기는 것은 "어떤 사진인지"뿐이다.
 *
 * `preview` 는 아주 작게 줄인 그림이다. 몇백 바이트라 메시지와 같이
 * 가고, 진짜 사진이 도착할 때까지 흐릿하게 먼저 보여준다.
 * **빈 네모를 보여주는 것보다 기다릴 만하다.**
 */
export interface PhotoContent {
  readonly kind: 'photo'
  /** 조각들을 이 번호로 찾는다 */
  readonly assetId: string
  readonly width: number
  readonly height: number
  readonly byteLength: number
  /** 아주 작게 줄인 미리보기 (base64) */
  readonly preview?: string
  /** 사람이 붙인 말 */
  readonly caption?: string
}

/**
 * 캐릭터 이모티콘.
 *
 * **그림을 나르지 않는다.** 어떤 캐릭터가 어떤 자세인지만 보내면
 * 받는 쪽이 코드로 그린다. 몇십 바이트라 좁은 길로도 즉시 간다.
 * (docs/05-messaging-spec.md · T23)
 */
export interface StickerContent {
  readonly kind: 'sticker'
  readonly character: string
  readonly pose: StickerPose
}

export const stickerPoses = [
  /** 손 흔들기 */
  'wave',
  /** 자는 중 */
  'sleep',
  /** 하트 띄우기 */
  'heart',
  /** 웃기 */
  'laugh',
  /** 울기 */
  'cry',
  /** 엄지 */
  'thumbsUp',
  /** 먹는 중. 기내식 나왔을 때 */
  'eat',
  /** 심심해 */
  'bored',
] as const

export type StickerPose = (typeof stickerPoses)[number]

/** 콕 찌르기. 담을 내용이 없다 */
export interface NudgeContent {
  readonly kind: 'nudge'
}

/** 앱이 끼워 넣는 알림. 사람이 보낸 게 아니다 */
export interface SystemContent {
  readonly kind: 'system'
  readonly notice: SystemNotice
}

export type SystemNotice =
  | 'link-lost'
  | 'link-restored'
  | 'switched-to-bluetooth'
  | 'switched-to-wifi'
  | 'call-ended'
  | 'conversation-imported'

export type MessageContent =
  | TextContent
  | DoodleContent
  | StickerContent
  | PhotoContent
  | NudgeContent
  | SystemContent

export function textContent(raw: string): Result<TextContent, DomainError> {
  const text = raw.trim()

  if (text.length === 0) {
    return err(domainError('empty', '빈 메시지는 보낼 수 없다', 'text'))
  }

  if (text.length > MAX_TEXT_LENGTH) {
    return err(
      domainError(
        'too-long',
        `메시지는 ${MAX_TEXT_LENGTH}자까지 쓸 수 있다 (지금 ${text.length}자)`,
        'text',
      ),
    )
  }

  return ok({ kind: 'text', text })
}

export function doodleContent(
  strokes: readonly Stroke[],
): Result<DoodleContent, DomainError> {
  if (strokes.length === 0) {
    return err(domainError('empty', '빈 낙서는 보낼 수 없다', 'strokes'))
  }

  if (strokes.length > MAX_STROKES) {
    return err(
      domainError('too-long', `선은 ${MAX_STROKES}개까지 그릴 수 있다`, 'strokes'),
    )
  }

  for (const [index, stroke] of strokes.entries()) {
    const invalid = validateStroke(stroke, index)
    if (invalid !== null) return err(invalid)
  }

  return ok({ kind: 'doodle', strokes })
}

function validateStroke(stroke: Stroke, index: number): DomainError | null {
  if (stroke.points.length === 0) {
    return domainError('empty', `${index + 1}번째 선에 점이 없다`, 'strokes')
  }

  if (stroke.points.length > MAX_POINTS_PER_STROKE) {
    return domainError(
      'too-long',
      `한 선은 점 ${MAX_POINTS_PER_STROKE}개까지 담을 수 있다`,
      'strokes',
    )
  }

  for (const point of stroke.points) {
    // 비율 좌표라 0에서 1 사이를 벗어날 수 없다.
    // 벗어난 값이 들어오면 상대 화면 밖에 그려져 아무것도 안 보인다.
    if (!isRatio(point.x) || !isRatio(point.y)) {
      return domainError(
        'invalid-value',
        `좌표는 0과 1 사이여야 한다 (${point.x}, ${point.y})`,
        'strokes',
      )
    }
  }

  if (stroke.width <= 0 || !Number.isFinite(stroke.width)) {
    return domainError('invalid-value', '선 굵기는 0보다 커야 한다', 'strokes')
  }

  if (stroke.color.length === 0) {
    return domainError('empty', '선 색이 비어 있다', 'strokes')
  }

  return null
}

function isRatio(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1
}

export function stickerContent(
  character: string,
  pose: string,
): Result<StickerContent, DomainError> {
  if (character.length === 0) {
    return err(domainError('empty', '캐릭터를 고르지 않았다', 'sticker'))
  }

  const found = stickerPoses.find(known => known === pose)
  if (found === undefined) {
    return err(domainError('invalid-value', `모르는 자세다: ${pose}`, 'sticker'))
  }

  return ok({ kind: 'sticker', character, pose: found })
}

export const MAX_PREVIEW_LENGTH = 4000
export const MAX_CAPTION_LENGTH = 200

export function photoContent(input: {
  assetId: string
  width: number
  height: number
  byteLength: number
  preview?: string
  caption?: string
}): Result<PhotoContent, DomainError> {
  if (input.assetId.length === 0) {
    return err(domainError('empty', '사진 번호가 없다', 'photo'))
  }

  if (!isPositive(input.width) || !isPositive(input.height)) {
    return err(domainError('invalid-value', '사진 크기가 올바르지 않다', 'photo'))
  }

  if (!isPositive(input.byteLength)) {
    return err(domainError('invalid-value', '사진이 비어 있다', 'photo'))
  }

  if ((input.preview?.length ?? 0) > MAX_PREVIEW_LENGTH) {
    return err(domainError('too-long', '미리보기가 너무 크다', 'photo'))
  }

  const caption = input.caption?.trim()
  if ((caption?.length ?? 0) > MAX_CAPTION_LENGTH) {
    return err(domainError('too-long', '사진에 붙인 말이 너무 길다', 'photo'))
  }

  return ok({
    kind: 'photo',
    assetId: input.assetId,
    width: input.width,
    height: input.height,
    byteLength: input.byteLength,
    ...(input.preview === undefined ? {} : { preview: input.preview }),
    ...(caption === undefined || caption.length === 0 ? {} : { caption }),
  })
}

function isPositive(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

export function nudgeContent(): NudgeContent {
  return { kind: 'nudge' }
}

export function systemContent(notice: SystemNotice): SystemContent {
  return { kind: 'system', notice }
}

/** 사람이 보낸 것인가. 앱이 끼워 넣은 알림은 읽음 표시를 하지 않는다 */
export function isFromPerson(content: MessageContent): boolean {
  return content.kind !== 'system'
}

/**
 * 좁은 길(블루투스)로도 보낼 수 있는가.
 * 낙서는 크기가 커서 Wi-Fi 가 열릴 때까지 기다린다.
 */
export function fitsNarrowLink(content: MessageContent): boolean {
  // 이모티콘은 자세 이름만 담겨서 몇십 바이트다. 좁은 길로도 간다.
  //
  // 사진은 메시지 자체는 작지만 뒤따라 오는 조각이 크다. 좁은 길에서는
  // 그 조각이 대화를 통째로 막으므로 Wi-Fi 가 열릴 때까지 기다린다.
  return content.kind !== 'doodle' && content.kind !== 'photo'
}
