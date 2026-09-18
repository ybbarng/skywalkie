import type { DomainError } from '@/domain/shared/DomainError'
import type { Result } from '@/domain/shared/Result'

/**
 * 파일을 다루는 무언가.
 *
 * 대화를 꺼내 두고 다시 불러오는 데 쓴다. 앱이 사라져도 대화는 남아야
 * 하는데, 아이폰 앱이 7일마다 만료되는 조건에서 이건 부가 기능이 아니라
 * 필수다. (docs/05-messaging-spec.md 6장)
 */
export interface FileStore {
  /** 사용자가 파일 앱에서 꺼낼 수 있는 곳 */
  documentsPath(): string

  /** 잠깐 쓰고 버리는 곳. 공유할 파일을 여기 만든다 */
  cachePath(): string

  write(path: string, content: string): Promise<Result<void, DomainError>>

  /**
   * 조각조각 이어 쓴다.
   *
   * 만 건을 한 번에 문자열로 만들면 폰이 죽는다. 그래서 흘려가며 쓴다.
   */
  writeStream(
    path: string,
    chunks: AsyncIterable<string>,
  ): Promise<Result<void, DomainError>>

  read(path: string): Promise<Result<string, DomainError>>

  exists(path: string): Promise<boolean>

  /** 폴더 안의 파일 이름들 */
  list(directory: string): Promise<Result<string[], DomainError>>

  remove(path: string): Promise<Result<void, DomainError>>

  makeDirectory(path: string): Promise<Result<void, DomainError>>

  /** 파일 크기. 화면에 "몇 MB" 를 보여줄 때 쓴다 */
  sizeOf(path: string): Promise<Result<number, DomainError>>
}

/**
 * 파일을 바깥으로 내보내는 무언가.
 *
 * 메일·에어드롭·파일 앱 등 기기가 주는 아무 경로로나 보낸다.
 * 어디로 보낼지는 사용자가 고른다.
 */
export interface FileSharer {
  share(paths: readonly string[]): Promise<Result<void, DomainError>>

  /** 사용자가 파일을 고르게 한다. 되돌리기에서 쓴다 */
  pick(): Promise<Result<string | null, DomainError>>
}

/**
 * 값을 요약하는 무언가.
 *
 * 내보낸 파일이 손상됐는지 확인하는 데 쓴다. 파일이 잘렸는데 모르고
 * 넘어가면 대화가 조용히 사라진다.
 */
export interface Hasher {
  sha256(value: string): Promise<Result<string, DomainError>>
}
