import { DEFAULT_PREFS, type PlaybackPrefs } from '../types'

const KEY = 'ailexsi-word-reader.prefs'

export function loadPrefs(): PlaybackPrefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_PREFS }
    const parsed = JSON.parse(raw) as Partial<PlaybackPrefs>
    return {
      voiceURI: typeof parsed.voiceURI === 'string' ? parsed.voiceURI : null,
      rate: typeof parsed.rate === 'number' && parsed.rate > 0 ? parsed.rate : 1,
      volume: typeof parsed.volume === 'number' ? clamp(parsed.volume, 0, 1) : 1,
    }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

export function savePrefs(prefs: PlaybackPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    /* quota / private mode */
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}
