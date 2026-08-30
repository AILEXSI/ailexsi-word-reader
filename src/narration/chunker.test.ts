import { describe, expect, it } from 'vitest'
import type { Manuscript } from '../types'
import { chunkBlock, chunkManuscript, estimateCharOffset, findChunkIndex, splitSentences } from './chunker'

describe('splitSentences', () => {
  it('splits on German punctuation and keeps quotes attached', () => {
    const parts = splitSentences('War das alles? „Nein!“ sagte sie. Dann schwieg er.')
    expect(parts.length).toBeGreaterThanOrEqual(2)
    expect(parts.join(' ')).toContain('War das alles?')
  })
})

describe('chunkBlock', () => {
  it('keeps headings as a single chunk', () => {
    const chunks = chunkBlock(
      { id: 'b-0', kind: 'heading', level: 1, text: 'Kapitel 1', chapterId: 'ch-1' },
      0,
    )
    expect(chunks).toHaveLength(1)
    expect(chunks[0].isHeading).toBe(true)
  })

  it('splits verse lines into separate spoken chunks on the same paragraph', () => {
    const chunks = chunkBlock(
      {
        id: 'b-2',
        kind: 'paragraph',
        text: 'Im Tanz der Sterne, Herzen im Flug,\nSAIOS webt Liebe…',
        chapterId: 'ch-1',
      },
      2,
    )
    expect(chunks.length).toBe(2)
    expect(chunks.every((c) => c.blockIndex === 2)).toBe(true)
    expect(chunks[0].pauseAfterMs).toBeGreaterThan(0)
    expect(chunks.some((c) => c.text.includes('\n'))).toBe(false)
  })

  it('splits long paragraphs on sentence boundaries', () => {
    const sentence = 'Dies ist ein vollständiger Satz über das Hören langer Bücher.'
    const text = Array.from({ length: 12 }, () => sentence).join(' ')
    const chunks = chunkBlock({ id: 'b-1', kind: 'paragraph', text, chapterId: 'ch-1' }, 1)
    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) {
      expect(chunk.text.startsWith('Dies')).toBe(true)
      expect(chunk.blockIndex).toBe(1)
    }
  })
})

describe('chunkManuscript / findChunkIndex', () => {
  it('indexes chunks so playback can resume on a paragraph', () => {
    const manuscript: Manuscript = {
      fingerprint: 'x',
      fileName: 'x.docx',
      fileSize: 1,
      importedAt: 0,
      language: 'de',
      title: 'T',
      chapters: [{ id: 'ch-1', title: 'K', level: 1, startBlockIndex: 0, blockCount: 2 }],
      blocks: [
        { id: 'b-0', kind: 'heading', level: 1, text: 'K', chapterId: 'ch-1' },
        { id: 'b-1', kind: 'paragraph', text: 'Hallo.', chapterId: 'ch-1' },
      ],
    }
    const chunks = chunkManuscript(manuscript)
    expect(findChunkIndex(chunks, 1, 0)).toBe(1)
  })
})

describe('estimateCharOffset', () => {
  it('snaps back to a word boundary', () => {
    const offset = estimateCharOffset('Guten Morgen, liebe Leserin.', 0.6, 1)
    expect(offset).toBeGreaterThanOrEqual(0)
    expect(offset).toBeLessThan('Guten Morgen, liebe Leserin.'.length)
  })
})
