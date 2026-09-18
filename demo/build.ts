/**
 * 데모를 한 파일로 묶는다.
 *
 * **진짜 앱 코드를 그대로 쓴다.** `src/` 의 도메인·응용·통신 규약은
 * 순수 TypeScript 라 React Native 없이도 돈다. esbuild 가 그걸 묶어
 * 브라우저가 읽을 수 있는 한 파일로 만든다.
 *
 * ```bash
 * pnpm demo          묶고 서버를 띄운다
 * pnpm demo:build    묶기만 한다
 * ```
 */

import { build } from 'esbuild'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * `.env` 를 읽는다.
 *
 * 핫스팟 이름과 비밀번호는 저장소가 공개라 코드에 적지 않는다.
 * 앱은 Expo 가 알아서 읽어주지만 여기는 esbuild 라 직접 읽는다.
 *
 * **없어도 된다.** 값이 비면 이름을 알려주는 안내만 빠지고
 * 나머지는 그대로 돈다. (`src/composition/hotspot.ts` 참고)
 */
function readEnv(): Record<string, string> {
  let raw: string
  try {
    raw = readFileSync(resolve(root, '.env'), 'utf8')
  } catch {
    return {}
  }

  const values: Record<string, string> = {}
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.length === 0 || trimmed.startsWith('#')) continue

    const at = trimmed.indexOf('=')
    if (at <= 0) continue

    const key = trimmed.slice(0, at).trim()
    const value = trimmed.slice(at + 1).trim()
    values[key] = value.replace(/^["']|["']$/g, '')
  }
  return values
}

async function run(): Promise<void> {
  const env = readEnv()

  /**
   * `process.env` 는 브라우저에 없다.
   *
   * 앱에서는 빌드할 때 값이 박히는데(EXPO_PUBLIC_), 여기서도 같게
   * 해준다. 안 하면 화면을 그리다 통째로 터진다.
   */
  const define: Record<string, string> = {
    'process.env.NODE_ENV': '"production"',
  }
  for (const key of ['EXPO_PUBLIC_HOTSPOT_SSID', 'EXPO_PUBLIC_HOTSPOT_PASSWORD']) {
    define[`process.env.${key}`] = JSON.stringify(env[key] ?? '')
  }

  const result = await build({
    entryPoints: [resolve(root, 'demo/src/main.ts')],
    outfile: resolve(root, 'demo/app.js'),
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    alias: { '@': resolve(root, 'src') },
    define,
    logLevel: 'info',
  })

  if (result.errors.length > 0) process.exit(1)
}

void run()
