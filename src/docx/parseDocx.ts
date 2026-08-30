import JSZip from 'jszip'
import type { Manuscript } from '../types'
import { documentFingerprint } from './fingerprint'
import { isJunkParagraph, looksLikeRunningHeader, normalizeParagraph } from './normalize'
import { buildStructure, type DetectedBlock } from './structure'

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0]

export class DocxParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DocxParseError'
  }
}

function attr(el: Element, local: string): string | null {
  return (
    el.getAttributeNS(W_NS, local) ??
    el.getAttribute(`w:${local}`) ??
    el.getAttribute(local)
  )
}

function *elementsByLocal(root: Element | Document, local: string): Generator<Element> {
  const all = root.getElementsByTagName('*')
  for (let i = 0; i < all.length; i++) {
    const node = all[i]
    if (node.localName === local) yield node
  }
}

function firstChildByLocal(el: Element, local: string): Element | undefined {
  for (const child of Array.from(el.children)) {
    if (child.localName === local) return child
  }
  return undefined
}

function parseXml(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const err = doc.querySelector('parsererror')
  if (err) throw new DocxParseError('Die Word-Datei ist beschädigt oder kein gültiges DOCX.')
  return doc
}

interface StyleInfo {
  id: string
  name: string
  outlineLevel: number | null
  basedOn: string | null
}

function parseStyles(xml: string | undefined): Map<string, StyleInfo> {
  const map = new Map<string, StyleInfo>()
  if (!xml) return map
  const doc = parseXml(xml)
  for (const style of elementsByLocal(doc, 'style')) {
    if (attr(style, 'type') && attr(style, 'type') !== 'paragraph') continue
    const id = attr(style, 'styleId')
    if (!id) continue
    const nameEl = firstChildByLocal(style, 'name')
    const name = nameEl ? (attr(nameEl, 'val') ?? '') : ''
    const basedOnEl = firstChildByLocal(style, 'basedOn')
    const basedOn = basedOnEl ? attr(basedOnEl, 'val') : null
    let outlineLevel: number | null = null
    for (const lvl of elementsByLocal(style, 'outlineLvl')) {
      const v = attr(lvl, 'val')
      if (v != null && v !== '') {
        outlineLevel = Number(v)
        break
      }
    }
    map.set(id, { id, name, outlineLevel, basedOn })
  }
  return map
}

function headingLevelFromName(name: string): number | null {
  const heading = name.match(/^(heading|überschrift|ueberschrift)\s*(\d)$/i)
  if (heading) return Number(heading[2])
  if (/^title$/i.test(name) || /^titel$/i.test(name)) return 1
  return null
}

function resolveHeadingLevel(
  styleId: string | null,
  paragraphOutline: number | null,
  styles: Map<string, StyleInfo>,
): number | null {
  if (paragraphOutline != null && !Number.isNaN(paragraphOutline)) {
    return paragraphOutline + 1
  }
  if (!styleId) return null
  let current = styles.get(styleId)
  const seen = new Set<string>()
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    if (current.outlineLevel != null) return current.outlineLevel + 1
    const fromName = headingLevelFromName(current.name)
    if (fromName != null) return fromName
    current = current.basedOn ? styles.get(current.basedOn) : undefined
  }
  return headingLevelFromName(styleId)
}

const SKIP_SUBTREES = new Set([
  'del',
  'instrText',
  'fldChar',
  'drawing',
  'pict',
  'object',
  'footnoteReference',
  'endnoteReference',
  'commentReference',
])

function paragraphText(p: Element): string {
  const parts: string[] = []
  const walk = (node: Node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as Element
    const local = el.localName
    if (SKIP_SUBTREES.has(local)) return
    if (local === 't') {
      parts.push(el.textContent ?? '')
      return
    }
    if (local === 'tab') {
      parts.push(' ')
      return
    }
    if (local === 'br' || local === 'cr') {
      parts.push('\n')
      return
    }
    if (local === 'softHyphen' || local === 'noBreakHyphen') {
      parts.push(local === 'noBreakHyphen' ? '-' : '\u00ad')
      return
    }
    for (const child of Array.from(el.childNodes)) walk(child)
  }
  walk(p)
  return parts.join('')
}

