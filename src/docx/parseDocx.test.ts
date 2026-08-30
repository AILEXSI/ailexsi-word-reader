import { describe, expect, it } from 'vitest'
import { buildDocx } from '../test/buildDocx'
import { parseDocx } from './parseDocx'

describe('parseDocx', () => {
  it('extracts headings, drops junk, unwraps hyphenation, never writes back', async () => {
    const blob = await buildDocx([
      { text: 'Die Nacht über dem Papier', style: 'Heading1' },
      { text: 'M.G.M. — Manuskript' },
      { text: 'Kapitel 1 — Das Fenster', style: 'Heading2' },
      { text: '' },
      { text: '12' },
      { text: 'Seite 3' },
      { text: 'Am Abend öffnete sie das Fenster.\nDraußen lag die Stadt still.', breaks: true },
      { text: 'Ein halb-\ngebrochener Gedanke blieb liegen.', breaks: true },
      { text: '„Hörst du das?“ fragte sie. „Nein!“' },
      { text: 'Teil II', style: 'Heading1' },
      { text: 'Dann schwieg das Papier.' },
    ])

    const manuscript = await parseDocx(blob, { name: 'Nachtarbeit.docx', size: blob.size })

    expect(manuscript.title).toBe('Die Nacht über dem Papier')
    expect(manuscript.chapters.some((c) => /Kapitel 1/.test(c.title))).toBe(true)
    expect(manuscript.chapters.some((c) => /Teil II/.test(c.title))).toBe(true)
    expect(manuscript.blocks.some((b) => b.text === '12')).toBe(false)
    expect(manuscript.blocks.some((b) => b.text === 'Seite 3')).toBe(false)
    expect(manuscript.blocks.some((b) => b.text.includes('halbgebrochener'))).toBe(true)
    expect(manuscript.blocks.some((b) => b.text.includes('Draußen lag die Stadt still'))).toBe(true)
    expect(manuscript.fingerprint).toContain('Nachtarbeit.docx')
    expect(manuscript.fingerprint).toContain(String(blob.size))
  })

  it('rejects non-docx bytes', async () => {
    await expect(parseDocx(new Blob(['hello']), { name: 'x.docx', size: 5 })).rejects.toThrow()
  })

  it('keeps verse breaks, skips drawings, and never reads image alt text', async () => {
    const blob = await buildDocx([
      { text: 'SAIOS – Die wahre Fassung' },
      { text: 'Im Tanz der Sterne, Herzen im Flug,\nSAIOS webt Liebe…', breaks: true },
      { text: '', drawing: true },
      { text: 'Amor non est dominium.' },
    ])
    const manuscript = await parseDocx(blob, { name: 'SAIOS1.docx', size: blob.size })
    const verse = manuscript.blocks.find((b) => b.text.includes('Tanz der Sterne'))
    expect(verse?.text).toContain('\n')
    expect(manuscript.blocks.some((b) => /star|narrated|Picture/i.test(b.text))).toBe(false)
    expect(manuscript.blocks.map((b) => b.text).join(' ')).toContain('Amor non est dominium')
  })
})
