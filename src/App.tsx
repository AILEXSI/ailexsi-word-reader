import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChapterSidebar } from './components/ChapterSidebar'
import { ErrorBanner } from './components/ErrorBanner'
import { ManuscriptView } from './components/ManuscriptView'
import { OpenDropzone } from './components/OpenDropzone'
import { PlaybackBar } from './components/PlaybackBar'
import { ResumeDialog } from './components/ResumeDialog'
import { chapterIndexAt } from './docx/structure'
import { importManuscript, loadLongSampleManuscript, loadSampleManuscript, pickDocxFile } from './file/openManuscript'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { createNarrationEngine, type NarrationEngine } from './narration/NarrationEngine'
import type { EngineSnapshot, NarrationError, VoiceInfo } from './narration/types'
import { createWebSpeechProvider, isSpeechSupported } from './narration/WebSpeechProvider'
import { pickDefaultVoice, sortVoices } from './narration/voices'
import { loadLastSession, loadPosition, savePosition } from './persistence/db'
import { loadPrefs, savePrefs } from './persistence/prefs'
import type { Chapter, Manuscript, PlaybackPrefs, ReadingPosition } from './types'

const EMPTY_SNAP: EngineSnapshot = {
  status: 'idle',
  chunk: null,
  blockIndex: 0,
  chunkIndex: 0,
  charOffset: 0,
  failedBlockIndex: null,
}

function hasProgress(position: ReadingPosition | null): boolean {
  if (!position) return false
  return position.blockIndex > 0 || position.chunkIndex > 0 || position.charOffset > 0
}

