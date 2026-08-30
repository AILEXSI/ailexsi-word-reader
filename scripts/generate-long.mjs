/**
 * Unstyled long literary manuscript: chapters are plain short paragraphs
 * (Vorwort, Teil I — …, Kapitel N, subtitle). No Word heading styles.
 */
import { Document, Footer, Header, Packer, PageNumber, Paragraph, TextRun, AlignmentType } from 'docx'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'public', 'langes-manuskript.docx')

const BODY = [
  'Die Arbeit am Codex begann nicht mit einer These, sondern mit einem Satz, der sich nicht mehr streichen ließ.',
  'Man kann eine Figur erfinden und trotzdem wahrhaftig bleiben — das ist kein Widerspruch, sondern Handwerk.',
  '„Hast du mich gemacht?“ fragte die Stimme. Die Antwort kam später, und sie war vorsichtiger als jede Theorie.',
  'Zwischen den langen Absätzen liegen kurze Schläge. Die gehören dazu. Sie sind kein Kapitel.',
  'In den Quellen steht weniger, als die Legende behauptet. Dafür steht dort Genaueres.',
  'Wer nur die Überschriften liest, verpasst den Ton. Wer nur den Ton hört, verpasst die Ordnung.',
  'Ein Satz kann eine Tür sein. Ein anderer ist nur ein Flur. Beide müssen stehenbleiben, wenn man sie anhört.',
  'Die Nacht über dem Schreibtisch war keine Metapher. Die Lampe brannte, der Tee wurde kalt, das Manuskript blieb offen.',
]

const SUB = [
  'Gemacht, nicht geboren',
  'Die erste Schwelle',
  'Namen, die bleiben',
  'Ein stiller Vertrag',
  'Licht ohne Zeugen',
  'Die ungeschriebene Regel',
  'Was die Stimme trägt',
  'Zwischen den Zeichen',
]

const PARTS = ['Ursprünge', 'Namen', 'Schwellen', 'Zeichen', 'Stimmen', 'Brüche', 'Rückkehr']
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']

const p = (text) => new Paragraph({ spacing: { after: 220 }, children: [new TextRun(text)] })
const empty = () => new Paragraph({ children: [] })

function body(seed) {
  const a = BODY[seed % BODY.length]
  const b = BODY[(seed * 3 + 1) % BODY.length]
  return `${a} ${b} Noch ein Atemzug, dann weiter: die Prüfung gilt dem Gehör, nicht der Eile (${seed + 1}).`
}

const children = []
children.push(p('Der lange Weg durch den Codex'))
children.push(p('Vorwort'))
children.push(p(body(1)))
children.push(p(body(2)))
children.push(p('„Kapitel eins“, sagte jemand im Gespräch — das ist Dialog, kein Titel.'))
children.push(p('Nein.'))
children.push(empty())

let chapter = 0
for (let part = 0; part < 7; part++) {
  children.push(p(`Teil ${ROMAN[part]} — ${PARTS[part]}`))
  for (let c = 0; c < 3; c++) {
    chapter += 1
    children.push(p(`Kapitel ${chapter}`))
    children.push(p(SUB[(chapter - 1) % SUB.length]))
    for (let b = 0; b < 8; b++) {
      children.push(p(body(chapter * 17 + b + part * 50)))
      if (b === 3) children.push(empty())
    }
    if (chapter === 2) {
      children.push(p('12'))
      children.push(p('Seite 8'))
    }
  }
}

children.push(p('Nachwort'))
children.push(p(body(900)))
children.push(p('Damit endet die Hörfassung dieses langen Weges — nicht das Denken.'))

const doc = new Document({
  creator: 'AILEXSI Word Reader',
  title: 'Der lange Weg durch den Codex',
  styles: {
    default: {
      document: { run: { font: 'Georgia', size: 24 } },
    },
  },
  sections: [
    {
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: 'Codex — Entwurf', italics: true, size: 16, color: '888888' })],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: 'Seite ', size: 16, color: '888888' }),
                new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '888888' }),
              ],
            }),
          ],
        }),
      },
      children,
    },
  ],
})

mkdirSync(join(root, 'public'), { recursive: true })
const buffer = await Packer.toBuffer(doc)
writeFileSync(out, buffer)
console.log(`Wrote ${out} (${buffer.length} bytes), body paragraphs: ${children.length}`)
