import { vi } from 'vitest'

/**
 * 화면 시험을 위한 바닥 깔기.
 *
 * `expo-modules-core` 는 앱이 켜질 때 네이티브가 넣어주는 `globalThis.expo`
 * 를 곧바로 읽는다. 맥에는 그게 없어서 **들여오는 순간 터진다.**
 *
 * 진짜 동작을 흉내 내려는 것이 아니다. **들여오기가 통과하게만** 해둔다.
 * 화면이 실제로 네이티브를 쓰는 곳은 그 자리에서 따로 흉내 낸다.
 *
 * (docs/09-testing.md)
 */

class FakeEventEmitter {
  addListener(): { remove: () => void } {
    return { remove: () => undefined }
  }
  removeListener(): void {}
  removeAllListeners(): void {}
  emit(): void {}
  listenerCount(): number {
    return 0
  }
  startObserving(): void {}
  stopObserving(): void {}
}

class FakeNativeModule extends FakeEventEmitter {}
class FakeSharedObject extends FakeEventEmitter {}
class FakeSharedRef extends FakeSharedObject {}

const expoGlobal = {
  EventEmitter: FakeEventEmitter,
  NativeModule: FakeNativeModule,
  SharedObject: FakeSharedObject,
  SharedRef: FakeSharedRef,
  /**
   * 어떤 네이티브 모듈을 찾든 빈 껍데기를 내준다.
   *
   * `requireNativeModule('ExpoNetwork')` 처럼 이름을 찍어 찾는데, 맥에는
   * 하나도 없다. 이름마다 흉내를 만들면 끝이 없으므로 **묻는 대로 내준다.**
   * 진짜로 값이 필요한 곳은 그 시험에서 따로 흉내 낸다.
   */
  modules: new Proxy({} as Record<string, unknown>, {
    get: (box, name: string) => {
      if (!(name in box)) box[name] = new FakeNativeModule()
      return box[name]
    },
    has: () => true,
  }),
  uuidv4: () => '00000000-0000-4000-8000-000000000000',
  uuidv5: () => '00000000-0000-5000-8000-000000000000',
  getViewConfig: () => null,
  reloadAppAsync: async () => undefined,
}

// biome-ignore lint/suspicious/noExplicitAny: 네이티브가 넣어주는 값을 대신 채운다
;(globalThis as any).expo = expoGlobal
// biome-ignore lint/suspicious/noExplicitAny: 위와 같다
;(globalThis as any).__ExpoImportMetaRegistry = undefined

/**
 * 기기에 남기는 저장소를 흉내 낸다.
 *
 * 진짜는 `expo-sqlite/kv-store` 라 맥에서 안 돈다. **여기서 보려는 것은
 * 저장이 되는가가 아니라 화면이 도는가**라, 기억만 해두면 된다.
 *
 * 저장이 답을 안 하는 상황을 보고 싶으면 그 시험에서 따로 덮어쓴다.
 */
vi.mock('expo-sqlite/kv-store', () => {
  const box = new Map<string, string>()

  return {
    default: {
      getItem: async (key: string) => box.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        box.set(key, value)
      },
      removeItem: async (key: string) => {
        box.delete(key)
      },
    },
  }
})
