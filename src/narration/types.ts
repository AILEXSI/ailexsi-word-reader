import type { BlockKind } from '../types'

export interface VoiceInfo {
  id: string
  name: string
  lang: string
  local: boolean
  default: boolean
}

export interface SpeechChunk {
  id: string
  blockIndex: number
  chunkIndex: number
  chapterId: string
  text: string
  kind: BlockKind
  isHeading: boolean
  /** Extra silence after this chunk so verse lines do not run together. */
  pauseAfterMs: number
}

export interface SpeakOptions {
  voiceId: string | null
  rate: number
  volume: number
  lang: string
}

export interface NarrationError {
  message: string
  chunkId: string
  blockIndex: number
  retryable: boolean
}

export interface UtteranceHandlers {
  onStart?: () => void
  onBoundary?: (charIndex: number) => void
  onEnd?: () => void
  onError?: (error: NarrationError) => void
}

export interface SpokenUtterance {
  cancel: () => void
  pause: () => void
  resume: () => void
}

export interface NarrationProvider {
  readonly id: string
  readonly label: string
  listVoices(): Promise<VoiceInfo[]>
  speak(chunk: SpeechChunk, options: SpeakOptions, handlers: UtteranceHandlers): SpokenUtterance
}

export type EngineStatus = 'idle' | 'playing' | 'paused'

export interface EngineSnapshot {
  status: EngineStatus
  chunk: SpeechChunk | null
  blockIndex: number
  chunkIndex: number
  charOffset: number
  failedBlockIndex: number | null
}
