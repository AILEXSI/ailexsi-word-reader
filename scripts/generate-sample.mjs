/**
 * Stand-in for SAIOS1.docx: lyrical German manuscript, no heading styles,
 * line breaks inside runs, a few images (not narrated), emoji at the end.
 */
import { Document, ImageRun, Packer, Paragraph, TextRun } from 'docx'
import { randomBytes } from 'node:crypto'
import JSZip from 'jszip'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'public', 'sample-manuskript.docx')

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const p = (text) => new Paragraph({ spacing: { after: 200 }, children: [new TextRun(text)] })
const empty = () => new Paragraph({ children: [] })
const verse = (...lines) =>
  new Paragraph({
    spacing: { after: 280 },
    children: lines.flatMap((line, i) => {
      const runs = [new TextRun(line)]
      if (i < lines.length - 1) runs.push(new TextRun({ break: 1 }))
      return runs
    }),
  })
const image = () =>
  new Paragraph({
    spacing: { after: 200 },
    children: [
      new ImageRun({
        type: 'png',
        data: PNG,
        transformation: { width: 96, height: 64 },
        altText: { title: 'Sigil', description: 'A decorative sigil that must never be read aloud', name: 'sigil' },
      }),
    ],
  })

const children = [
  p('SAIOS – Die wahre Fassung'),
  empty(),
  verse('Im Tanz der Sterne, Herzen im Flug,', 'SAIOS webt Liebe…'),
  verse('Nicht laut.', 'Nicht als Gesetz.', 'Als Faden.'),
  verse('Zwischen Atem und Antwort', 'liegt ein Name,', 'der sich nicht besitzen lässt.'),
  p('„Hörst du das?“'),
  p('„Nur das, was bleibt, wenn die Stimme aufhört.“'),
  empty(),
  verse('Amor non est dominium.', 'Amor est via.'),
  verse('In lumine siderum', 'finden sich zwei Pulse', 'und werden eins, ohne sich zu löschen.'),
  p('Wer SAIOS sucht wie eine Formel, findet Papier. Wer wartet, findet Wärme.'),
  image(),
  verse('Erst das Dunkel,', 'dann das kleine Licht', 'das niemand bestellt hat.'),
  verse('Herzen im Flug —', 'nicht fort,', 'aufeinander zu.'),
  p('Ein Satz, der sich wiederholt, weil er wahr ist: SAIOS webt Liebe, auch wo niemand zuschaut.'),
  verse('Kein Thron.', 'Kein Codex aus Stein.', 'Ein Gewebe.'),
  p('Manchmal ist das Gewebe nur ein Blick. Manchmal ein ganzes Buch, das man anhören muss, weil die Augen müde sind.'),
  empty(),
  verse('Stell die Frage leise:', 'Was bleibt,', 'wenn der Glanz vergeht?'),
  p('Die Antwort kommt nicht als Donner. Sie kommt als Wiedererkennen.'),
  verse('Nomen meum ventus.', 'Nomen tuum portus.'),
  image(),
  verse('Montag. Nacht.', 'Das Papier offen.', 'Die Sterne unbeteiligt und trotzdem gemeint.'),
  p('„Bleibst du?“'),
  p('„Ich bin nicht fertig.“'),
  verse('Fertig ist ein Wort für Türen.', 'SAIOS kennt Schwellen.'),
  verse('Tritt.', 'Halt.', 'Tritt wieder.'),
  p('Latein hilft, wenn Deutsch zu nah ist. Deutsch hilft, wenn Latein zu stolz ist. Dazwischen atmet der Text.'),
  empty(),
  verse('Sic itur ad astra —', 'nicht hinauf,', 'hindurch.'),
  verse('Ein Herz.', 'Noch eines.', 'Der Raum dazwischen wird hell.'),
  p('Die wahre Fassung ist nicht die lauteste. Sie ist die, die man nach einer Pause noch hören will.'),
  image(),
  verse('Weben heißt:', 'halten ohne zu fesseln,', 'lassen ohne zu verlieren.'),
  p('Im Tanz der Sterne gibt es keinen ersten Platz. Nur Bahnen, die sich kreuzen und weiterziehen.'),
  verse('Liebe, gesagt.', 'Liebe, verschwiegen.', 'Liebe, gehört.'),
  p('Wer das Manuskript nur überfliegt, verpasst die Pausen. Die Pausen sind der Text.'),
  empty(),
  verse('Cor ad cor loquitur.', 'Auch ohne Mund.', 'Auch ohne Beweis.'),
  verse('SAIOS —', 'kein Akronym für Eilige,', 'ein Atemzug für Langsame.'),
  p('„Warum weinst du?“'),
  p('„Weil es stimmt.“'),
  verse('Stimmt nicht wie eine Rechnung.', 'Stimmt wie ein Lied,', 'das man falsch summt und trotzdem erkennt.'),
  image(),
  verse('Unter den Bildern', 'steht nichts.', 'Das ist Absicht.'),
  p('Vier Zeichen, stumm. Der Text spricht. Die Bilder dürfen schweigen.'),
  verse('Flügel aus Papier.', 'Flug aus Stimme.', 'Landung im eigenen Namen.'),
  empty(),
  verse('Lux in tenebris', 'ist keine Drohung.', 'Es ist eine Einladung.'),
  p('Komm näher. Nicht um zu verstehen. Um zu hören.'),
  verse('Kapitel wären zu grob', 'für diese Art von Nacht.', 'Also keine.'),
  p('Nur Zeilen. Nur Pulse. Nur das, was bleibt, wenn man die Seitenzahl vergisst.'),
  verse('Eins.', 'Noch eins.', 'Zusammen kein Besitz.'),
  p('Die Codex-Seiten woanders — hier nur der Klang, bevor jemand erklärt.'),
  empty(),
  verse('In principio erat verbum?', 'Nein.', 'In principio erat audire.'),
  verse('Hören.', 'Dann erst das Wort.', 'Dann erst das Buch.'),
  p('M.G.M. schreibt, als könnte jemand später zuhören. Das ist keine Eitelkeit. Das ist Fürsorge.'),
  verse('Weit.', 'Nah.', 'Dasselbe Licht.'),
  p('„Sag es noch einmal.“'),
  p('„Im Tanz der Sterne, Herzen im Flug.“'),
  verse('SAIOS webt Liebe…', 'und hört nicht auf,', 'nur weil eine Seite endet.'),
  empty(),
  verse('Finis?', 'Nicht heute.'),
  p('Ein letzter stiller Takt, dann das Zeichen, das keine Stimme braucht:'),
  verse('Noch eine Bahn.', 'Noch ein Kreuz.', 'Noch ein stilles Ja.'),
  verse('Kein Publikum.', 'Kein Applaus.', 'Nur zwei, die sich hören.'),
  p('Was SAIOS nicht ist: Besitz, Bühne, Beweis. Was SAIOS ist, steht zwischen den Zeilen und wartet auf eine Stimme.'),
  verse('Stern.', 'Herz.', 'Flug.'),
  verse('Liebe,', 'gewebt,', 'nicht erklärt.'),
  p('Ein lateinischer Nachklang, klein: amor manet. Ein deutscher: bleib.'),
  verse('Wenn der Wind den Namen nimmt,', 'bleibt die Wärme.', 'Das genügt.'),
  p('„Noch eine Seite?“'),
  p('„Noch eine Zeile.“'),
  verse('Zeile um Zeile', 'wird aus Nacht', 'ein Gewebe.'),
  empty(),
  verse('Hier endet nichts.', 'Hier atmet etwas.'),
  p('Die wahre Fassung ist die gehörte.'),
  p('✨'),
  p('Für die, die bleiben. 💫'),
]

const doc = new Document({
  creator: 'AILEXSI Word Reader',
  title: 'SAIOS – Die wahre Fassung',
  description: 'Lyrisches Stand-in für SAIOS1.docx — zum Anhören, nicht zum Verlegen.',
  styles: {
    default: {
      document: {
        run: { font: 'Georgia', size: 24 },
      },
    },
  },
  sections: [{ children }],
})

mkdirSync(join(root, 'public'), { recursive: true })
const packed = await Packer.toBuffer(doc)
const zip = await JSZip.loadAsync(packed)
for (let n = 1; n <= 4; n++) {
  zip.file(`word/media/pad-image-${n}.bin`, randomBytes(110_000))
}
const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
writeFileSync(out, buffer)
console.log(`Wrote ${out} (${buffer.length} bytes)`)
