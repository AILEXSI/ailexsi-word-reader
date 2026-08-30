import type { VoiceInfo } from './types'

const PREFERRED_DE = [
  /neural/i,
  /natural/i,
  /google.*deutsch/i,
  /microsoft.*(katja|hedda|stefan|conrad|seraphina|anna|ingrid|killian)/i,
  /\banna\b/i,
  /\bkatja\b/i,
  /\bhedda\b/i,
  /\bpetra\b/i,
  /\bmarlene\b/i,
]

export function toVoiceInfo(voice: SpeechSynthesisVoice): VoiceInfo {
  return {
    id: voice.voiceURI,
    name: voice.name,
    lang: voice.lang,
    local: voice.localService,
    default: voice.default,
  }
}

export function scoreVoice(voice: VoiceInfo): number {
  let score = 0
  const lang = voice.lang.toLowerCase().replace('_', '-')
  if (lang === 'de-de' || lang.startsWith('de-de')) score += 130
  else if (lang.startsWith('de-at') || lang.startsWith('de-ch')) score += 95
  else if (lang.startsWith('de')) score += 85
  else if (lang.startsWith('en')) score += 15

  const name = voice.name
  if (/neural|natural|super-?natural|online|premium|enhanced/i.test(name)) score += 45
  if (voice.local) score += 8
  if (voice.default && lang.startsWith('de')) score += 5
  for (let i = 0; i < PREFERRED_DE.length; i++) {
    if (PREFERRED_DE[i].test(name)) {
      score += 28 - i
      break
    }
  }
  if (/compact|eloquence|novelty|whisper|bad news|good news|boing|zarvox|trinoids|organiser/i.test(name)) {
    score -= 50
  }
  return score
}

export function sortVoices(voices: VoiceInfo[]): VoiceInfo[] {
  return [...voices].sort((a, b) => scoreVoice(b) - scoreVoice(a) || a.name.localeCompare(b.name, 'de'))
}

export function pickDefaultVoice(voices: VoiceInfo[], remembered: string | null): VoiceInfo | null {
  if (voices.length === 0) return null
  if (remembered) {
    const found = voices.find((v) => v.id === remembered)
    if (found) return found
  }
  return sortVoices(voices)[0] ?? null
}

export function waitForVoices(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  if (typeof speechSynthesis === 'undefined') return Promise.resolve([])

  const existing = speechSynthesis.getVoices()
  if (existing.length > 0) return Promise.resolve(existing)

  return new Promise((resolve) => {
    const done = (list: SpeechSynthesisVoice[]) => {
      speechSynthesis.removeEventListener('voiceschanged', onChange)
      window.clearTimeout(timer)
      resolve(list)
    }
    const onChange = () => {
      const list = speechSynthesis.getVoices()
      if (list.length > 0) done(list)
    }
    const timer = window.setTimeout(() => done(speechSynthesis.getVoices()), timeoutMs)
    speechSynthesis.addEventListener('voiceschanged', onChange)
  })
}
