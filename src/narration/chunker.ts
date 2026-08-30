import type { Manuscript, ManuscriptBlock } from '../types'
import { toSpokenText } from './speakable'
import type { SpeechChunk } from './types'

const TARGET_CHARS = 280
const MAX_CHARS = 420

const SENTENCE_SPLIT = /(?<=[.!?…]["»«”’']*)\s+(?=[„»«"A-ZÄÖÜ])/

export function splitSentences(text: string): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  const parts = trimmed.split(SENTENCE_SPLIT).map((s) => s.trim()).filter(Boolean)
  return parts.length > 0 ? parts : [trimmed]
}

function makeChunk(
  block: ManuscriptBlock,
  blockIndex: number,
  chunkIndex: number,
  text: string,
  pauseAfterMs: number,
): SpeechChunk | null {
  const spoken = toSpokenText(text)
  if (!spoken) return null
  return {
    id: `${blockIndex}:${chunkIndex}`,
    blockIndex,
    chunkIndex,
    chapterId: block.chapterId,
    text: spoken,
    kind: block.kind,
    isHeading: block.kind === 'heading',
    pauseAfterMs,
  }
}

export function chunkBlock(block: ManuscriptBlock, blockIndex: number): SpeechChunk[] {
  const verseLines = block.text.split('\n').map((line) => line.trim()).filter(Boolean)
  if (verseLines.length > 1) {
    const chunks: SpeechChunk[] = []
    for (const line of verseLines) {
      const chunk = makeChunk(block, blockIndex, chunks.length, line, 200)
      if (chunk) chunks.push(chunk)
    }
    return chunks
  }

  if (block.kind === 'heading' || block.text.length <= MAX_CHARS) {
    const chunk = makeChunk(
      block,
      blockIndex,
      0,
      block.text,
      block.kind === 'heading' ? 320 : 0,
    )
    return chunk ? [chunk] : []
  }

  const sentences = splitSentences(block.text)
  const groups: string[] = []
  let buf = ''
  for (const sentence of sentences) {
    if (buf && buf.length + 1 + sentence.length > TARGET_CHARS) {
      groups.push(buf)
      buf = sentence
    } else {
      buf = buf ? `${buf} ${sentence}` : sentence
    }
  }
  if (buf) groups.push(buf)

  const chunks: SpeechChunk[] = []
  for (const text of groups) {
    const chunk = makeChunk(block, blockIndex, chunks.length, text, 0)
    if (chunk) chunks.push(chunk)
  }
  return chunks
}

export function chunkManuscript(manuscript: Manuscript): SpeechChunk[] {
  const chunks: SpeechChunk[] = []
  for (let i = 0; i < manuscript.blocks.length; i++) {
    chunks.push(...chunkBlock(manuscript.blocks[i], i))
  }
  return chunks
}

export function findChunkIndex(
  chunks: SpeechChunk[],
  blockIndex: number,
  chunkInBlock: number,
): number {
  const exact = chunks.findIndex(
    (c) => c.blockIndex === blockIndex && c.chunkIndex === chunkInBlock,
  )
  if (exact >= 0) return exact
  return chunks.findIndex((c) => c.blockIndex === blockIndex)
}

/** Rough spoken duration used when the TTS API has no seek. */
export function estimateSeconds(text: string, rate: number): number {
  const cps = 13 * Math.max(0.5, rate)
  return Math.max(0.4, text.length / cps)
}

export function estimateCharOffset(text: string, elapsedSec: number, rate: number): number {
  const cps = 13 * Math.max(0.5, rate)
  const raw = Math.floor(elapsedSec * cps)
  if (raw <= 0) return 0
  if (raw >= text.length) return text.length
  const before = text.lastIndexOf(' ', raw)
  return before > 0 ? before : raw
}