function paragraphMeta(p: Element): { styleId: string | null; outline: number | null } {
  const pPr = firstChildByLocal(p, 'pPr')
  if (!pPr) return { styleId: null, outline: null }
  const style = firstChildByLocal(pPr, 'pStyle')
  const styleId = style ? attr(style, 'val') : null
  const outlineEl = firstChildByLocal(pPr, 'outlineLvl')
  const outline = outlineEl ? Number(attr(outlineEl, 'val')) : null
  return { styleId, outline: outline != null && !Number.isNaN(outline) ? outline : null }
}

function collectParagraphs(body: Element): Element[] {
  const out: Element[] = []
  const walk = (el: Element) => {
    if (el.localName === 'sectPr' || el.localName === 'drawing' || el.localName === 'pict') return
    if (el.localName === 'p') {
      out.push(el)
      return
    }
    for (const child of Array.from(el.children)) walk(child)
  }
  walk(body)
  return out
}

function extractBlocks(documentXml: string, styles: Map<string, StyleInfo>, fileName: string): DetectedBlock[] {
  const doc = parseXml(documentXml)
  const body = [...elementsByLocal(doc, 'body')][0]
  if (!body) throw new DocxParseError('In der Datei fehlt der Dokumentinhalt.')

  const blocks: DetectedBlock[] = []
  let headerHits = 0

  for (const p of collectParagraphs(body)) {
    const raw = paragraphText(p)
    const text = normalizeParagraph(raw)
    if (isJunkParagraph(text)) continue
    if (looksLikeRunningHeader(text, fileName) && blocks.length > 0) {
      headerHits += 1
      if (headerHits <= 2) continue
    }
    const meta = paragraphMeta(p)
    const level = resolveHeadingLevel(meta.styleId, meta.outline, styles)
    if (level != null && level >= 1 && level <= 6) {
      blocks.push({ kind: 'heading', level, text, headingFromStyle: true })
    } else {
      blocks.push({ kind: 'paragraph', text, headingFromStyle: false })
    }
  }

  return blocks
}

function isOldWordBinary(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer.slice(0, 4))
  return OLE_MAGIC.every((b, i) => bytes[i] === b)
}

export async function parseDocx(file: Blob, meta: { name: string; size: number }): Promise<Manuscript> {
  const buffer = await file.arrayBuffer()
  if (isOldWordBinary(buffer)) {
    throw new DocxParseError('Alte .doc-Dateien werden nicht unterstützt. Bitte in Word als .docx speichern.')
  }

  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(buffer)
  } catch {
    throw new DocxParseError('Das ist keine gültige .docx-Datei.')
  }

  const documentFile = zip.file('word/document.xml')
  if (!documentFile) {
    throw new DocxParseError('Die Datei enthält kein Word-Dokument (word/document.xml fehlt).')
  }

  const [documentXml, stylesXml] = await Promise.all([
    documentFile.async('string'),
    zip.file('word/styles.xml')?.async('string'),
  ])

  const styles = parseStyles(stylesXml)
  const detected = extractBlocks(documentXml, styles, meta.name)
  if (detected.length === 0) {
    throw new DocxParseError('In diesem Manuskript wurde kein lesbarer Text gefunden.')
  }

  const fallbackTitle = meta.name.replace(/\.docx$/i, '') || 'Manuskript'
  const structure = buildStructure(detected, fallbackTitle)
  const fingerprint = await documentFingerprint(meta.name, meta.size, buffer)

  return {
    fingerprint,
    fileName: meta.name,
    fileSize: meta.size,
    importedAt: Date.now(),
    language: 'de',
    title: structure.title,
    chapters: structure.chapters,
    blocks: structure.blocks,
  }
}

export function isDocxFile(file: File): boolean {
  const name = file.name.toLowerCase()
  if (name.endsWith('.docx')) return true
  if (name.endsWith('.doc')) return false
  return (
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )
}
