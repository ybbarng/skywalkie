/**
 * 화면 코드에 색을 직접 적었는지 검사한다.
 *
 * `#RRGGBB` 를 화면에 직접 쓰기 시작하면 밝은 화면과 어두운 화면이
 * 어긋난다. 한쪽에서만 안 보이는 글자가 생기고, 그걸 발견하는 건
 * 대개 비행기 안이다. (docs/07-design-system.md 2장)
 *
 * 색을 정의하는 곳(theme 폴더)과 테스트는 검사하지 않는다.
 */

import { readFileSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** 색을 정의하는 곳이라 직접 적는 게 당연하다 */
const exemptPaths = [
  join('src', 'presentation', 'theme'),
  join('src', 'presentation', 'characters', 'palettes.ts'),
  // 앱 화면이 아니라 **밖에서 열리는 HTML** 을 만드는 곳이다.
  // 브라우저는 `useTheme()` 을 모르니 CSS 에 실제 색을 적어야 한다.
  // 여기 값은 테마 토큰과 같게 맞춰 둔다.
  join('src', 'application', 'archive', 'renderHtml.ts'),
]

const searchRoots = [join(projectRoot, 'src'), join(projectRoot, 'app')]

/** #fff, #ffffff, rgba(...), rgb(...) */
const COLOR_PATTERN = /#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(/g

interface Finding {
  file: string
  line: number
  text: string
}

async function collect(dir: string): Promise<string[]> {
  // 폴더가 없을 수도 있다. app/ 은 화면을 만들기 전엔 비어 있다.
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])

  const nested = await Promise.all(
    entries.map(async entry => {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) return collect(full)
      if (!/\.tsx?$/.test(entry.name)) return []
      if (/\.test\.tsx?$/.test(entry.name)) return []
      return [full]
    }),
  )
  return nested.flat()
}

function isExempt(file: string): boolean {
  const rel = relative(projectRoot, file)
  return exemptPaths.some(exempt => rel.startsWith(exempt))
}

function inspect(file: string): Finding[] {
  if (isExempt(file)) return []

  const findings: Finding[] = []
  const lines = readFileSync(file, 'utf8').split('\n')

  lines.forEach((text, index) => {
    // 주석에 적힌 색은 설명이지 스타일이 아니다
    const trimmed = text.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return

    if (COLOR_PATTERN.test(text)) {
      findings.push({ file: relative(projectRoot, file), line: index + 1, text: trimmed })
    }
    COLOR_PATTERN.lastIndex = 0
  })

  return findings
}

async function main(): Promise<void> {
  const files = (await Promise.all(searchRoots.map(collect))).flat()
  const findings = files.flatMap(inspect)

  if (findings.length === 0) {
    console.log(`색 토큰 검사 통과 (${files.length}개 파일)`)
    return
  }

  console.error(`색을 직접 적은 곳 ${findings.length}건\n`)
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}`)
    console.error(`    ${f.text}\n`)
  }
  console.error('useTheme() 의 색 토큰을 쓴다. 규칙은 docs/07-design-system.md 에 있다.')
  process.exit(1)
}

void main()
