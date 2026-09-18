import type { DomainError } from '@/domain/shared/DomainError'
import type { Result } from '@/domain/shared/Result'

/**
 * 사진 같은 큰 것을 기기에 두고 꺼내는 무언가.
 *
 * 메시지 표에는 **어떤 사진인지만** 담기고 실제 바이트는 여기 있다.
 * 표가 무거워지면 대화를 여는 것부터 느려진다.
 */
export interface AssetStore {
  /** 새로 들어온 것을 둔다. base64 로 받는다 */
  write(assetId: string, base64: string): Promise<Result<void, DomainError>>

  /** 조각 하나를 이어 붙인다 */
  appendChunk(
    assetId: string,
    index: number,
    base64: string,
  ): Promise<Result<void, DomainError>>

  /** 다 모인 조각을 하나로 합친다 */
  finish(assetId: string): Promise<Result<string, DomainError>>

  /** 화면에 보여줄 때 쓰는 자리 */
  pathOf(assetId: string): string

  exists(assetId: string): Promise<boolean>

  /** 조각들을 읽어 보낼 때 쓴다 */
  readChunk(assetId: string, index: number): Promise<Result<string, DomainError>>

  remove(assetId: string): Promise<Result<void, DomainError>>
}

/**
 * 사진을 고르고 줄이는 무언가.
 *
 * **원본을 그대로 보내지 않는다.** 몇 MB 짜리가 사설망을 막으면
 * 글까지 못 가게 된다.
 */
export interface ImagePicker {
  /** 앨범에서 고르게 한다. 안 고르면 null */
  pickFromLibrary(): Promise<Result<PickedImage | null, DomainError>>

  /** 바로 찍게 한다 */
  takePhoto(): Promise<Result<PickedImage | null, DomainError>>
}

export interface PickedImage {
  readonly uri: string
  readonly width: number
  readonly height: number
}

export interface ImageResizer {
  /** 긴 변을 맞추고 다시 저장한다 */
  resize(
    uri: string,
    longEdge: number,
    quality: number,
  ): Promise<Result<ResizedImage, DomainError>>

  /**
   * 아주 작게 줄인 미리보기.
   *
   * 메시지와 같이 가서 진짜 사진이 도착할 때까지 흐릿하게 보여준다.
   * **빈 네모보다 기다릴 만하다.**
   */
  makePreview(uri: string): Promise<Result<string, DomainError>>
}

export interface ResizedImage {
  readonly uri: string
  readonly width: number
  readonly height: number
  readonly base64: string
  readonly byteLength: number
}
