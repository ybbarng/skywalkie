import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * 도메인과 응용 계층은 아무것도 import 하지 않는 순수한 코드라
 * React Native 없이 그냥 돌아간다. 그래서 기본 환경으로 충분하다.
 * React Native 화면을 다루는 테스트는 T13에서 별도 환경을 붙인다.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@test': fileURLToPath(new URL('./test', import.meta.url)),
      '@ble': fileURLToPath(new URL('./modules/ble-peripheral/src', import.meta.url)),
      '@stayalive': fileURLToPath(new URL('./modules/stay-alive/src', import.meta.url)),

      /*
        화면을 시험하려면 네이티브 라이브러리를 흉내 내야 한다.

        `react-native` 은 Flow 로 적혀 있고 나머지는 네이티브 코드라
        vitest 가 그대로는 못 읽는다. **색과 여백은 어차피 못 보지만,
        누를 수 있는가·잠겼는가·글자가 들어가는가는 여기서 잡힌다.**

        이걸 안 해둔 탓에 "다음 버튼이 안 눌린다" 같은 것을 폰에 깔아본
        뒤에야 알았다. (docs/09-testing.md)
      */
      'react-native-safe-area-context': fileURLToPath(
        new URL('./test/support/nativeShims.tsx', import.meta.url),
      ),
      'react-native-reanimated': fileURLToPath(
        new URL('./test/support/reanimated.tsx', import.meta.url),
      ),
      'react-native-svg': fileURLToPath(
        new URL('./test/support/nativeShims.tsx', import.meta.url),
      ),
      'react-native': fileURLToPath(
        new URL('./test/support/reactNative.tsx', import.meta.url),
      ),
    },
  },
  // React Native 코드가 이 값을 곧바로 읽는다. 없으면 들여오는 순간 터진다.
  define: {
    __DEV__: 'false',
  },

  test: {
    globals: true,
    environment: 'node',
    // 화면을 시험하려면 네이티브가 넣어주는 값들을 대신 채워둬야 한다
    setupFiles: ['./test/support/setup.ts'],
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'test/**/*.test.ts',
      'test/**/*.test.tsx',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/domain/**', 'src/application/**', 'src/infrastructure/**'],
      exclude: ['**/*.test.ts', '**/index.ts', '**/*.d.ts'],
      thresholds: {
        // 층별 기대치는 docs/09-testing.md 7장에 있다.
        //
        // 분기(branches)만 다른 항목보다 낮게 잡았다. v8 은 기본값과
        // 옵셔널 파라미터까지 분기로 세어서, 실제로는 다 시험했는데도
        // 숫자가 낮게 나온다. 여기에 맞추려고 의미 없는 테스트를 늘리면
        // 오히려 손해다.
        'src/domain/**': { statements: 95, branches: 90, functions: 95, lines: 95 },
        'src/application/**': {
          statements: 90,
          branches: 75,
          functions: 90,
          lines: 90,
        },
      },
    },
  },
})
