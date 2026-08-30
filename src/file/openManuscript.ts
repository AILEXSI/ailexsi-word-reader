import { isDocxFile, parseDocx } from '../docx/parseDocx'
import { saveFileHandle, saveManuscript } from '../persistence/db'
import type { Manuscript } from '../types'

export function canUseFilePicker(): boolean {
  return typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function'
}

export async function pickDocxFile(): Promise<{ file: File; handle: FileSystemFileHandle | null }> {
  if (canUseFilePicker() && window.showOpenFilePicker) {
    const [handle] = await window.showOpenFilePicker({
      multiple: false,
      types: [
        {
          description: 'Word-Manuskript',
          accept: {
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
          },
        },
      ],
    })
    const file = await handle.getFile()
    return { file, handle }
  }

  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file) {
        reject(new DOMException('Abgebrochen', 'AbortError'))
        return
      }
      resolve({ file, handle: null })
    })
    input.click()
  })
}

export async function importManuscript(
  file: File,
  handle: FileSystemFileHandle | null = null,
): Promise<Manuscript> {
  if (!isDocxFile(file) && !file.name.toLowerCase().endsWith('.docx')) {
    throw new Error('Bitte eine .docx-Datei öffnen.')
  }
  const manuscript = await parseDocx(file, { name: file.name, size: file.size })
  await saveManuscript(manuscript)
  if (handle) {
    try {
      await saveFileHandle(manuscript.fingerprint, handle)
    } catch {
      /* handle storage is optional */
    }
  }
  return manuscript
}

async function loadBundledDocx(path: string, fileName: string): Promise<Manuscript> {
  const response = await fetch(path)
  if (!response.ok) {
    throw new Error('Das Beispielmanuskript konnte nicht geladen werden.')
  }
  const blob = await response.blob()
  const file = new File([blob], fileName, {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
  return importManuscript(file)
}

export function loadSampleManuscript(): Promise<Manuscript> {
  return loadBundledDocx('/SAIOS1.docx', 'SAIOS1.docx')
}

export function loadLongSampleManuscript(): Promise<Manuscript> {
  return loadBundledDocx('/langes-manuskript.docx', 'langes-manuskript.docx')
}
