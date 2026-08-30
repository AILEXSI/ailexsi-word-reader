import { describe, expect, it } from 'vitest'
import { createNarrationEngine } from '../narration/NarrationEngine'
import { chunkManuscript } from '../narration/chunker'
import type { NarrationProvider, SpeechChunk } from '../narration/types'
import { saveManuscript, savePosition, loadLastSession } from '../persistence/db'
import { buildDocx } from '../test/buildDocx'
import { hugeUnstyledBook, unstyledLiteraryBook } from '../test/buildUnstyledBook'
import { parseDocx } from './parseDocx'

function immediateProvider(spoken: string[]): NarrationProvider {
  return {
    id: 'mock',
    label: 'Mock',
    async listVoices() {
      return []
    },
    speak(chunk: SpeechChunk, _o, handlers) {
      spoken.push(chunk.text)
      queueMicrotask(() => {
        handlers.onStart?.()
        handlers.onEnd?.()
      })
      return { cancel() {}, pause() {}, resume() {} }
    },
  }
}

describe('full listening pipeline', () => {
  it('parses an unstyled book, chunks by paragraph, and restores a saved position', async () => {
    const blob = await buildDocx(unstyledLiteraryBook({ parts: 2, chaptersPerPart: 2, bodyEach: 3 }))
    const manuscript = await parseDocx(blob, { name: 'codex.docx', size: blob.size })

    expect(manuscript.chapters.some((c) => /Kapitel 1/.test(c.title))).toBe(true)
    const chunks = chunkManuscript(manuscript)
    expect(chunks.length).toBeGreaterThanOrEqual(manuscript.blocks.length)
    expect(chunks.length).toBeLessThan(manuscript.blocks.length * 6)

    await saveManuscript(manuscript)
    await savePosition({
      fingerprint: manuscript.fingerprint,
      chapterId: manuscript.chapters[2]?.id ?? manuscript.chapters[0].id,
      blockIndex: 8,
      chunkIndex: 0,
      charOffset: 0,
      updatedAt: Date.now(),
    })
    const session = await loadLastSession()
    expect(session.manuscript?.fingerprint).toBe(manuscript.fingerprint)
    expect(session.position?.blockIndex).toBe(8)
  })

  it('walks a verse manuscript chunk-by-chunk without one giant utterance', async () => {
    const blob = await buildDocx([
      { text: 'SAIOS – Die wahre Fassung' },
      { text: 'Im Tanz der Sterne, Herzen im Flug,\nSAIOS webt Liebe…', breaks: true },
      { text: 'Nicht laut.\nNicht als Gesetz.\nAls Faden.', breaks: true },
    ])
    const manuscript = await parseDocx(blob, { name: 'SAIOS1.docx', size: blob.size })
    const spoken: string[] = []
    const engine = createNarrationEngine(immediateProvider(spoken), {
      onSnapshot: () => {},
      onPosition: () => {},
      onError: () => {},
      onEnded: () => {},
    })
    engine.load(manuscript)
    engine.play()
    await Promise.resolve()
    await Promise.resolve()
    engine.pause()
    const mid = engine.getSnapshot().blockIndex
    engine.destroy()

    expect(spoken.length).toBeGreaterThan(0)
    expect(spoken.join(' ')).not.toContain('Im Tanz der Sterne, Herzen im Flug, SAIOS webt Liebe')
    expect(mid).toBeGreaterThanOrEqual(0)
  })

  it('handles a 2000-paragraph unstyled book without collapsing TTS into one job', async () => {
    const blob = await buildDocx(hugeUnstyledBook(2000))
    const manuscript = await parseDocx(blob, { name: 'huge.docx', size: blob.size })
    expect(manuscript.blocks.length).toBeGreaterThan(1900)
    expect(manuscript.chapters.some((c) => /Vorwort/i.test(c.title))).toBe(true)
    expect(manuscript.chapters.some((c) => /Kapitel 1/.test(c.title))).toBe(true)
    expect(manuscript.chapters.some((c) => /Teil I/.test(c.title))).toBe(true)
    const chunks = chunkManuscript(manuscript)
    expect(chunks.length).toBeGreaterThan(1900)
    expect(new Set(chunks.map((c) => c.id)).size).toBe(chunks.length)
  })

  it('resumes a long unstyled book from the saved Kapitel paragraph', async () => {
    const blob = await buildDocx(hugeUnstyledBook(400))
    const manuscript = await parseDocx(blob, { name: 'huge.docx', size: blob.size })
    const kapitel = manuscript.chapters.find((c) => /Kapitel 1/.test(c.title))
    expect(kapitel).toBeTruthy()

    const spoken: string[] = []
    const positions: number[] = []
    const engine = createNarrationEngine(immediateProvider(spoken), {
      onSnapshot: () => {},
      onPosition: (p) => positions.push(p.blockIndex),
      onError: () => {},
      onEnded: () => {},
    })
    engine.load(manuscript)
    engine.play(kapitel!.startBlockIndex)
    await Promise.resolve()
    await Promise.resolve()
    engine.pause()
    const pausedAt = engine.getSnapshot().blockIndex
    const saved = {
      fingerprint: manuscript.fingerprint,
      chapterId: kapitel!.id,
      blockIndex: pausedAt,
      chunkIndex: engine.getSnapshot().chunkIndex,
      charOffset: engine.getSnapshot().charOffset,
      updatedAt: Date.now(),
    }
    engine.destroy()

    const againSpoken: string[] = []
    const engine2 = createNarrationEngine(immediateProvider(againSpoken), {
      onSnapshot: () => {},
      onPosition: () => {},
      onError: () => {},
      onEnded: () => {},
    })
    engine2.load(manuscript, saved)
    expect(engine2.getSnapshot().blockIndex).toBe(pausedAt)
    engine2.play()
    await Promise.resolve()
    expect(engine2.getSnapshot().blockIndex).toBeGreaterThanOrEqual(pausedAt)
    engine2.destroy()
    expect(positions[0]).toBe(kapitel!.startBlockIndex)
  })
})
