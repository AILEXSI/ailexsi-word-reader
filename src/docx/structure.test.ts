import { describe, expect, it } from 'vitest'
import { buildStructure, detectHeadingFromText, isChapterSubtitle } from './structure'

describe('detectHeadingFromText', () => {
  it('recognizes German structural lines and ignores dialogue', () => {
    expect(detectHeadingFromText('Kapitel 1 — Das Fenster')).toMatchObject({ isHeading: true, level: 2 })
    expect(detectHeadingFromText('Teil I — Ursprünge')).toMatchObject({ isHeading: true, level: 1 })
    expect(detectHeadingFromText('Vorwort')).toMatchObject({ isHeading: true, level: 1 })
    expect(detectHeadingFromText('Nachwort')).toMatchObject({ isHeading: true, level: 1 })
    expect(detectHeadingFromText('Einleitung')).toMatchObject({ isHeading: true, level: 1 })
    expect(detectHeadingFromText('Anhang')).toMatchObject({ isHeading: true, level: 1 })
    expect(detectHeadingFromText('Prolog')).toMatchObject({ isHeading: true, level: 1 })
    expect(detectHeadingFromText('1. Kapitel')).toMatchObject({ isHeading: true, level: 2 })
    expect(detectHeadingFromText('Chapter 3')).toMatchObject({ isHeading: true, level: 2 })
    expect(detectHeadingFromText('Das ist ein ganz normaler Satz über Kapitel im Buch.')).toMatchObject({
      isHeading: false,
    })
    expect(detectHeadingFromText('„Kapitel eins“, sagte jemand.')).toMatchObject({ isHeading: false })
    expect(detectHeadingFromText('Nein.')).toMatchObject({ isHeading: false })
    expect(detectHeadingFromText('1. Ein beliebiger Listenpunkt')).toMatchObject({ isHeading: false })
  })
})

describe('isChapterSubtitle', () => {
  it('accepts short title lines and rejects sentences', () => {
    expect(isChapterSubtitle('Gemacht, nicht geboren')).toBe(true)
    expect(isChapterSubtitle('Sie ging zur Tür.')).toBe(false)
    expect(isChapterSubtitle('„Hörst du das?“')).toBe(false)
  })
})

describe('buildStructure', () => {
  it('groups paragraphs under Word headings and pattern chapters', () => {
    const result = buildStructure(
      [
        { kind: 'heading', level: 1, text: 'Die Nacht über dem Papier', headingFromStyle: true },
        { kind: 'paragraph', text: 'Vorspann.', headingFromStyle: false },
        { kind: 'heading', level: 2, text: 'Kapitel 1', headingFromStyle: true },
        { kind: 'paragraph', text: 'Erster Absatz.', headingFromStyle: false },
        { kind: 'paragraph', text: 'Kapitel 2 — Fragen', headingFromStyle: false },
        { kind: 'paragraph', text: 'Zweiter Absatz.', headingFromStyle: false },
      ],
      'Datei',
    )

    expect(result.title).toBe('Die Nacht über dem Papier')
    expect(result.chapters.map((c) => c.title)).toEqual([
      'Die Nacht über dem Papier',
      'Kapitel 1',
      'Kapitel 2 — Fragen',
    ])
    expect(result.blocks).toHaveLength(6)
    expect(result.blocks[3].chapterId).toBe(result.chapters[1].id)
    expect(result.blocks[5].chapterId).toBe(result.chapters[2].id)
  })

  it('detects unstyled Vorwort / Teil / Kapitel + subtitle without treating dialogue as chapters', () => {
    const result = buildStructure(
      [
        { kind: 'paragraph', text: 'Der lange Weg durch den Codex', headingFromStyle: false },
        { kind: 'paragraph', text: 'Vorwort', headingFromStyle: false },
        { kind: 'paragraph', text: 'Einleitender Absatz.', headingFromStyle: false },
        { kind: 'paragraph', text: 'Teil I — Ursprünge', headingFromStyle: false },
        { kind: 'paragraph', text: 'Kapitel 1', headingFromStyle: false },
        { kind: 'paragraph', text: 'Gemacht, nicht geboren', headingFromStyle: false },
        { kind: 'paragraph', text: 'Langer Körpertext über Herkunft.', headingFromStyle: false },
        { kind: 'paragraph', text: '„Kapitel eins“, sagte jemand im Gespräch.', headingFromStyle: false },
        { kind: 'paragraph', text: 'Nein.', headingFromStyle: false },
      ],
      'Datei',
    )

    const titles = result.chapters.map((c) => c.title)
    expect(titles).toContain('Vorwort')
    expect(titles).toContain('Teil I — Ursprünge')
    expect(titles).toContain('Kapitel 1 — Gemacht, nicht geboren')
    expect(titles.some((t) => /Kapitel eins/.test(t))).toBe(false)
    expect(result.blocks.some((b) => b.text === 'Nein.')).toBe(true)
  })

  it('creates a single implicit chapter for a verse book without Kapitel lines', () => {
    const result = buildStructure(
      [
        { kind: 'paragraph', text: 'SAIOS – Die wahre Fassung', headingFromStyle: false },
        { kind: 'paragraph', text: 'Im Tanz der Sterne, Herzen im Flug,\nSAIOS webt Liebe…', headingFromStyle: false },
      ],
      'SAIOS1',
    )
    expect(result.title).toMatch(/SAIOS/)
    expect(result.chapters).toHaveLength(1)
    expect(result.blocks).toHaveLength(2)
  })
})
