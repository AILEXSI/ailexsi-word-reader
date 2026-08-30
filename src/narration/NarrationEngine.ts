import type { Manuscript, ReadingPosition } from '../types'
import { chunkManuscript, estimateCharOffset, estimateSeconds, findChunkIndex } from './chunker'
import type {
  EngineSnapshot,
  EngineStatus,
  NarrationError,
  NarrationProvider,
  SpeakOptions,
  SpeechChunk,
  SpokenUtterance,
} from './types'

export interface EngineCallbacks {
  onSnapshot: (snapshot: EngineSnapshot) => void
  onPosition: (position: ReadingPosition) => void
  onError: (error: NarrationError) => void
  onEnded: () => void
}

export interface NarrationEngine {
  load(manuscript: Manuscript, position?: ReadingPosition | null): void
  play(fromBlockIndex?: number): void
  pause(): void
  resume(): void
  stop(): void
  nextParagraph(): void
  previousParagraph(): void
  nextChapter(): void
  previousChapter(): void
  skipForward(seconds: number): void
  skipBack(seconds: number): void
  jumpToBlock(blockIndex: number): void
  retryFailed(): void
  continueAfterError(): void
  setOptions(partial: Partial<SpeakOptions>): void
  getSnapshot(): EngineSnapshot
  destroy(): void
}

const DEFAULT_HEADING_PAUSE_MS = 320

