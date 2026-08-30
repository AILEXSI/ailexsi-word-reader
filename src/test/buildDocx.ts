import JSZip from 'jszip'

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

export interface TestParagraph {
  text: string
  style?: string
  outline?: number
  breaks?: boolean
  drawing?: boolean
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function paragraphXml(p: TestParagraph): string {
  if (p.drawing) {
    return `<w:p><w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:docPr id="1" name="Picture" descr="A star that must not be narrated"/></wp:inline></w:drawing></w:r></w:p>`
  }
  const pPr: string[] = []
  if (p.style) pPr.push(`<w:pStyle w:val="${p.style}"/>`)
  if (p.outline != null) pPr.push(`<w:outlineLvl w:val="${p.outline}"/>`)
  const pr = pPr.length ? `<w:pPr>${pPr.join('')}</w:pPr>` : ''

  if (p.breaks && p.text.includes('\n')) {
    const runs = p.text.split('\n').map((part, i, arr) => {
      const br = i < arr.length - 1 ? '<w:br/>' : ''
      return `<w:r><w:t xml:space="preserve">${escapeXml(part)}</w:t>${br}</w:r>`
    })
    return `<w:p>${pr}${runs.join('')}</w:p>`
  }

  return `<w:p>${pr}<w:r><w:t xml:space="preserve">${escapeXml(p.text)}</w:t></w:r></w:p>`
}

export async function buildDocx(paragraphs: TestParagraph[], styles?: string): Promise<Blob> {
  const body = paragraphs.map(paragraphXml).join('') + '<w:sectPr/>'
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${W}"><w:body>${body}</w:body></w:document>`

  const stylesXml =
    styles ??
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="${W}">
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:pPr><w:outlineLvl w:val="0"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:pPr><w:outlineLvl w:val="1"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="berschrift1">
    <w:name w:val="Überschrift 1"/>
    <w:basedOn w:val="Heading1"/>
  </w:style>
</w:styles>`

  const zip = new JSZip()
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`,
  )
  zip.file('word/document.xml', documentXml)
  zip.file('word/styles.xml', stylesXml)
  return zip.generateAsync({ type: 'blob' })
}
