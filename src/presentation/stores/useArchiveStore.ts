import { create } from 'zustand'
import {
  archiveFileName,
  autoBackupFileName,
  backupsToRemove,
  shouldAutoBackup,
} from '@/application/archive/ArchiveFiles'
import { ExportConversation } from '@/application/archive/ExportConversation'
import { ImportConversation } from '@/application/archive/ImportConversation'
import type { ConversationRepository } from '@/application/ports/ConversationRepository'
import type { FileSharer, FileStore, Hasher } from '@/application/ports/FileStore'
import { systemClock } from '@/domain/shared/Clock'

/**
 * 대화를 꺼내고 되돌리는 화면이 보는 상태.
 *
 * **오래 걸리는 일이라 진행률을 보여준다.** 아무 표시 없이 몇 초가
 * 지나면 사람은 앱이 멈춘 줄 안다.
 */

interface ArchiveStore {
  readonly busy: boolean
  readonly done: number
  readonly total: number
  readonly message: string | null
  readonly error: string | null
  /** 망가진 파일을 만났다. "그래도 불러올까요?" 를 물을 때 쓴다 */
  readonly damagedPath: string | null

  attach(deps: ArchiveDeps): void
  exportAll(people: PersonInput[]): Promise<void>
  importFile(): Promise<void>
  importAnyway(): Promise<void>
  dismissDamaged(): void
  clear(): void
  autoBackup(people: PersonInput[], lastAt: number | null): Promise<number | null>
}

interface PersonInput {
  peerId: string
  displayName: string
  character: string
}

interface ArchiveDeps {
  readonly repository: ConversationRepository
  readonly files: FileStore
  readonly sharer: FileSharer
  readonly hasher: Hasher
  readonly me: string
}

export const useArchiveStore = create<ArchiveStore>((set, get) => {
  let deps: ArchiveDeps | null = null

  function exporterOf(d: ArchiveDeps): ExportConversation {
    return new ExportConversation({
      repository: d.repository,
      hasher: d.hasher,
      clock: systemClock,
    })
  }

  return {
    busy: false,
    done: 0,
    total: 0,
    message: null,
    error: null,
    damagedPath: null,

    attach(next) {
      deps = next
    },

    /**
     * 세 가지를 한 번에 만들고 공유 창을 띄운다.
     *
     * **고르게 하지 않는다.** 어느 형식이 무엇에 쓰이는지 모르는
     * 사람이 잘못 고르면 되돌릴 수 없는 파일만 남는다.
     */
    async exportAll(people) {
      const d = deps
      if (d === null || get().busy) return

      set({ busy: true, done: 0, total: 0, message: null, error: null })

      const exporter = exporterOf(d)
      const at = systemClock.now()
      const folder = d.files.cachePath()
      const made: string[] = []

      const onProgress = (done: number, total: number) => set({ done, total })

      const plan = [
        {
          path: `${folder}${archiveFileName('json', at)}`,
          chunks: () => exporter.toJsonChunks({ people, onProgress }),
        },
        {
          path: `${folder}${archiveFileName('html', at)}`,
          chunks: () => exporter.toHtmlChunks({ people, me: d.me }),
        },
        {
          path: `${folder}${archiveFileName('text', at)}`,
          chunks: () => exporter.toTextChunks({ people }),
        },
      ]

      for (const item of plan) {
        const written = await d.files.writeStream(item.path, item.chunks())
        if (!written.ok) {
          // 하나가 실패해도 나머지는 만든다. 되돌릴 수 있는 JSON 이
          // 가장 중요한데, 그게 됐으면 절반은 건진 것이다.
          set({ error: written.error.detail })
          continue
        }
        made.push(item.path)
      }

      if (made.length === 0) {
        set({ busy: false, error: '대화를 꺼내지 못했어요. 저장 공간을 확인해 주세요.' })
        return
      }

      const shared = await d.sharer.share(made)
      set({
        busy: false,
        message: shared.ok
          ? `${made.length}개 파일로 꺼냈어요.`
          : '파일은 만들었는데 내보내지 못했어요.',
      })
    },

    async importFile() {
      const d = deps
      if (d === null || get().busy) return

      set({ busy: true, message: null, error: null, damagedPath: null })

      const picked = await d.sharer.pick()
      if (!picked.ok || picked.value === null) {
        set({ busy: false })
        return
      }

      await load(d, picked.value, false, set)
    },

    /** 망가졌지만 그래도 열어보겠다고 했다 */
    async importAnyway() {
      const d = deps
      const path = get().damagedPath
      if (d === null || path === null) return

      set({ busy: true, damagedPath: null })
      await load(d, path, true, set)
    },

    dismissDamaged() {
      set({ damagedPath: null, busy: false })
    },

    clear() {
      set({ message: null, error: null, damagedPath: null })
    },

    /**
     * 사람이 잊어도 최소한은 남게 한다.
     *
     * 앱이 뒤로 갈 때 부른다. **화면을 막지 않는다.** 되돌아온 값은
     * 언제 했는지이고, 안 했으면 null 이다.
     */
    async autoBackup(people, lastAt) {
      const d = deps
      const now = systemClock.epochMillis()
      if (d === null || !shouldAutoBackup(lastAt, now)) return null

      const at = systemClock.now()
      const folder = d.files.documentsPath()
      const path = `${folder}${autoBackupFileName(at)}`

      const written = await d.files.writeStream(
        path,
        exporterOf(d).toJsonChunks({ people }),
      )
      if (!written.ok) return null

      // 오래된 것을 지운다. 저장 공간을 계속 갉아먹으면 안 된다.
      const names = await d.files.list(folder)
      if (names.ok) {
        for (const name of backupsToRemove(names.value)) {
          await d.files.remove(`${folder}${name}`)
        }
      }

      return now
    },
  }
})

type SetState = (partial: Partial<ArchiveStore>) => void

async function load(
  d: ArchiveDeps,
  path: string,
  ignoreDamage: boolean,
  set: SetState,
): Promise<void> {
  const raw = await d.files.read(path)
  if (!raw.ok) {
    set({ busy: false, error: '파일을 읽지 못했어요.' })
    return
  }

  const importer = new ImportConversation({
    repository: d.repository,
    hasher: d.hasher,
  })

  const outcome = await importer.fromJson(raw.value, { ignoreDamage })

  if (!outcome.ok) {
    // 뜯지도 못하는 파일이면 "그래도 열기"를 권하지 않는다. 할 게 없다.
    const canTryAnyway = !ignoreDamage && outcome.error.field === 'integrity'
    set({
      busy: false,
      error: outcome.error.detail,
      damagedPath: canTryAnyway ? path : null,
    })
    return
  }

  const { inserted, skipped, unreadable } = outcome.value
  const parts = [`${inserted}건을 새로 넣었어요.`]
  if (skipped > 0) parts.push(`${skipped}건은 이미 있었어요.`)
  if (unreadable > 0) parts.push(`${unreadable}건은 읽을 수 없었어요.`)

  set({ busy: false, message: parts.join('\n'), error: null })
}
