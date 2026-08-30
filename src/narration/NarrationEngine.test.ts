import { describe, expect, it, vi } from 'vitest'
import type { Manuscript } from '../types'
import { createNarrationEngine } from './NarrationEngine'
import type { NarrationProvider, SpeechChunk, UtteranceHandlers } from './types'

function manuscript(): Manuscript {
  return {
    fingerprint: 'f',
    fileName: 'f.docx',
    fileSize: 1,
    importedAt: 1,
    language: 'de',
    title: 'T',
    chapters: [
      { id: 'ch-1', title: 'Kapitel 1', level: 2, startBlockIndex: 0, blockCount: 2 },
      { id: 'ch-2', title: 'Kapitel 2', level: 2, startBlockIndex: 2, blockCount: 1 },
    ],
    blocks: [
      { id: 'b-0', kind: 'heading', level: 2, text: 'Kapitel 1', chapterId: 'ch-1' },
      { id: 'b-1', kind: 'paragraph', text: 'Erster Absatz.', chapterId: 'ch-1' },
      { id: 'b-2', kind: 'heading', level: 2, text: 'Kapitel 2', chapterId: 'ch-2' },
    ],
  }
}

function immediateProvider(onSpeak?: (chunk: SpeechChunk) => void): NarrationProvider {
  return {
    id: 'mock',
    label: 'Mock',
    async listVoices() {
      return []
    },
    speak(chunk, _options, handlers: UtteranceHandlers) {
      onSpeak?.(chunk)
      queueMicrotask(() => {
        handlers.onStart?.()
        handlers.onEnd?.()
      })
      return { cancel() {}, pause() {}, resume() {} }
    },
  }
}

describe('NarrationEngine', () => {
  it('walks chunks in order and reports the last position', async () => {
    vi.useFakeTimers()
    const spoken: string[] = []
    const positions: number[] = []
    let ended = false
    const engine = createNarrationEngine(immediateProvider((c) => spoken.push(c.text)), {
      onSnapshot: () => {},
      onPosition: (p) => positions.push(p.blockIndex),
      onError: () => {},
      onEnded: () => {
        ended = true
      },
    })
    engine.load(manuscript())
    engine.play()
    await vi.runAllTimersAsync()
    expect(spoken).toEqual(['Kapitel 1', 'Erster Absatz.', 'Kapitel 2'])
    expect(ended).toBe(true)
    expect(positions.at(-1)).toBe(2)
    engine.destroy()
    vi.useRealTimers()
  })

  it('keeps the cursor on a failed chunk instead of skipping it', async () => {
    const provider: NarrationProvider = {
      id: 'mock',
      label: 'Mock',
      async listVoices() {
        return []
      },
      speak(chunk, _o, handlers) {
        queueMicrotask(() =>
          handlers.onError?.({
            message: 'fail',
            chunkId: chunk.id,
            blockIndex: chunk.blockIndex,
            retryable: true,
          }),
        )
        return { cancel() {}, pause() {}, resume() {} }
      },
    }
    const errors: number[] = []
    const engine = createNarrationEngine(provider, {
      onSnapshot: () => {},
      onPosition: () => {},
      onError: (e) => errors.push(e.blockIndex),
      onEnded: () => {},
    })
    engine.load(manuscript())
    engine.play()
    await Promise.resolve()
    await Promise.resolve()
    expect(errors[0]).toBe(0)
    expect(engine.getSnapshot().failedBlockIndex).toBe(0)
    expect(engine.getSnapshot().status).toBe('paused')
    engine.destroy()
  })
})
