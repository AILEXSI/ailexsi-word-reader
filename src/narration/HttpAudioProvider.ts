import type {
  NarrationError,
  NarrationProvider,
  SpeakOptions,
  SpeechChunk,
  SpokenUtterance,
  UtteranceHandlers,
  VoiceInfo,
} from './types'

/** Same-origin Vite proxy target (`/tts` → `127.0.0.1:8765`). */
export const HTTP_TTS_BASE = '/tts'

export const HTTP_TTS_VOICE: VoiceInfo = {
  id: 'chatterbox-de',
  name: 'Chatterbox Deutsch',
  lang: 'de-DE',
  local: true,
  default: true,
}

export interface HttpAudioDeps {
  baseUrl?: string
  healthTimeoutMs?: number
  fetchFn?: typeof fetch
  createAudio?: () => HTMLAudioElement
}

export async function probeHttpTts(deps: HttpAudioDeps = {}): Promise<boolean> {
  const baseUrl = deps.baseUrl ?? HTTP_TTS_BASE
  const timeoutMs = deps.healthTimeoutMs ?? 800
  const fetchFn = deps.fetchFn ?? fetch
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetchFn(`${baseUrl}/health`, { method: 'GET', signal: controller.signal })
    if (!res.ok) return false
    const body = (await res.json()) as { ok?: unknown }
    return body.ok === true
  } catch {
    return false
  } finally {
    window.clearTimeout(timer)
  }
}

export function createHttpAudioProvider(deps: HttpAudioDeps = {}): NarrationProvider {
  const baseUrl = deps.baseUrl ?? HTTP_TTS_BASE
  const fetchFn = deps.fetchFn ?? fetch
  const createAudio = deps.createAudio ?? (() => new Audio())

  return {
    id: 'neural-http',
    label: 'Neuronale Stimme',

    async listVoices(): Promise<VoiceInfo[]> {
      return [HTTP_TTS_VOICE]
    },

    speak(chunk: SpeechChunk, options: SpeakOptions, handlers: UtteranceHandlers): SpokenUtterance {
      const abort = new AbortController()
      let settled = false
      let cancelled = false
      let paused = false
      let started = false
      let audio: HTMLAudioElement | null = null
      let objectUrl: string | null = null
      let boundaryTimer: number | null = null

      const finish = (fn?: () => void) => {
        if (settled) return
        settled = true
        fn?.()
      }

      const stopBoundary = () => {
        if (boundaryTimer != null) {
          window.clearInterval(boundaryTimer)
          boundaryTimer = null
        }
      }

      const startBoundary = () => {
        stopBoundary()
        boundaryTimer = window.setInterval(() => {
          if (!audio) return
          const duration = audio.duration
          if (!duration || !Number.isFinite(duration) || duration <= 0) return
          const ratio = Math.min(1, Math.max(0, audio.currentTime / duration))
          handlers.onBoundary?.(Math.floor(ratio * chunk.text.length))
        }, 200)
      }

      const cleanupAudio = () => {
        stopBoundary()
        if (audio) {
          audio.onplaying = null
          audio.onended = null
          audio.onerror = null
          audio.pause()
          audio.removeAttribute('src')
          audio.load()
          audio = null
        }
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl)
          objectUrl = null
        }
      }

      const fail = (message: string) => {
        cleanupAudio()
        finish(() =>
          handlers.onError?.({
            message,
            chunkId: chunk.id,
            blockIndex: chunk.blockIndex,
            retryable: true,
          } satisfies NarrationError),
        )
      }

      void (async () => {
        try {
          const res = await fetchFn(`${baseUrl}/speak`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: chunk.text,
              lang: options.lang || 'de-DE',
              rate: options.rate,
              volume: options.volume,
            }),
            signal: abort.signal,
          })
          if (cancelled) return
          if (!res.ok) {
            fail('Die neuronale Stimme hat nicht geantwortet. Bitte erneut versuchen.')
            return
          }
          const blob = await res.blob()
          if (cancelled) return

          objectUrl = URL.createObjectURL(blob)
          audio = createAudio()
          audio.src = objectUrl
          audio.playbackRate = clamp(options.rate, 0.75, 2)
          audio.volume = clamp(options.volume, 0, 1)
          audio.onplaying = () => {
            if (cancelled || started) return
            started = true
            startBoundary()
            handlers.onStart?.()
          }
          audio.onended = () => {
            cleanupAudio()
            finish(() => handlers.onEnd?.())
          }
          audio.onerror = () => {
            if (cancelled) return
            fail('Die Audiowiedergabe ist fehlgeschlagen.')
          }
          if (paused) return
          try {
            await audio.play()
          } catch {
            if (cancelled || paused) return
            fail('Die Audiowiedergabe ist fehlgeschlagen.')
          }
        } catch {
          if (cancelled || abort.signal.aborted) return
          fail('Die neuronale Stimme ist nicht erreichbar. Bitte erneut versuchen.')
        }
      })()

      return {
        cancel() {
          cancelled = true
          abort.abort()
          cleanupAudio()
          finish()
        },
        pause() {
          paused = true
          stopBoundary()
          audio?.pause()
        },
        resume() {
          paused = false
          if (audio) {
            startBoundary()
            void audio.play()
          }
        },
      }
    },
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}