export function createNarrationEngine(
  provider: NarrationProvider,
  callbacks: EngineCallbacks,
): NarrationEngine {
  let manuscript: Manuscript | null = null
  let chunks: SpeechChunk[] = []
  let cursor = 0
  let charOffset = 0
  let status: EngineStatus = 'idle'
  let spoken: SpokenUtterance | null = null
  let startedAt = 0
  let pausedElapsed = 0
  let options: SpeakOptions = { voiceId: null, rate: 1, volume: 1, lang: 'de-DE' }
  let headingPause: number | null = null
  let destroyed = false
  let lastError: NarrationError | null = null

  const currentChunk = (): SpeechChunk | null => chunks[cursor] ?? null

  const snapshot = (): EngineSnapshot => ({
    status,
    chunk: currentChunk(),
    blockIndex: currentChunk()?.blockIndex ?? 0,
    chunkIndex: currentChunk()?.chunkIndex ?? 0,
    charOffset,
    failedBlockIndex: lastError?.blockIndex ?? null,
  })

  const emit = () => {
    if (!destroyed) callbacks.onSnapshot(snapshot())
  }

  const persist = () => {
    if (!manuscript || destroyed) return
    const chunk = currentChunk()
    callbacks.onPosition({
      fingerprint: manuscript.fingerprint,
      chapterId: chunk?.chapterId ?? manuscript.chapters[0]?.id ?? '',
      blockIndex: chunk?.blockIndex ?? 0,
      chunkIndex: chunk?.chunkIndex ?? 0,
      charOffset,
      updatedAt: Date.now(),
    })
  }

  const clearHeadingPause = () => {
    if (headingPause != null) {
      window.clearTimeout(headingPause)
      headingPause = null
    }
  }

  const cancelSpoken = () => {
    spoken?.cancel()
    spoken = null
    clearHeadingPause()
  }

  const liveElapsed = (): number => {
    if (status === 'playing' && startedAt) return (Date.now() - startedAt) / 1000
    return pausedElapsed
  }

  const captureOffset = () => {
    const chunk = currentChunk()
    if (!chunk) {
      charOffset = 0
      return
    }
    charOffset = estimateCharOffset(chunk.text, liveElapsed(), options.rate)
  }

  const speakCursor = (fromOffset = 0) => {
    const chunk = currentChunk()
    if (!chunk || !manuscript) {
      status = 'idle'
      emit()
      callbacks.onEnded()
      return
    }

    lastError = null
    const sourceText = fromOffset > 0 ? chunk.text.slice(fromOffset).trim() : chunk.text
    const playable: SpeechChunk = sourceText && sourceText !== chunk.text
      ? { ...chunk, text: sourceText }
      : chunk

    charOffset = fromOffset
    startedAt = Date.now()
    pausedElapsed = 0
    status = 'playing'
    persist()
    emit()

    spoken = provider.speak(playable, options, {
      onStart: () => {
        startedAt = Date.now()
        emit()
      },
      onBoundary: (index) => {
        charOffset = fromOffset + index
      },
      onEnd: () => {
        if (destroyed || status !== 'playing') return
        spoken = null
        charOffset = 0
        const finished = chunk
        const advance = () => {
          if (destroyed || status !== 'playing') return
          if (cursor < chunks.length - 1) {
            cursor += 1
            speakCursor(0)
          } else {
            status = 'idle'
            persist()
            emit()
            callbacks.onEnded()
          }
        }
        const pause = finished.pauseAfterMs || (finished.isHeading ? DEFAULT_HEADING_PAUSE_MS : 0)
        if (pause > 0) {
          headingPause = window.setTimeout(advance, pause)
        } else {
          advance()
        }
      },
      onError: (error) => {
        if (destroyed) return
        spoken = null
        lastError = error
        status = 'paused'
        persist()
        emit()
        callbacks.onError(error)
      },
    })
  }

  const playFrom = (chunkIndex: number, offset = 0) => {
    cancelSpoken()
    cursor = Math.max(0, Math.min(chunkIndex, Math.max(0, chunks.length - 1)))
    speakCursor(offset)
  }

  return {
    load(next, position) {
      cancelSpoken()
      manuscript = next
      chunks = chunkManuscript(next)
      lastError = null
      status = 'idle'
      if (position && position.fingerprint === next.fingerprint) {
        const idx = findChunkIndex(chunks, position.blockIndex, position.chunkIndex)
        cursor = idx >= 0 ? idx : 0
        charOffset = position.charOffset ?? 0
      } else {
        cursor = 0
        charOffset = 0
      }
      emit()
    },

    play(fromBlockIndex) {
      if (!manuscript || chunks.length === 0) return
      if (fromBlockIndex != null) {
        const idx = findChunkIndex(chunks, fromBlockIndex, 0)
        playFrom(idx >= 0 ? idx : 0, 0)
        return
      }
      playFrom(cursor, charOffset)
    },

    pause() {
      if (status !== 'playing') return
      captureOffset()
      pausedElapsed = liveElapsed()
      spoken?.pause()
      clearHeadingPause()
      status = 'paused'
      persist()
      emit()
    },

    resume() {
      if (status === 'paused' && spoken) {
        spoken.resume()
        startedAt = Date.now() - pausedElapsed * 1000
        status = 'playing'
        emit()
        return
      }
      if (status === 'paused' || status === 'idle') {
        playFrom(cursor, charOffset)
      }
    },

    stop() {
      cancelSpoken()
      charOffset = 0
      pausedElapsed = 0
      status = 'idle'
      persist()
      emit()
    },

    nextParagraph() {
      const chunk = currentChunk()
      if (!chunk) return
      const next = chunks.findIndex((c) => c.blockIndex > chunk.blockIndex)
      if (next < 0) return
      if (status === 'playing') playFrom(next, 0)
      else {
        cancelSpoken()
        cursor = next
        charOffset = 0
        pausedElapsed = 0
        persist()
        emit()
      }
    },

    previousParagraph() {
      const chunk = currentChunk()
      if (!chunk) return
      let prev = -1
      for (let i = 0; i < chunks.length; i++) {
        if (chunks[i].blockIndex < chunk.blockIndex) prev = i
      }
      const target = prev >= 0 ? chunks.findIndex((c) => c.blockIndex === chunks[prev].blockIndex) : 0
      if (status === 'playing') playFrom(target, 0)
      else {
        cancelSpoken()
        cursor = target
        charOffset = 0
        pausedElapsed = 0
        persist()
        emit()
      }
    },

    nextChapter() {
      if (!manuscript) return
      const chunk = currentChunk()
      const currentId = chunk?.chapterId
      const idx = manuscript.chapters.findIndex((c) => c.id === currentId)
      const next = manuscript.chapters[idx + 1]
      if (!next) return
      this.jumpToBlock(next.startBlockIndex)
    },

    previousChapter() {
      if (!manuscript) return
      const chunk = currentChunk()
      const currentId = chunk?.chapterId
      const idx = manuscript.chapters.findIndex((c) => c.id === currentId)
      const prev = manuscript.chapters[Math.max(0, idx - 1)]
      if (!prev) return
      this.jumpToBlock(prev.startBlockIndex)
    },

    skipForward(seconds) {
      const chunk = currentChunk()
      if (!chunk) return
      let remaining = seconds
      const used = liveElapsed()
      remaining -= Math.max(0, estimateSeconds(chunk.text.slice(charOffset || 0), options.rate) - used)
      let idx = cursor
      while (remaining > 0 && idx < chunks.length - 1) {
        idx += 1
        remaining -= estimateSeconds(chunks[idx].text, options.rate)
      }
      if (status === 'playing') playFrom(idx, 0)
      else {
        cancelSpoken()
        cursor = idx
        charOffset = 0
        pausedElapsed = 0
        persist()
        emit()
      }
    },

    skipBack(seconds) {
      const used = liveElapsed()
      if (used >= seconds && currentChunk()) {
        const newElapsed = used - seconds
        const offset = estimateCharOffset(currentChunk()!.text, newElapsed, options.rate)
        if (status === 'playing') playFrom(cursor, offset)
        else {
          charOffset = offset
          persist()
          emit()
        }
        return
      }
      let need = seconds - used
      let idx = cursor
      while (need > 0 && idx > 0) {
        idx -= 1
        need -= estimateSeconds(chunks[idx].text, options.rate)
      }
      if (status === 'playing') playFrom(idx, 0)
      else {
        cancelSpoken()
        cursor = idx
        charOffset = 0
        pausedElapsed = 0
        persist()
        emit()
      }
    },

    jumpToBlock(blockIndex) {
      const idx = findChunkIndex(chunks, blockIndex, 0)
      const target = idx >= 0 ? idx : 0
      if (status === 'playing') playFrom(target, 0)
      else {
        cancelSpoken()
        cursor = target
        charOffset = 0
        pausedElapsed = 0
        persist()
        emit()
      }
    },

    retryFailed() {
      if (lastError == null && status !== 'paused') return
      playFrom(cursor, charOffset)
    },

    continueAfterError() {
      lastError = null
      if (cursor < chunks.length - 1) {
        playFrom(cursor + 1, 0)
      } else {
        status = 'idle'
        emit()
      }
    },

    setOptions(partial) {
      options = { ...options, ...partial }
      if (status === 'playing') {
        captureOffset()
        playFrom(cursor, charOffset)
      }
    },

    getSnapshot: snapshot,

    destroy() {
      destroyed = true
      cancelSpoken()
    },
  }
}
