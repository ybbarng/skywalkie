/**
 * 켜자마자 도는 길에 네이티브 모듈을 맨 위에서 들여오는지 검사한다.
 *
 * ## 왜 막나
 *
 * 네이티브 모듈은 **빌드가 어긋나면 들여오는 순간 터진다.** 그게 앱을
 * 켜자마자 도는 파일이면 앱이 통째로 안 켜진다. 글도 못 쓴다.
 *
 * 비행기에서는 고칠 방법이 없다. 앱 스토어 업데이트도 서버 수정도
 * 없다. **덤 하나가 없어서 대화 자체를 못 하게 되는 것**이 이 앱에서
 * 가장 나쁜 일이다.
 *
 * ## 어떻게 쓰나
 *
 * 쓸 때 들여온다. 없으면 없는 대로 간다.
 *
 * ```ts
 * // ❌ 맨 위에서
 * import * as Haptics from 'expo-haptics'
 *
 * // ✅ 쓸 때, 감싸서
 * try {
 *   const haptics = require('expo-haptics')
 * } catch {
 *   // 없으면 없는 대로
 * }
 * ```
 *
 * ## 무엇을 보나
 *
 * `composition/services.ts` 는 거의 모든 화면이 들고 있다. 여기서
 * 출발해 닿는 파일 전부가 "켜자마자 도는 길" 이다. (docs/03-architecture.md)
 */

import { readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const srcRoot = join(projectRoot, 'src')

/** 여기서 출발해 닿는 것을 전부 본다 */
const entries = [
  join(srcRoot, 'composition', 'services.ts'),
  join(srcRoot, 'composition', 'hotspot.ts'),
]

/**
 * 맨 위에서 들여와도 되는 것.
 *
 * `react-native` 자체와 React 는 이미 들어 있지 않으면 앱이 못 돈다.
 * 검사해봐야 막을 수 있는 게 없다.
 */
const alwaysThere = new Set(['react', 'react-native', 'react/jsx-runtime'])

/**
 * 없으면 앱이 어차피 못 도는 것.
 *
 * 저장소와 소켓은 이 앱의 뼈대다. 이것들이 없으면 글을 쓸 수도
 * 주고받을 수도 없으니, 늦게 터지나 일찍 터지나 마찬가지다.
 * **덤이 아닌 것만 여기 적는다.**
 */
const core = new Set(['expo-sqlite/kv-store', 'expo-sqlite'])

interface Violation {
  readonly file: string
  readonly line: number
  readonly specifier: string
}

/** 맨 위에서 들여오는 것만 본다. `require()` 는 이미 감싼 것이다 */
const TOP_IMPORT =
  /^\s*import\s+(?:type\s+)?[\s\S]*?from\s+['"]([^'"]+)['"]|^\s*import\s+['"]([^'"]+)['"]/gm

function localTarget(specifier: string, fromFile: string): string | null {
  if (specifier.startsWith('.')) return resolve(dirname(fromFile), specifier)
  if (specifier.startsWith('@/')) return join(srcRoot, specifier.slice(2))
  return null
}

function withExtension(path: string): string | null {
  for (const candidate of [path, `${path}.ts`, `${path}.tsx`, join(path, 'index.ts')]) {
    try {
      readFileSync(candidate, 'utf8')
      return candidate
    } catch {
      // 다음 것을 해본다
    }
  }
  return null
}

/** 네이티브가 딸린 패키지인가. 타입만 가져오는 것은 터지지 않는다 */
function isNative(specifier: string, statement: string): boolean {
  if (alwaysThere.has(specifier) || core.has(specifier)) return false
  if (!/^(?:expo-|react-native-)/.test(specifier)) return false
  // `import type { X } from 'expo-…'` 는 빌드 결과에 안 남는다
  return !/^\s*import\s+type\s/.test(statement)
}

const seen = new Set<string>()
const violations: Violation[] = []

function walk(file: string): void {
  if (seen.has(file)) return
  seen.add(file)

  let source: string
  try {
    source = readFileSync(file, 'utf8')
  } catch {
    return
  }

  for (const match of source.matchAll(TOP_IMPORT)) {
    const specifier = match[1] ?? match[2]
    if (specifier === undefined) continue

    const before = source.slice(0, match.index ?? 0)
    const line = before.split('\n').length

    const local = localTarget(specifier, file)
    if (local !== null) {
      /**
       * 타입만 가져오는 것은 따라가지 않는다.
       *
       * `import type { X } from './Y'` 는 빌드 결과에 안 남는다.
       * 그 파일은 켜자마자 도는 길에 들어오지 않는다.
       */
      if (/^\s*import\s+type\s/.test(match[0])) continue

      const resolved = withExtension(local)
      if (resolved !== null) walk(resolved)
      continue
    }

    if (isNative(specifier, match[0])) {
      violations.push({ file: relative(projectRoot, file), line, specifier })
    }
  }
}

for (const entry of entries) walk(entry)

if (violations.length > 0) {
  console.error('켜자마자 도는 길에서 네이티브 모듈을 맨 위에서 들여온다.\n')
  console.error('빌드가 어긋나면 앱이 통째로 안 켜진다. 쓸 때 들여오도록 바꾼다.\n')

  for (const violation of violations) {
    console.error(`  ${violation.file}:${violation.line}  ${violation.specifier}`)
  }

  console.error('\n고치는 법은 scripts/check-native.ts 맨 위에 있다.')
  process.exit(1)
}

console.log(`켜자마자 도는 길 검사 통과 (${seen.size}개 파일)`)
