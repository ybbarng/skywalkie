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
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/domain/**', 'src/application/**', 'src/infrastructure/**'],
      exclude: ['**/*.test.ts', '**/index.ts', '**/*.d.ts'],
      thresholds: {
        // 층별 기대치는 docs/09-testing.md 7장에 있다.
        // 카드를 하나씩 끝낼 때마다 이 값을 올린다.
        'src/domain/**': { statements: 95, branches: 90, functions: 95, lines: 95 },
        'src/application/**': {
          statements: 90,
          branches: 85,
          functions: 90,
          lines: 90,
        },
      },
    },
  },
})
