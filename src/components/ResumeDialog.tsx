import type { Chapter, ReadingPosition } from '../types'

interface Props {
  title: string
  position: ReadingPosition
  chapters: Chapter[]
  onResume: () => void
  onRestart: () => void
  onChapter: (chapter: Chapter) => void
}

export function ResumeDialog({ title, position, chapters, onResume, onRestart, onChapter }: Props) {
  const chapter = chapters.find((c) => c.id === position.chapterId)
  const place = chapter?.title ?? 'Manuskript'

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal" role="dialog" aria-labelledby="resume-title" aria-modal="true">
        <p className="eyebrow">Zuletzt gehört</p>
        <h2 id="resume-title">{title}</h2>
        <p className="modal-copy">
          Weiter bei <em>{place}</em>, Absatz {position.blockIndex + 1}.
        </p>
        <div className="modal-actions">
          <button type="button" className="btn-primary" onClick={onResume}>
            Fortsetzen
          </button>
          <button type="button" className="btn-ghost" onClick={onRestart}>
            Von vorn
          </button>
        </div>
        <div className="modal-chapters">
          <p className="eyebrow">Kapitel wählen</p>
          <div className="modal-chapter-list">
            {chapters.map((ch) => (
              <button key={ch.id} type="button" className="chapter-item" onClick={() => onChapter(ch)}>
                {ch.title}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
