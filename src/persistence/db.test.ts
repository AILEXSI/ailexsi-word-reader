import { beforeEach, describe, expect, it } from 'vitest'
import type { Manuscript, ReadingPosition } from '../types'
import { loadLastSession, loadPosition, saveManuscript, savePosition } from './db'

const manuscript: Manuscript = {
  fingerprint: 'demo.docx|12|abc',
  fileName: 'demo.docx',
  fileSize: 12,
  importedAt: 1,
  language: 'de',
  title: 'Demo',
  chapters: [{ id: 'ch-1', title: 'Kapitel 1', level: 2, startBlockIndex: 0, blockCount: 1 }],
  blocks: [{ id: 'b-0', kind: 'paragraph', text: 'Hallo.', chapterId: 'ch-1' }],
}

describe('position store', () => {
  beforeEach(() => {
    indexedDB.deleteDatabase('ailexsi-word-reader')
  })

  it('stores manuscript and reading position separately from the file', async () => {
    await saveManuscript(manuscript)
    const position: ReadingPosition = {
      fingerprint: manuscript.fingerprint,
      chapterId: 'ch-1',
      blockIndex: 4,
      chunkIndex: 1,
      charOffset: 12,
      updatedAt: 99,
    }
    await savePosition(position)

    const session = await loadLastSession()
    expect(session.manuscript?.title).toBe('Demo')
    expect(session.position?.blockIndex).toBe(4)

    const again = await loadPosition(manuscript.fingerprint)
    expect(again?.charOffset).toBe(12)
  })
})
