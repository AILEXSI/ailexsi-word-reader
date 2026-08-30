import { useEffect } from 'react'

export interface ShortcutHandlers {
  togglePlay: () => void
  stop: () => void
  skipBack: () => void
  skipForward: () => void
  previousParagraph: () => void
  nextParagraph: () => void
  previousChapter: () => void
  nextChapter: () => void
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return el.isContentEditable
}

export function useKeyboardShortcuts(enabled: boolean, handlers: ShortcutHandlers): void {
  useEffect(() => {
    if (!enabled) return

    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isTypingTarget(event.target)) return

      switch (event.key) {
        case ' ':
          event.preventDefault()
          handlers.togglePlay()
          break
        case 'Escape':
          event.preventDefault()
          handlers.stop()
          break
        case 'ArrowLeft':
          event.preventDefault()
          handlers.skipBack()
          break
        case 'ArrowRight':
          event.preventDefault()
          handlers.skipForward()
          break
        case 'ArrowUp':
          event.preventDefault()
          handlers.previousParagraph()
          break
        case 'ArrowDown':
          event.preventDefault()
          handlers.nextParagraph()
          break
        case '[':
          event.preventDefault()
          handlers.previousChapter()
          break
        case ']':
          event.preventDefault()
          handlers.nextChapter()
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, handlers])
}
