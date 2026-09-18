import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * 연결 지키기의 양쪽이 어긋나지 않았는지.
 *
 * **작업 이름이 한 글자만 달라도 조용히 아무 일도 안 일어난다.**
 * 서비스는 켜지는데 JS 작업을 못 찾아서 헛돌고, 타이머는 그대로
 * 멎는다. 오류도 안 난다. 비행기에서 이걸 알아챌 방법이 없다.
 *
 * 그림이나 소리와 달리 이건 **글자 맞춰보기로 잡을 수 있다.**
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const moduleRoot = join(root, 'modules', 'stay-alive')

function read(...parts: string[]): string {
  return readFileSync(join(moduleRoot, ...parts), 'utf8')
}

const kotlinService = read(
  'android',
  'src',
  'main',
  'java',
  'com',
  'ybbarng',
  'skywalkie',
  'stayalive',
  'StayAliveService.kt',
)
const manifest = read('android', 'src', 'main', 'AndroidManifest.xml')
const config = JSON.parse(read('expo-module.config.json'))
const javascript = read('src', 'index.ts')

describe('헤드리스 작업 이름', () => {
  it('네이티브와 JS 가 같은 이름을 쓴다', () => {
    const native = /const val TASK_NAME = "([^"]+)"/.exec(kotlinService)?.[1]
    const js = /const TASK_NAME = '([^']+)'/.exec(javascript)?.[1]

    expect(native).toBeDefined()
    expect(js).toBe(native)
  })
})

describe('전경 서비스 선언', () => {
  it('매니페스트에 서비스가 있다', () => {
    expect(manifest).toContain('.StayAliveService')
  })

  it('갈래를 적어뒀다', () => {
    // 안드로이드 14 부터 갈래가 없으면 켜는 순간 터진다.
    expect(manifest).toContain('android:foregroundServiceType="connectedDevice"')
  })

  it('최근 앱에서 쓸어 넘겨도 안 멈춘다', () => {
    // 화면만 치운 것이지 앱을 지운 게 아니다. 대화는 이어져야 한다.
    expect(manifest).toContain('android:stopWithTask="false"')
  })

  it('갈래에 맞는 권한을 앱에 적어뒀다', () => {
    const appConfig = readFileSync(join(root, 'app.config.ts'), 'utf8')

    expect(appConfig).toContain('android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE')
  })
})

describe('모듈 설정', () => {
  it('안드로이드에만 둔다', () => {
    // 아이폰에는 이런 길이 없다. 넣어두면 빌드만 어긋난다.
    expect(config.platforms).toEqual(['android'])
  })

  it('오토링킹이 찾을 클래스 이름이 실제와 같다', () => {
    const declared: string = config.android.modules[0]
    const pkg = /^package (.+)$/m.exec(
      read(
        'android',
        'src',
        'main',
        'java',
        'com',
        'ybbarng',
        'skywalkie',
        'stayalive',
        'StayAliveModule.kt',
      ),
    )?.[1]

    expect(declared).toBe(`${pkg}.StayAliveModule`)
  })
})

describe('없어도 앱은 돈다', () => {
  it('맨 위에서 네이티브 모듈을 들여오지 않는다', () => {
    // 아이폰에는 이 모듈이 아예 없다. 맨 위에서 들여오면 앱이 안 켜진다.
    expect(javascript).not.toMatch(/^import .* from 'expo-modules-core'/m)
    expect(javascript).toContain("require('expo-modules-core')")
  })

  it('아이폰에서는 없는 것으로 친다', () => {
    expect(javascript).toContain("Platform.OS !== 'android'")
  })
})
