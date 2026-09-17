/**
 * 층이 의존 규칙을 어기는지 검사한다.
 *
 * 사람이 조심하는 것으로는 부족하다. 반드시 어긴다. 그래서 도구로 막는다.
 * 규칙은 docs/03-architecture.md 에 있다.
 *
 *   presentation ──▶ application ──▶ domain
 *                         ▲
 *                 infrastructure
 *
 * 이 검사가 없으면 층 구분은 지켜지지 않고, 그러면 연결 방식을 바꿀 때
 * 화면 코드까지 뜯어고쳐야 한다.
 */

import { readFileSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const srcRoot = join(projectRoot, 'src')

type Layer = 'domain' | 'application' | 'infrastructure' | 'presentation' | 'composition'

/** 각 층이 기댈 수 있는 층. 자기 자신은 항상 허용된다. */
const allowedLayers: Record<Layer, readonly Layer[]> = {
  domain: [],
  application: ['domain'],
  infrastructure: ['domain', 'application'],
  // 화면은 infrastructure 를 **직접** 참조하지 않는다. 어떤 구현을 쓸지는
  // composition 이 정하고, 화면은 거기서 받아 쓴다.
  //
  // composition 을 허용하는 이유: 화면도 결국 저장소와 연결이 필요하다.
  // 그걸 어디선가는 받아야 하는데, 조립하는 곳을 거치면 "무엇이
  // 끼워졌는지"를 한곳에서만 알게 된다. 대신 composition 에는 조립만
  // 있고 판단이 없어야 한다.
  presentation: ['domain', 'application', 'composition'],
  composition: ['domain', 'application', 'infrastructure', 'presentation'],
}

/**
 * 바깥 패키지를 가져올 수 있는 층.
 * domain 과 application 은 순수해야 한다. React 도 Expo 도 Node 모듈도 모른다.
 * 그래야 진짜 기기 없이 전부 시험할 수 있다.
 */
const mayImportPackages: Record<Layer, boolean> = {
  domain: false,
  application: false,
  infrastructure: true,
  presentation: true,
  composition: true,
}

interface Violation {
  file: string
  line: number
  statement: string
  reason: string
}

const IMPORT_PATTERN =
  /^\s*(?:import|export)[\s\S]*?from\s+['"]([^'"]+)['"]|^\s*import\s+['"]([^'"]+)['"]/gm

async function collectSourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async entry => {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) return collectSourceFiles(full)
      if (!/\.tsx?$/.test(entry.name)) return []
      if (entry.name.endsWith('.d.ts')) return []
      // 테스트는 검사하지 않는다. vitest 를 가져오는 건 당연하고,
      // 도메인을 시험하려면 가짜 부품도 가져와야 한다.
      if (/\.test\.tsx?$/.test(entry.name)) return []
      return [full]
    }),
  )
  return files.flat()
}

function layerOf(absolutePath: string): Layer | null {
  const rel = relative(srcRoot, absolutePath)
  if (rel.startsWith('..')) return null
  const [first] = rel.split(sep)
  if (first !== undefined && first in allowedLayers) return first as Layer
  return null
}

/** import 대상을 절대 경로로 바꾼다. 바깥 패키지면 null 을 준다. */
function resolveTarget(specifier: string, fromFile: string): string | null {
  if (specifier.startsWith('.')) return resolve(dirname(fromFile), specifier)
  if (specifier.startsWith('@/')) return join(srcRoot, specifier.slice(2))
  return null
}

function readImports(file: string): Array<{ line: number; specifier: string }> {
  const source = readFileSync(file, 'utf8')
  const lines = source.split('\n')
  const found: Array<{ line: number; specifier: string }> = []

  // 타입만 가져오는 것도 의존이다. 걸러내지 않는다.
  for (const match of source.matchAll(IMPORT_PATTERN)) {
    const specifier = match[1] ?? match[2]
    if (specifier === undefined) continue
    const before = source.slice(0, match.index ?? 0)
    found.push({ line: before.split('\n').length, specifier })
  }

  // 위 정규식이 놓칠 수 있는 동적 가져오기도 본다.
  lines.forEach((text, index) => {
    for (const match of text.matchAll(/(?:import|require)\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      const specifier = match[1]
      if (specifier !== undefined) found.push({ line: index + 1, specifier })
    }
  })

  return found
}

function inspect(file: string): Violation[] {
  const layer = layerOf(file)
  if (layer === null) return []

  const violations: Violation[] = []
  const allowed = new Set<Layer>([layer, ...allowedLayers[layer]])

  for (const { line, specifier } of readImports(file)) {
    const target = resolveTarget(specifier, file)

    if (target === null) {
      if (mayImportPackages[layer]) continue
      // node: 로 시작하는 것도 바깥이다. domain 은 Node 조차 몰라야 한다.
      violations.push({
        file: relative(projectRoot, file),
        line,
        statement: specifier,
        reason: `${layer} 층은 바깥 패키지를 가져올 수 없다. 순수해야 진짜 기기 없이 시험할 수 있다`,
      })
      continue
    }

    const targetLayer = layerOf(target)
    if (targetLayer === null) continue

    if (!allowed.has(targetLayer)) {
      violations.push({
        file: relative(projectRoot, file),
        line,
        statement: specifier,
        reason: `${layer} 층은 ${targetLayer} 층에 기댈 수 없다`,
      })
    }
  }

  return violations
}

async function main(): Promise<void> {
  let files: string[]
  try {
    files = await collectSourceFiles(srcRoot)
  } catch {
    console.error('src 폴더를 찾지 못했다.')
    process.exit(1)
  }

  const violations = files.flatMap(inspect)

  if (violations.length === 0) {
    console.log(`층 규칙 검사 통과 (${files.length}개 파일)`)
    return
  }

  console.error(`층 규칙을 어긴 곳 ${violations.length}건\n`)
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}`)
    console.error(`    '${v.statement}' 를 가져온다`)
    console.error(`    ${v.reason}\n`)
  }
  console.error('규칙은 docs/03-architecture.md 에 있다.')
  process.exit(1)
}

void main()
