import { useState, type DragEvent } from 'react'

interface Props {
  busy: boolean
  onFile: (file: File) => void
  onPick: () => void
  onSample: () => void
  onLongSample: () => void
}

export function OpenDropzone({ busy, onFile, onPick, onSample, onLongSample }: Props) {
  const [over, setOver] = useState(false)

  const onDragOver = (event: DragEvent) => {
    event.preventDefault()
    setOver(true)
  }

  const onDragLeave = () => setOver(false)

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setOver(false)
    const file = event.dataTransfer.files?.[0]
    if (file) onFile(file)
  }

  return (
    <div className="open-screen">
      <div className="open-copy">
        <p className="eyebrow">AILEXSI · MONDAY</p>
        <h1>Word Reader</h1>
        <p className="lede">
          Ein deutsches Manuskript öffnen und anhören — Verse, Kapitel, lange Bücher.
          Die Datei bleibt unberührt.
        </p>
      </div>

      <div
        className={`dropzone ${over ? 'is-over' : ''} ${busy ? 'is-busy' : ''}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        onClick={busy ? undefined : onPick}
        onKeyDown={(e) => {
          if (busy) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onPick()
          }
        }}
      >
        <span className="dropzone-mark" aria-hidden>
          ▭
        </span>
        <strong>{busy ? 'Wird gelesen…' : 'DOCX hierher ziehen'}</strong>
        <span>oder klicken, um ein Manuskript zu öffnen</span>
      </div>

      <div className="open-actions">
        <button type="button" className="btn-primary" onClick={onPick} disabled={busy}>
          Manuskript öffnen
        </button>
        <button type="button" className="btn-ghost" onClick={onSample} disabled={busy}>
          SAIOS anhören
        </button>
        <button type="button" className="btn-ghost" onClick={onLongSample} disabled={busy}>
          Langes Beispiel
        </button>
      </div>
    </div>
  )
}
