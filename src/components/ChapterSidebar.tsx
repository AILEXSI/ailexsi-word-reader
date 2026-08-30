import type { Chapter, Manuscript } from '../types'

interface Props {
  manuscript: Manuscript
  activeChapterId: string
  onSelect: (chapter: Chapter) => void
  open: boolean
  onClose: () => void
}

export function ChapterSidebar({ manuscript, activeChapterId, onSelect, open, onClose }: Props) {
  return (
    <aside className={`sidebar ${open ? 'is-open' : ''}`} aria-label="Kapitel">
      <div className="sidebar-head">
        <p className="eyebrow">Manuskript</p>
        <h2 className="sidebar-title">{manuscript.title}</h2>
        <p className="sidebar-meta">
          {manuscript.chapters.length} {manuscript.chapters.length === 1 ? 'Abschnitt' : 'Abschnitte'}
          {' · '}
          {manuscript.blocks.length} Absätze
        </p>
        <button type="button" className="sidebar-close" onClick={onClose} aria-label="Kapitel schließen">
          Schließen
        </button>
      </div>
      <nav className="chapter-list">
        {manuscript.chapters.map((chapter) => (
          <button
            key={chapter.id}
            type="button"
            className={`chapter-item level-${chapter.level} ${chapter.id === activeChapterId ? 'is-active' : ''}`}
            onClick={() => onSelect(chapter)}
          >
            {chapter.title}
          </button>
        ))}
      </nav>
    </aside>
  )
}
