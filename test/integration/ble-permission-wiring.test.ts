import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { BLUETOOTH_PERMISSIONS } from '@/infrastructure/transport/ble/blePermission'

/**
 * 블루투스 권한 설정이 어긋나지 않았는지.
 *
 * **비행기 안에서는 블루투스 말고 다른 길이 없다.** 갤럭시는 비행기
 * 모드에서 핫스팟이 안 켜진다(2026-09-18 확인). 그래서 이 길이 막히면
 * 대화 자체를 못 한다.
 *
 * 그런데 안드로이드 12 부터 블루투스 찾기가 **조용히** 실패한다.
 * 권한이 없거나 `neverForLocation` 표시가 없으면 오류도 안 나고
 * 결과만 영영 안 온다. 화면에는 "상대를 못 찾았다" 로만 보인다.
 * **비행기에서 이걸 알아챌 방법이 없다.**
 *
 * 그림이나 전파와 달리 이건 글자 맞춰보기로 잡을 수 있다.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const appConfig = readFileSync(join(root, 'app.config.ts'), 'utf8')

describe('찾기 권한에 neverForLocation 이 붙는가', () => {
  it('플러그인이 neverForLocation 으로 켜져 있다', () => {
    // 이게 없으면 위치 권한까지 받고 위치 서비스도 켜져 있어야 한다.
    expect(appConfig).toContain('react-native-ble-plx')
    expect(appConfig).toMatch(/neverForLocation:\s*true/)
  })

  it('BLUETOOTH_SCAN 을 권한 목록에 직접 적지 않는다', () => {
    // **여기가 이 파일의 핵심이다.**
    //
    // 플러그인은 `BLUETOOTH_SCAN` 이 이미 있으면 건너뛴다. 목록에
    // 적어두면 표시 없는 쪽이 먼저 들어가고 플러그인은 아무것도 안 한다.
    // 빌드는 멀쩡히 되고 앱도 켜지는데 **찾기만 안 된다.**
    const permissionList = /permissions:\s*\[([\s\S]*?)\]/.exec(appConfig)?.[1] ?? ''

    expect(permissionList).not.toContain("'android.permission.BLUETOOTH_SCAN'")
  })

  it('나머지 블루투스 권한은 목록에 있다', () => {
    // 이 둘은 플러그인이 안 넣어준다
    expect(appConfig).toContain("'android.permission.BLUETOOTH_CONNECT'")
    expect(appConfig).toContain("'android.permission.BLUETOOTH_ADVERTISE'")
  })
})

describe('묻는 코드와 매니페스트가 같은 이름을 쓴다', () => {
  it('코드가 아는 이름이 안드로이드의 이름과 같다', () => {
    // 한 글자만 달라도 `requestMultiple` 이 조용히 거절로 돌아온다
    expect(BLUETOOTH_PERMISSIONS.scan).toBe('android.permission.BLUETOOTH_SCAN')
    expect(BLUETOOTH_PERMISSIONS.connect).toBe('android.permission.BLUETOOTH_CONNECT')
    expect(BLUETOOTH_PERMISSIONS.advertise).toBe('android.permission.BLUETOOTH_ADVERTISE')
    expect(BLUETOOTH_PERMISSIONS.location).toBe('android.permission.ACCESS_FINE_LOCATION')
  })
})

describe('찾기 전에 묻는가', () => {
  const transport = readFileSync(
    join(root, 'src', 'infrastructure', 'transport', 'ble', 'BleMessageTransport.ts'),
    'utf8',
  )

  it('scan 이 askForBluetooth 를 먼저 부른다', () => {
    const scanBody = /private async scan\(\)[\s\S]*?\n {2}}/.exec(transport)?.[0] ?? ''

    expect(scanBody).toContain('askForBluetooth')

    // **묻는 것이 먼저다.** 모듈부터 열고 물으면 순서가 뒤집혀도
    // 테스트가 통과해버리므로 자리까지 본다.
    const asked = scanBody.indexOf('askForBluetooth')
    const loaded = scanBody.indexOf('loadBle()')

    expect(asked).toBeGreaterThan(-1)
    expect(loaded).toBeGreaterThan(asked)
  })
})
