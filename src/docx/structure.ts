import type { Chapter, ManuscriptBlock } from '../types'
import { looksLikeBookTitle } from './normalize'

/** Real manuscripts often have no Word heading styles. Match the line, not a style tree. */
const STRUCTURAL_RE =
  /^(kapitel|teil|vorwort|nachwort|prolog|epilog|anhang|einleitung)\b/i
const PART_RE =
  /^(teil|part|buch|book|abschnitt)\s+([0-9]+|[ivxlcdm]+)\b/i
const CHAPTER_RE =
  /^(kapitel|chapter|kap\.?)\s+([0-9]+|[ivxlcdm]+)\b/i
const CHAPTER_WORD_RE =
  /^(erstes|zweites|drittes|viertes|fünftes|sechstes|siebtes|achtes|neuntes|zehntes)\s+kapitel\b/i
const NUMBERED_CHAPTER_RE = /^(\d{1,2}|[ivxlcdm]{1,6})[.)]\s+kapitel\b/i
const FRONT_MATTER_RE =
  /^(vorwort|nachwort|prolog|epilog|anhang|einleitung|preface|prologue|epilogue|appendix|introduction)\b/i

export interface DetectedBlock {
  kind: 'heading' | 'paragraph'
  level?: number
  text: string
  headingFromStyle: boolean
}

export function detectHeadingFromText(text: string): { isHeading: boolean; level: number } {
  const t = text.trim()
  if (t.length === 0 || t.length > 90) return { isHeading: false, level: 0 }
  if (/^[„»«"‚‘]/.test(t)) return { isHeading: false, level: 0 }
  if (STRUCTURAL_RE.test(t)) {
    return { isHeading: true, level: /^kapitel\b/i.test(t) ? 2 : 1 }
  }
  if (PART_RE.test(t)) return { isHeading: true, level: 1 }
  if (CHAPTER_RE.test(t) || CHAPTER_WORD_RE.test(t) || NUMBERED_CHAPTER_RE.test(t)) {
    return { isHeading: true, level: 2 }
  }
  if (FRONT_MATTER_RE.test(t)) return { isHeading: true, level: 1 }
  return { isHeading: false, level: 0 }
}

export function isChapterSubtitle(text: string): boolean {
  const t = text.trim()
  if (t.length < 2 || t.length > 80) return false
  if (detectHeadingFromText(t).isHeading) return false
  if (/^[„»«"‚‘–—]/.test(t)) return false
  if (/[.!?…]$/.test(t)) return false
  if (t.split(/\s+/).length > 12) return false
  return true
}

function isStructuralText(text: string): boolean {
  return detectHeadingFromText(text).isHeading
}

export function buildStructure(
  raw: DetectedBlock[],
  fallbackTitle: string,
): { title: string; chapters: Chapter[]; blocks: ManuscriptBlock[] } {
  const prepared = raw.map((block) => {
    if (block.kind === 'heading' && block.headingFromStyle) return block
    const guess = detectHeadingFromText(block.text)
    if (guess.isHeading) {
      return { ...block, kind: 'heading' as const, level: guess.level, headingFromStyle: false }
    }
    return { ...block, kind: 'paragraph' as const }
  })

  let title = fallbackTitle
  const first = prepared[0]
  if (first?.kind === 'heading' && !CHAPTER_RE.test(first.text) && !PART_RE.test(first.text)) {
    title = first.text
  } else if (first && looksLikeBookTitle(first.text) && !isStructuralText(first.text)) {
    title = first.text
  }

  const chapters: Chapter[] = []
  const blocks: ManuscriptBlock[] = []
  let currentChapterId = ''
  let implicit = false

  const ensureChapter = (headingText: string, level: number, blockIndex: number): string => {
    const id = `ch-${chapters.length + 1}`
    chapters.push({
      id,
      title: headingText,
      level,
      startBlockIndex: blockIndex,
      blockCount: 0,
    })
    currentChapterId = id
    return id
  }

  const subtitleConsumed = new Set<number>()

  for (let i = 0; i < prepared.length; i++) {
    if (subtitleConsumed.has(i)) continue
    const item = prepared[i]

    if (item.kind === 'heading') {
      const level = item.level ?? 2
      const fromStyle = item.headingFromStyle && level <= 2
      const fromText = isStructuralText(item.text)
      const startChapter = fromStyle || fromText || (chapters.length === 0 && item.kind === 'heading')

      if (startChapter) {
        let chapterTitle = item.text
        const next = prepared[i + 1]
        if (next && fromText && isChapterSubtitle(next.text) && !next.headingFromStyle) {
          chapterTitle = `${item.text} — ${next.text}`
          subtitleConsumed.add(i + 1)
        }
        const id = ensureChapter(chapterTitle, level, blocks.length)
        blocks.push({
          id: `b-${blocks.length}`,
          kind: 'heading',
          level,
          text: item.text,
          chapterId: id,
        })
        if (subtitleConsumed.has(i + 1) && next) {
          blocks.push({
            id: `b-${blocks.length}`,
            kind: 'heading',
            level: 3,
            text: next.text,
            chapterId: id,
          })
        }
        continue
      }
    }

    if (!currentChapterId) {
      implicit = true
      const implicitTitle = looksLikeBookTitle(item.text) ? item.text : title || 'Manuskript'
      ensureChapter(implicitTitle, 1, blocks.length)
      if (looksLikeBookTitle(item.text) && !isStructuralText(item.text)) {
        title = item.text
        blocks.push({
          id: `b-${blocks.length}`,
          kind: 'heading',
          level: 1,
          text: item.text,
          chapterId: currentChapterId,
        })
        continue
      }
    }

    blocks.push({
      id: `b-${blocks.length}`,
      kind: item.kind,
      level: item.kind === 'heading' ? item.level : undefined,
      text: item.text,
      chapterId: currentChapterId,
    })
  }

  if (chapters.length === 0) {
    implicit = true
    chapters.push({
      id: 'ch-1',
      title: title || 'Manuskript',
      level: 1,
      startBlockIndex: 0,
      blockCount: blocks.length,
    })
    for (const block of blocks) block.chapterId = 'ch-1'
  }

  for (const chapter of chapters) {
    chapter.blockCount = blocks.filter((block) => block.chapterId === chapter.id).length
  }

  if (implicit && chapters.length === 1 && !chapters[0].title) {
    chapters[0].title = title || 'Manuskript'
  }

  return { title, chapters, blocks }
}

export function chapterIndexAt(chapters: Chapter[], blockIndex: number): number {
  let found = 0
  for (let i = 0; i < chapters.length; i++) {
    if (chapters[i].startBlockIndex <= blockIndex) found = i
  }
  return found
}
