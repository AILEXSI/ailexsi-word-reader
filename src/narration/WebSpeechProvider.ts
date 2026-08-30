import type {
  NarrationError,
  NarrationProvider,
  SpeakOptions,
  SpeechChunk,
  SpokenUtterance,
  UtteranceHandlers,
  VoiceInfo,
} from './types'
import { toVoiceInfo, waitForVoices } from './voices'

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
}

export function createWebSpeechProvider(): NarrationProvider {
  return {
    id: 'web-speech',
    label: 'Systemstimme',

    async listVoices(): Promise<VoiceInfo[]> {
      if (!isSpeechSupported()) return []
      const voices = await waitForVoices()
      return voices.map(toVoiceInfo)
    },

    speak(chunk: SpeechChunk, options: SpeakOptions, handlers: UtteranceHandlers): SpokenUtterance {
      if (!isSpeechSupported()) {
        const error: NarrationError = {
          message: 'In diesem Browser ist keine Sprachausgabe verfügbar.',
          chunkId: chunk.id,
          blockIndex: chunk.blockIndex,
          retryable: false,
        }
        queueMicrotask(() => handlers.onError?.(error))
        return { cancel() {}, pause() {}, resume() {} }
      }

      const utterance = new SpeechSynthesisUtterance(chunk.text)
      utterance.rate = clamp(options.rate, 0.5, 2)
      utterance.volume = clamp(options.volume, 0, 1)
      utterance.pitch = chunk.isHeading ? 0.92 : 1
      utterance.lang = options.lang || 'de-DE'

      const voices = speechSynthesis.getVoices()
      const match = options.voiceId
        ? voices.find((v) => v.voiceURI === options.voiceId)
        : voices.find((v) => v.lang.toLowerCase().startsWith('de'))
      if (match) {
        utterance.voice = match
        if (match.lang) utterance.lang = match.lang
      }

      let settled = false
      const finish = (fn?: () => void) => {
        if (settled) return
        settled = true
        fn?.()
      }

      utterance.onstart = () => handlers.onStart?.()
      utterance.onboundary = (event: SpeechSynthesisEvent) => {
        if (event.name === 'word' || event.name === 'sentence' || event.charIndex >= 0) {
          handlers.onBoundary?.(event.charIndex)
        }
      }
      utterance.onend = () => finish(() => handlers.onEnd?.())
      utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
        if (event.error === 'canceled' || event.error === 'interrupted') {
          finish()
          return
        }
        finish(() =>
          handlers.onError?.({
            message: speechErrorMessage(event.error),
            chunkId: chunk.id,
            blockIndex: chunk.blockIndex,
            retryable: event.error !== 'synthesis-unavailable',
          }),
        )
      }

      speechSynthesis.speak(utterance)

      return {
        cancel() {
          settled = true
          speechSynthesis.cancel()
        },
        pause() {
          speechSynthesis.pause()
        },
        resume() {
          speechSynthesis.resume()
        },
      }
    },
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function speechErrorMessage(code: string): string {
  switch (code) {
    case 'synthesis-failed':
      return 'Die Sprachausgabe ist fehlgeschlagen.'
    case 'synthesis-unavailable':
      return 'Die Sprachausgabe ist gerade nicht verfügbar.'
    case 'audio-busy':
      return 'Der Lautsprecher ist belegt. Bitte erneut versuchen.'
    case 'network':
      return 'Die Systemstimme braucht eine Verbindung. Bitte erneut versuchen.'
    case 'not-allowed':
      return 'Der Browser hat die Sprachausgabe blockiert.'
    default:
      return 'Vorlesen fehlgeschlagen.'
  }
}
