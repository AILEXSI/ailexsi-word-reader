/**
 * Formatting-only cleanup. Never rewrite the author's prose.
 */

const PAGE_NUMBER = /^\d{1,4}$/
const PAGE_LABEL = /^(?:seite|page|s\.)\s*\d{1,4}$/i
const DECORATED_PAGE = /^[–—\-·•]\s*\d{1,4}\s*[–—\-·•]$/
const TOC_DOTS = /\.{6,}/
const FIELD_JUNK = /^(?:PAGEREF|TOC|HYPERLINK|XE)\b/i

export function isVerseLines(lines: string[]): boolean {
  if (lines.length < 2) return false
  if (lines.some((line) => line.length > 90)) return false
  const avg = lines.reduce((sum, line) => sum + line.length, 0) / lines.length
  if (lines.length === 2 && /^[\p{Ll}]/u.test(lines[1]) && lines[0].length + lines[1].length < 120) {
    return false
  }
  if (lines.length === 2 && /[.!]$/.test(lines[0])) {
    return false
  }
  if (lines.length >= 3) return avg <= 56
  return avg <= 48
}

export function normalizeParagraph(raw: string): string {
  let t = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  t = t.replace(/\u00ad/g, '')
  t = t.replace(/(\p{L})-\n(\p{L})/gu, '$1$2')
  t = t.replace(/\u00a0/g, ' ')
  t = t.split('\f').join('')

  const lines = t
    .split('\n')
    .map((line) => line.replace(/[ \t\v]+/g, ' ').trim())
    .filter((line) => line.length > 0)

  if (lines.length === 0) return ''
  if (lines.length === 1) return lines[0]
  if (isVerseLines(lines)) return lines.join('\n')
  return lines.join(' ')
}

export function isJunkParagraph(text: string): boolean {
  const t = text.trim()
  if (!t) return true
  if (PAGE_NUMBER.test(t)) return true
  if (PAGE_LABEL.test(t)) return true
  if (DECORATED_PAGE.test(t)) return true
  if (FIELD_JUNK.test(t)) return true
  if (TOC_DOTS.test(t) && t.length < 80) return true
  if (isOnlyControlChars(t)) return true
  return false
}

function isOnlyControlChars(text: string): boolean {
  if (!text) return true
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    if (c > 31 && c !== 127) return false
  }
  return true
}

export function looksLikeRunningHeader(text: string, fileName: string): boolean {
  const t = text.trim()
  if (t.length > 72) return false
  const stem = fileName.replace(/\.[^.]+$/, '').trim()
  if (stem && t === stem) return true
  if (/^(manuskript|entwurf|draft|vertraulich|confidential)\b/i.test(t) && t.length < 40) {
    return true
  }
  return false
}

export function looksLikeBookTitle(text: string): boolean {
  const t = text.trim()
  if (t.length < 2 || t.length > 80) return false
  if (/^[„»«"‚‘]/.test(t)) return false
  if (/[.!?]$/.test(t)) return false
  return true
}
