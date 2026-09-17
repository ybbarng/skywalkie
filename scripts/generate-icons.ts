/**
 * SVG 원본에서 앱이 쓰는 PNG 를 뽑는다.
 *
 * 그림 파일을 저장소에 두지 않는 이유: 색 하나를 바꾸면 전부 다시 만들어야
 * 하는데, 그러면 어느 게 최신인지 알 수 없게 된다. 원본은 SVG 하나뿐이고
 * 나머지는 여기서 만든다. (docs/07-design-system.md 7장)
 *
 *     pnpm icons:generate
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourceDir = join(projectRoot, 'assets', 'icon')
const outputDir = join(sourceDir, 'generated')

interface Target {
  readonly source: string
  readonly output: string
  readonly size: number
  /** 아이폰 아이콘은 투명한 곳이 있으면 안 된다 */
  readonly background?: string
  readonly note: string
}

const targets: readonly Target[] = [
  {
    source: 'icon.svg',
    output: 'icon.png',
    size: 1024,
    background: '#0B1020',
    note: '아이폰 아이콘. 모서리는 시스템이 자른다',
  },
  {
    source: 'icon-foreground.svg',
    output: 'icon-foreground.png',
    size: 1024,
    note: '안드로이드 앞면',
  },
  {
    source: 'icon-background.svg',
    output: 'icon-background.png',
    size: 1024,
    background: '#0B1020',
    note: '안드로이드 뒷면',
  },
  {
    source: 'icon-monochrome.svg',
    output: 'icon-monochrome.png',
    size: 1024,
    note: '안드로이드 13 테마 아이콘',
  },
  {
    source: 'splash.svg',
    output: 'splash.png',
    size: 512,
    note: '앱을 열 때 잠깐 뜨는 그림',
  },
]

async function main(): Promise<void> {
  await mkdir(outputDir, { recursive: true })

  for (const target of targets) {
    const svg = await readFile(join(sourceDir, target.source))

    let image = sharp(svg, { density: 400 }).resize(target.size, target.size)

    if (target.background !== undefined) {
      image = image.flatten({ background: target.background })
    }

    const png = await image.png().toBuffer()
    await writeFile(join(outputDir, target.output), png)

    console.log(`  ${target.output.padEnd(24)} ${target.size}px  ${target.note}`)
  }

  console.log(`\n아이콘 ${targets.length}개를 만들었다.`)
}

void main().catch((cause: unknown) => {
  console.error('아이콘을 만들지 못했다:', cause)
  process.exit(1)
})
