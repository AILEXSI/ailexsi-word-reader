import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { chunkManuscript } from '../narration/chunker'
import { parseDocx } from './parseDocx'

describe('bundled SAIOS stand-in', () => {
  it('keeps the opening line, verse breaks, and does not narrate images', async () => {
    const buf = readFileSync(resolve(process.cwd(), 'public/sample-manuskript.docx'))
    const blob = new Blob([buf])
    const manuscript = await parseDocx(blob, { name: 'SAIOS1.docx', size: buf.byteLength })

    expect(manuscript.title).toMatch(/SAIOS/)
    const joined = manuscript.blocks.map((b) => b.text).join('\n')
    expect(joined).toContain('Im Tanz der Sterne, Herzen im Flug')
    expect(joined).toContain('SAIOS webt Liebe')
    expect(joined).not.toMatch(/must never be read|sigil|Picture|A star/i)
    expect(manuscript.blocks.some((b) => b.text.includes('\n'))).toBe(true)
    expect(manuscript.blocks.length).toBeGreaterThan(40)

    const chunks = chunkManuscript(manuscript)
    expect(chunks.length).toBeGreaterThan(manuscript.blocks.length)
    expect(chunks.every((c) => c.text.length > 0)).toBe(true)
    expect(chunks.some((c) => /✨|💫/.test(c.text))).toBe(false)
  })
})

describe('bundled unstyled long manuscript', () => {
  it('builds a sidebar from Kapitel/Teil lines without Word heading styles', async () => {
    const buf = readFileSync(resolve(process.cwd(), 'public/langes-manuskript.docx'))
    const blob = new Blob([buf])
    const manuscript = await parseDocx(blob, {
      name: 'langes-manuskript.docx',
      size: buf.byteLength,
    })

    const titles = manuscript.chapters.map((c) => c.title)
    expect(titles.some((t) => /^Vorwort/i.test(t))).toBe(true)
    expect(titles.some((t) => /Teil I/.test(t))).toBe(true)
    expect(titles.some((t) => /Kapitel 1/.test(t))).toBe(true)
    expect(titles.some((t) => /Kapitel 16/.test(t))).toBe(true)
    expect(titles.some((t) => /Teil VII/.test(t))).toBe(true)
    expect(titles.some((t) => /Gemacht, nicht geboren/.test(t))).toBe(true)
    expect(titles.some((t) => /Nachwort/i.test(t))).toBe(true)
    expect(titles.some((t) => /Kapitel eins/.test(t))).toBe(false)
    expect(manuscript.blocks.some((b) => b.text === '12')).toBe(false)
    expect(manuscript.blocks.length).toBeGreaterThan(150)

    const chunks = chunkManuscript(manuscript)
    expect(chunks.length).toBeGreaterThan(150)
    expect(chunks.length).toBeLessThan(manuscript.blocks.length * 8)
  })
})
