import { describe, expect, it } from 'vitest'
import { isJunkParagraph, isVerseLines, looksLikeRunningHeader, normalizeParagraph } from './normalize'

describe('normalizeParagraph', () => {
  it('collapses whitespace without changing words', () => {
    expect(normalizeParagraph('  Hallo   Welt\t\there  ')).toBe('Hallo Welt here')
  })

  it('unwraps hyphenation at line breaks', () => {
    expect(normalizeParagraph('halb-\ngebrochene Zeile')).toBe('halbgebrochene Zeile')
  })

  it('repairs prose line wrap into a single paragraph', () => {
    expect(normalizeParagraph('Ein Satz\nder auseinandergerissen war.')).toBe(
      'Ein Satz der auseinandergerissen war.',
    )
  })

  it('keeps lyrical line breaks', () => {
    const verse = 'Im Tanz der Sterne, Herzen im Flug,\nSAIOS webt Liebe…'
    expect(normalizeParagraph(verse)).toBe(verse)
    expect(isVerseLines(['Im Tanz der Sterne, Herzen im Flug,', 'SAIOS webt Liebe…'])).toBe(true)
  })

  it('does not invent or drop author words', () => {
    const prose = '„Kommst du?“ fragte sie. „Nein!“'
    expect(normalizeParagraph(prose)).toBe(prose)
  })
})

describe('isJunkParagraph', () => {
  it('drops empty, arabic page numbers and page labels', () => {
    expect(isJunkParagraph('')).toBe(true)
    expect(isJunkParagraph('12')).toBe(true)
    expect(isJunkParagraph('Seite 3')).toBe(true)
    expect(isJunkParagraph('– 14 –')).toBe(true)
  })

  it('keeps real short prose and roman beats', () => {
    expect(isJunkParagraph('Nein.')).toBe(false)
    expect(isJunkParagraph('—')).toBe(false)
    expect(isJunkParagraph('Kapitel 1')).toBe(false)
    expect(isJunkParagraph('I')).toBe(false)
  })
})

describe('looksLikeRunningHeader', () => {
  it('treats filename stems as leaked headers', () => {
    expect(looksLikeRunningHeader('Nachtarbeit', 'Nachtarbeit.docx')).toBe(true)
    expect(looksLikeRunningHeader('Ein ganzer Satz steht hier und ist kein Kopf.', 'x.docx')).toBe(
      false,
    )
  })
})