export default function App() {
  const [manuscript, setManuscript] = useState<Manuscript | null>(null)
  const [position, setPosition] = useState<ReadingPosition | null>(null)
  const [prefs, setPrefs] = useState<PlaybackPrefs>(() => loadPrefs())
  const [voices, setVoices] = useState<VoiceInfo[]>([])
  const [snapshot, setSnapshot] = useState<EngineSnapshot>(EMPTY_SNAP)
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [speechError, setSpeechError] = useState<NarrationError | null>(null)
  const [resumeOpen, setResumeOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [booting, setBooting] = useState(true)

  const engineRef = useRef<NarrationEngine | null>(null)
  const manuscriptRef = useRef<Manuscript | null>(null)
  const speechOk = isSpeechSupported()

  useEffect(() => {
    manuscriptRef.current = manuscript
  }, [manuscript])

  useEffect(() => {
    const provider = createWebSpeechProvider()
    const engine = createNarrationEngine(provider, {
      onSnapshot: setSnapshot,
      onPosition: (next) => {
        setPosition(next)
        void savePosition(next)
      },
      onError: (err) => setSpeechError(err),
      onEnded: () => setSpeechError(null),
    })
    engineRef.current = engine
    engine.setOptions({
      voiceId: prefs.voiceURI,
      rate: prefs.rate,
      volume: prefs.volume,
      lang: 'de-DE',
    })

    void (async () => {
      try {
        const list = sortVoices(await provider.listVoices())
        setVoices(list)
        const chosen = pickDefaultVoice(list, prefs.voiceURI)
        if (chosen && chosen.id !== prefs.voiceURI) {
          const next = { ...prefs, voiceURI: chosen.id }
          setPrefs(next)
          savePrefs(next)
          engine.setOptions({ voiceId: chosen.id })
        }
      } catch {
        /* voices are optional until play */
      }

      try {
        const session = await loadLastSession()
        if (session.manuscript) {
          setManuscript(session.manuscript)
          setPosition(session.position)
          engine.load(session.manuscript, session.position)
          setResumeOpen(hasProgress(session.position))
        }
      } catch {
        /* first launch */
      } finally {
        setBooting(false)
      }
    })()

    return () => {
      engine.destroy()
      engineRef.current = null
    }
    // Boot once — prefs are applied inside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const applyPrefs = useCallback((next: PlaybackPrefs) => {
    setPrefs(next)
    savePrefs(next)
    engineRef.current?.setOptions({
      voiceId: next.voiceURI,
      rate: next.rate,
      volume: next.volume,
      lang: 'de-DE',
    })
  }, [])

  const openFile = useCallback(async (file: File, handle: FileSystemFileHandle | null = null) => {
    setBusy(true)
    setLoadError(null)
    setSpeechError(null)
    await new Promise<void>((resolve) => window.setTimeout(resolve, 30))
    try {
      const next = await importManuscript(file, handle)
      const session = await loadLastSession()
      const stored = session.position && session.position.fingerprint === next.fingerprint
        ? session.position
        : null
      setManuscript(next)
      setPosition(stored)
      engineRef.current?.load(next, stored)
      setResumeOpen(hasProgress(stored))
      setSidebarOpen(false)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setLoadError(err instanceof Error ? err.message : 'Die Datei konnte nicht gelesen werden.')
    } finally {
      setBusy(false)
    }
  }, [])

  const onPick = useCallback(async () => {
    try {
      const { file, handle } = await pickDocxFile()
      await openFile(file, handle)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setLoadError(err instanceof Error ? err.message : 'Datei konnte nicht geöffnet werden.')
    }
  }, [openFile])

  const onSample = useCallback(async () => {
    setBusy(true)
    setLoadError(null)
    await new Promise<void>((resolve) => window.setTimeout(resolve, 30))
    try {
      const next = await loadSampleManuscript()
      const stored = await loadPosition(next.fingerprint)
      setManuscript(next)
      setPosition(stored)
      engineRef.current?.load(next, stored)
      setResumeOpen(hasProgress(stored))
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Beispiel konnte nicht geladen werden.')
    } finally {
      setBusy(false)
    }
  }, [])

  const onLongSample = useCallback(async () => {
    setBusy(true)
    setLoadError(null)
    await new Promise<void>((resolve) => window.setTimeout(resolve, 30))
    try {
      const next = await loadLongSampleManuscript()
      const stored = await loadPosition(next.fingerprint)
      setManuscript(next)
      setPosition(stored)
      engineRef.current?.load(next, stored)
      setResumeOpen(hasProgress(stored))
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Beispiel konnte nicht geladen werden.')
    } finally {
      setBusy(false)
    }
  }, [])

  const onDroppedFile = useCallback(
    (file: File) => {
      void openFile(file)
    },
    [openFile],
  )

  const play = useCallback(() => {
    setSpeechError(null)
    engineRef.current?.play()
  }, [])

  const pause = useCallback(() => engineRef.current?.pause(), [])
  const stop = useCallback(() => engineRef.current?.stop(), [])
  const togglePlay = useCallback(() => {
    if (!manuscript) return
    if (snapshot.status === 'playing') pause()
    else if (snapshot.status === 'paused') engineRef.current?.resume()
    else play()
  }, [manuscript, snapshot.status, pause, play])

  const shortcuts = useMemo(
    () => ({
      togglePlay,
      stop,
      skipBack: () => engineRef.current?.skipBack(10),
      skipForward: () => engineRef.current?.skipForward(30),
      previousParagraph: () => engineRef.current?.previousParagraph(),
      nextParagraph: () => engineRef.current?.nextParagraph(),
      previousChapter: () => engineRef.current?.previousChapter(),
      nextChapter: () => engineRef.current?.nextChapter(),
    }),
    [togglePlay, stop],
  )

  useKeyboardShortcuts(Boolean(manuscript) && !resumeOpen, shortcuts)

  const activeChapterId = useMemo(() => {
    if (!manuscript) return ''
    const idx = chapterIndexAt(manuscript.chapters, snapshot.blockIndex)
    return manuscript.chapters[idx]?.id ?? manuscript.chapters[0]?.id ?? ''
  }, [manuscript, snapshot.blockIndex])

  const progress = manuscript && manuscript.blocks.length > 0
    ? snapshot.blockIndex / Math.max(1, manuscript.blocks.length - 1)
    : 0

  const onSelectChapter = (chapter: Chapter) => {
    engineRef.current?.jumpToBlock(chapter.startBlockIndex)
    setSidebarOpen(false)
    setResumeOpen(false)
  }

  const onResume = () => {
    setResumeOpen(false)
    engineRef.current?.play()
  }

  const onRestart = () => {
    setResumeOpen(false)
    engineRef.current?.jumpToBlock(0)
    engineRef.current?.stop()
  }

  if (booting) {
    return (
      <div className="app-shell">
        <header className="topbar">
          <div>
            <p className="brand">AILEXSI Word Reader</p>
            <p className="brand-sub">Wird geladen…</p>
          </div>
        </header>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="brand">AILEXSI Word Reader</p>
          <p className="brand-sub">Manuskript hören · M.G.M.</p>
        </div>
        <div className="topbar-actions">
          {manuscript ? (
            <button type="button" className="btn-ghost mobile-only" onClick={() => setSidebarOpen(true)}>
              Kapitel
            </button>
          ) : null}
          <button type="button" className="btn-ghost" onClick={() => void onPick()} disabled={busy}>
            Öffnen
          </button>
        </div>
      </header>

      {loadError ? (
        <ErrorBanner message={loadError} onDismiss={() => setLoadError(null)} />
      ) : null}
      {speechError ? (
        <ErrorBanner
          message={speechError.message}
          retryable={speechError.retryable}
          onRetry={() => {
            setSpeechError(null)
            engineRef.current?.retryFailed()
          }}
          onContinue={() => {
            setSpeechError(null)
            engineRef.current?.continueAfterError()
          }}
          onDismiss={() => setSpeechError(null)}
        />
      ) : null}
      {manuscript && !speechOk ? (
        <ErrorBanner
          message="Dieser Browser hat keine Sprachausgabe. Das Manuskript kannst du trotzdem lesen."
          onDismiss={() => undefined}
        />
      ) : null}

      {!manuscript ? (
        <OpenDropzone
          busy={busy}
          onFile={onDroppedFile}
          onPick={() => void onPick()}
          onSample={() => void onSample()}
          onLongSample={() => void onLongSample()}
        />
      ) : (
        <div className="workspace">
          {sidebarOpen ? (
            <button type="button" className="sidebar-scrim" aria-label="Schließen" onClick={() => setSidebarOpen(false)} />
          ) : null}
          <ChapterSidebar
            manuscript={manuscript}
            activeChapterId={activeChapterId}
            onSelect={onSelectChapter}
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
          <main className="reading-pane">
            <ManuscriptView
              manuscript={manuscript}
              activeBlockIndex={snapshot.blockIndex}
              failedBlockIndex={snapshot.failedBlockIndex}
              onBlockClick={(index) => engineRef.current?.jumpToBlock(index)}
              onRetry={() => engineRef.current?.retryFailed()}
            />
          </main>
        </div>
      )}

      {manuscript ? (
        <PlaybackBar
          status={snapshot.status}
          rate={prefs.rate}
          volume={prefs.volume}
          voices={voices}
          voiceId={prefs.voiceURI}
          progress={progress}
          speechSupported={speechOk}
          onPlay={togglePlay}
          onPause={pause}
          onStop={stop}
          onPrev={() => engineRef.current?.previousParagraph()}
          onNext={() => engineRef.current?.nextParagraph()}
          onSkipBack={() => engineRef.current?.skipBack(10)}
          onSkipForward={() => engineRef.current?.skipForward(30)}
          onRate={(rate) => applyPrefs({ ...prefs, rate })}
          onVolume={(volume) => applyPrefs({ ...prefs, volume })}
          onVoice={(voiceURI) => applyPrefs({ ...prefs, voiceURI })}
          onSeek={(ratio) => {
            const index = Math.round(ratio * Math.max(0, manuscript.blocks.length - 1))
            engineRef.current?.jumpToBlock(index)
          }}
        />
      ) : null}

      {manuscript && resumeOpen && position ? (
        <ResumeDialog
          title={manuscript.title}
          position={position}
          chapters={manuscript.chapters}
          onResume={onResume}
          onRestart={onRestart}
          onChapter={(ch) => {
            engineRef.current?.jumpToBlock(ch.startBlockIndex)
            setResumeOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}
