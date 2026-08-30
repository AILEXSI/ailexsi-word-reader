import { useEffect, useRef } from 'react'
import type { Manuscript } from '../types'

interface Props {
  manuscript: Manuscript
  activeBlockIndex: number
  failedBlockIndex: number | null
  onBlockClick: (index: number) => void
  onRetry: () => void
}

export function ManuscriptView({
  manuscript,
  activeBlockIndex,
  failedBlockIndex,
  onBlockClick,
  onRetry,
}: Props) {
  const activeRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const el = activeRef.current
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [activeBlockIndex])

  return (
    <article className="manuscript" aria-label="Manuskript">
      {manuscript.blocks.map((block, index) => {
        const Tag = block.kind === 'heading' ? (`h${Math.min(block.level ?? 2, 4)}` as 'h2') : 'p'
        const isActive = index === activeBlockIndex
        const isFailed = index === failedBlockIndex
        return (
          <Tag
            key={block.id}
            ref={isActive ? (node) => { activeRef.current = node } : undefined}
            className={[
              block.kind === 'heading' ? `ms-h ms-h${block.level ?? 2}` : 'ms-p',
              block.text.includes('\n') ? 'is-verse' : '',
              isActive ? 'is-current' : '',
              isFailed ? 'is-failed' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onBlockClick(index)}
          >
            {block.text}
            {isFailed ? (
              <button type="button" className="inline-retry" onClick={(e) => { e.stopPropagation(); onRetry() }}>
                Erneut versuchen
              </button>
            ) : null}
          </Tag>
        )
      })}
    </article>
  )
}
