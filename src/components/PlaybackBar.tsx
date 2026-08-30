import type { VoiceInfo } from '../narration/types'
import { SPEED_PRESETS } from '../types'
import type { EngineStatus } from '../narration/types'

interface Props {
  status: EngineStatus
  rate: number
  volume: number
  voices: VoiceInfo[]
  voiceId: string | null
  progress: number
  speechSupported: boolean
  onPlay: () => void
  onPause: () => void
  onStop: () => void
  onPrev: () => void
  onNext: () => void
  onSkipBack: () => void
  onSkipForward: () => void
  onRate: (rate: number) => void
  onVolume: (volume: number) => void
  onVoice: (id: string) => void
  onSeek: (ratio: number) => void
}

export function PlaybackBar({
  status,
  rate,
  volume,
  voices,
  voiceId,
  progress,
  speechSupported,
  onPlay,
  onPause,
  onStop,
  onPrev,
  onNext,
  onSkipBack,
  onSkipForward,
  onRate,
  onVolume,
  onVoice,
  onSeek,
}: Props) {
  const playing = status === 'playing'

  return (
    <footer className="transport">
      <div className="transport-progress">
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(progress * 1000)}
          aria-label="Fortschritt"
          onChange={(e) => onSeek(Number(e.target.value) / 1000)}
        />
      </div>

      <div className="transport-row">
        <div className="transport-controls">
          <button type="button" className="icon-btn" onClick={onSkipBack} title="10 Sekunden zurück" aria-label="10 Sekunden zurück">
            −10
          </button>
          <button type="button" className="icon-btn" onClick={onPrev} title="Vorheriger Absatz" aria-label="Vorheriger Absatz">
            ⟨
          </button>
          {playing ? (
            <button type="button" className="icon-btn play" onClick={onPause} title="Pause" aria-label="Pause">
              ⏸
            </button>
          ) : (
            <button
              type="button"
              className="icon-btn play"
              onClick={onPlay}
              title="Abspielen"
              aria-label="Abspielen"
              disabled={!speechSupported}
            >
              ▶
            </button>
          )}
          <button type="button" className="icon-btn" onClick={onStop} title="Stopp" aria-label="Stopp">
            ■
          </button>
          <button type="button" className="icon-btn" onClick={onNext} title="Nächster Absatz" aria-label="Nächster Absatz">
            ⟩
          </button>
          <button type="button" className="icon-btn" onClick={onSkipForward} title="30 Sekunden vor" aria-label="30 Sekunden vor">
            +30
          </button>
        </div>

        <div className="transport-prefs">
          <label className="pref">
            <span>Tempo</span>
            <select value={String(rate)} onChange={(e) => onRate(Number(e.target.value))} aria-label="Geschwindigkeit">
              {SPEED_PRESETS.map((preset) => (
                <option key={preset} value={preset}>
                  {preset.toFixed(2).replace(/\.00$/, '.0').replace(/(\.\d)0$/, '$1')}x
                </option>
              ))}
            </select>
          </label>

          <label className="pref voice">
            <span>Stimme</span>
            <select
              value={voiceId ?? ''}
              onChange={(e) => onVoice(e.target.value)}
              aria-label="Stimme"
              disabled={voices.length === 0}
            >
              {voices.length === 0 ? (
                <option value="">Keine Stimme</option>
              ) : (
                voices.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.name}
                    {voice.lang ? ` · ${voice.lang}` : ''}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="pref volume">
            <span>Laut</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(volume * 100)}
              onChange={(e) => onVolume(Number(e.target.value) / 100)}
              aria-label="Lautstärke"
            />
          </label>
        </div>
      </div>
    </footer>
  )
}
