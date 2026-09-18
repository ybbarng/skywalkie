import * as FileSystem from 'expo-file-system/legacy'
import * as ImageManipulator from 'expo-image-manipulator'
import * as ImagePickerModule from 'expo-image-picker'
import type {
  AssetStore,
  ImagePicker,
  ImageResizer,
  PickedImage,
  ResizedImage,
} from '@/application/ports/AssetTransfer'
import { type DomainError, domainError } from '@/domain/shared/DomainError'
import { err, ok, type Result } from '@/domain/shared/Result'

/**
 * 사진을 고르고 줄이고 기기에 둔다.
 *
 * **여기서 예외가 위로 새면 안 된다.** 권한이 없거나 저장 공간이
 * 모자랄 때 터지는데, 그것 때문에 앱이 죽으면 글까지 못 쓰게 된다.
 *
 * (docs/05-messaging-spec.md 사진 항목 · T22)
 */

export class ExpoImagePicker implements ImagePicker {
  async pickFromLibrary(): Promise<Result<PickedImage | null, DomainError>> {
    return this.run(() =>
      ImagePickerModule.launchImageLibraryAsync({
        mediaTypes: ['images'],
        // 여기서 줄이지 않는다. 우리가 정한 크기로 따로 줄인다.
        quality: 1,
        allowsMultipleSelection: false,
      }),
    )
  }

  async takePhoto(): Promise<Result<PickedImage | null, DomainError>> {
    const allowed = await ImagePickerModule.requestCameraPermissionsAsync().catch(
      () => null,
    )
    if (allowed === null || !allowed.granted) {
      return err(
        domainError(
          'not-found',
          '카메라를 쓸 수 없어요. 설정에서 허용해 주세요',
          'photo',
        ),
      )
    }

    return this.run(() => ImagePickerModule.launchCameraAsync({ quality: 1 }))
  }

  private async run(
    open: () => Promise<ImagePickerModule.ImagePickerResult>,
  ): Promise<Result<PickedImage | null, DomainError>> {
    try {
      const result = await open()
      if (result.canceled) return ok(null)

      const asset = result.assets[0]
      if (asset === undefined) return ok(null)

      return ok({
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
      })
    } catch (cause) {
      return err(wrap(cause, '사진을 고르지 못했다'))
    }
  }
}

export class ExpoImageResizer implements ImageResizer {
  async resize(
    uri: string,
    longEdge: number,
    quality: number,
  ): Promise<Result<ResizedImage, DomainError>> {
    try {
      const context = ImageManipulator.ImageManipulator.manipulate(uri)
      // 긴 변만 정하면 나머지는 비율대로 따라온다. 찌그러지지 않는다.
      context.resize({ width: longEdge })

      const rendered = await context.renderAsync()
      const saved = await rendered.saveAsync({
        compress: quality,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      })

      const base64 = saved.base64 ?? ''
      if (base64.length === 0) {
        return err(domainError('empty', '줄인 사진이 비어 있다', 'photo'))
      }

      return ok({
        uri: saved.uri,
        width: saved.width,
        height: saved.height,
        base64,
        byteLength: base64.length,
      })
    } catch (cause) {
      return err(wrap(cause, '사진을 줄이지 못했다'))
    }
  }

  /**
   * 아주 작게 줄인 미리보기.
   *
   * 32픽셀이면 몇백 바이트다. 메시지와 같이 가서 진짜 사진이 도착할
   * 때까지 흐릿하게 보여준다. **빈 네모보다 기다릴 만하다.**
   */
  async makePreview(uri: string): Promise<Result<string, DomainError>> {
    try {
      const context = ImageManipulator.ImageManipulator.manipulate(uri)
      context.resize({ width: 32 })

      const rendered = await context.renderAsync()
      const saved = await rendered.saveAsync({
        compress: 0.5,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      })

      return ok(saved.base64 ?? '')
    } catch (cause) {
      return err(wrap(cause, '미리보기를 만들지 못했다'))
    }
  }
}

/**
 * 사진을 기기에 둔다.
 *
 * 메시지 표에는 어떤 사진인지만 담기고 바이트는 여기 있다. 표가
 * 무거워지면 대화를 여는 것부터 느려진다.
 */
export class ExpoAssetStore implements AssetStore {
  private readonly folder: string
  private readonly parts = new Map<string, Map<number, string>>()

  constructor() {
    this.folder = `${FileSystem.documentDirectory ?? ''}assets/`
  }

  async write(assetId: string, base64: string): Promise<Result<void, DomainError>> {
    try {
      await this.ensureFolder()
      await FileSystem.writeAsStringAsync(this.pathOf(assetId), base64, {
        encoding: FileSystem.EncodingType.Base64,
      })
      return ok(undefined)
    } catch (cause) {
      return err(wrap(cause, '사진을 두지 못했다'))
    }
  }

  /**
   * 조각을 제자리에 기억해 둔다.
   *
   * **파일에 바로 이어 붙이지 않는다.** 순서가 뒤바뀌어 오기 때문이다.
   * 다 모인 뒤에 자리 순서대로 합친다.
   */
  async appendChunk(
    assetId: string,
    index: number,
    base64: string,
  ): Promise<Result<void, DomainError>> {
    const bucket = this.parts.get(assetId) ?? new Map<number, string>()
    bucket.set(index, base64)
    this.parts.set(assetId, bucket)
    return ok(undefined)
  }

  async finish(assetId: string): Promise<Result<string, DomainError>> {
    const bucket = this.parts.get(assetId)
    if (bucket === undefined) {
      return err(domainError('not-found', '받은 조각이 없다', 'asset'))
    }

    const joined = [...bucket.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, data]) => data)
      .join('')

    const written = await this.write(assetId, joined)
    if (!written.ok) return written

    this.parts.delete(assetId)
    return ok(this.pathOf(assetId))
  }

  pathOf(assetId: string): string {
    return `${this.folder}${assetId}.jpg`
  }

  async exists(assetId: string): Promise<boolean> {
    try {
      const info = await FileSystem.getInfoAsync(this.pathOf(assetId))
      return info.exists
    } catch {
      return false
    }
  }

  async readChunk(assetId: string, index: number): Promise<Result<string, DomainError>> {
    try {
      const whole = await FileSystem.readAsStringAsync(this.pathOf(assetId), {
        encoding: FileSystem.EncodingType.Base64,
      })

      const start = index * CHUNK_CHARS
      if (start >= whole.length) {
        return err(domainError('not-found', '그 조각은 없다', 'asset'))
      }

      return ok(whole.slice(start, start + CHUNK_CHARS))
    } catch (cause) {
      return err(wrap(cause, '조각을 읽지 못했다'))
    }
  }

  async remove(assetId: string): Promise<Result<void, DomainError>> {
    try {
      await FileSystem.deleteAsync(this.pathOf(assetId), { idempotent: true })
      this.parts.delete(assetId)
      return ok(undefined)
    } catch (cause) {
      return err(wrap(cause, '사진을 지우지 못했다'))
    }
  }

  private async ensureFolder(): Promise<void> {
    const info = await FileSystem.getInfoAsync(this.folder)
    if (info.exists) return
    await FileSystem.makeDirectoryAsync(this.folder, { intermediates: true })
  }
}

/** base64 글자 수로 센 한 조각의 크기. AssetChunks 의 CHUNK_BYTES 와 맞춘다 */
const CHUNK_CHARS = 48 * 1024

function wrap(cause: unknown, what: string): DomainError {
  const detail = cause instanceof Error ? cause.message : String(cause)
  return domainError('invalid-value', `${what}: ${detail}`, 'photo')
}
