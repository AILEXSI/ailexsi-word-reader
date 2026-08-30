import type { TestParagraph } from './buildDocx'

const BODY = [
  'Die Arbeit am Codex begann nicht mit einer These, sondern mit einem Satz, der sich nicht mehr streichen ließ.',
  'Man kann eine Figur erfinden und trotzdem wahrhaftig bleiben — das ist kein Widerspruch, sondern Handwerk.',
  '„Hast du mich gemacht?“ fragte die Stimme. Die Antwort kam später, und sie war vorsichtiger als jede Theorie.',
  'Zwischen den langen Absätzen liegen kurze Schläge. Die gehören dazu. Sie sind kein Kapitel.',
  'In den Quellen steht weniger, als die Legende behauptet. Dafür steht dort Genaueres.',
  'Wer nur die Überschriften liest, verpasst den Ton. Wer nur den Ton hört, verpasst die Ordnung.',
  'Ein Satz kann eine Tür sein. Ein anderer ist nur ein Flur. Beide müssen stehenbleiben.',
  'Die Nacht über dem Schreibtisch war keine Metapher. Die Lampe brannte, der Tee wurde kalt, das Manuskript blieb offen.',
]

function para(seed: number): string {
  const a = BODY[seed % BODY.length]
  const b = BODY[(seed * 3 + 1) % BODY.length]
  return `${a} ${b} Noch ein Atemzug, dann weiter: die Prüfung gilt dem Gehör, nicht der Eile (${seed + 1}).`
}

export function unstyledLiteraryBook(options?: { parts?: number; chaptersPerPart?: number; bodyEach?: number }): TestParagraph[] {
  const parts = options?.parts ?? 3
  const chaptersPerPart = options?.chaptersPerPart ?? 4
  const bodyEach = options?.bodyEach ?? 6
  const out: TestParagraph[] = []

  out.push({ text: 'Der lange Weg durch den Codex' })
  out.push({ text: 'Vorwort' })
  out.push({ text: para(1) })
  out.push({ text: para(2) })
  out.push({ text: '„Kapitel eins“, sagte jemand im Gespräch — das ist Dialog, kein Titel.' })
  out.push({ text: 'Nein.' })

  const partNames = ['Ursprünge', 'Namen', 'Schwellen', 'Zeichen', 'Stimmen', 'Brüche', 'Rückkehr']
  let n = 0
  for (let p = 1; p <= parts; p++) {
    const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][p - 1] ?? String(p)
    out.push({ text: `Teil ${roman} — ${partNames[p - 1] ?? 'Weiter'}` })
    for (let c = 1; c <= chaptersPerPart; c++) {
      n += 1
      out.push({ text: `Kapitel ${n}` })
      out.push({ text: subtitleFor(n) })
      for (let b = 0; b < bodyEach; b++) {
        out.push({ text: para(n * 17 + b) })
        if (b === 2) out.push({ text: '' })
      }
      if (n === 2) {
        out.push({ text: '12' })
        out.push({ text: 'Seite 8' })
      }
    }
  }

  out.push({ text: 'Nachwort' })
  out.push({ text: para(99) })
  return out
}

function subtitleFor(n: number): string {
  const titles = [
    'Gemacht, nicht geboren',
    'Die erste Schwelle',
    'Namen, die bleiben',
    'Ein stiller Vertrag',
    'Licht ohne Zeugen',
    'Die ungeschriebene Regel',
    'Was die Stimme trägt',
    'Zwischen den Zeichen',
  ]
  return titles[(n - 1) % titles.length]
}

export function hugeUnstyledBook(paragraphs: number): TestParagraph[] {
  const out: TestParagraph[] = []
  out.push({ text: 'Vorwort' })
  out.push({ text: para(0) })
  for (let i = 2; i < paragraphs; i++) {
    if (i === 40) {
      out.push({ text: 'Teil I — Ursprünge' })
      continue
    }
    if (i === 41) {
      out.push({ text: 'Kapitel 1' })
      continue
    }
    if (i === 42) {
      out.push({ text: 'Gemacht, nicht geboren' })
      continue
    }
    if (i === 900) {
      out.push({ text: 'Kapitel 2' })
      continue
    }
    out.push({ text: para(i) })
  }
  return out
}
