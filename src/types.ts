export type BlockKind = 'heading' | 'paragraph'

export interface ManuscriptBlock {
  id: string
  kind: BlockKind
  /** Heading level 1–6 when kind is heading */
  level?: number
  text: string
  chapterId: string
}

export interface Chapter {
  id: string
  title: string
  level: number
  startBlockIndex: number
  blockCount: number
}

export interface Manuscript {
  fingerprint: string
  fileName: string
  fileSize: number
  importedAt: number
  language: string
  title: string
  chapters: Chapter[]
  blocks: ManuscriptBlock[]
}

export interface ReadingPosition {
  fingerprint: string
  chapterId: string
  blockIndex: number
  chunkIndex: number
  charOffset: number
  updatedAt: number
}

export interface PlaybackPrefs {
  voiceURI: string | null
  rate: number
  volume: number
}

export const SPEED_PRESETS = [0.75, 1, 1.25, 1.5, 1.75, 2] as const
export type SpeedPreset = (typeof SPEED_PRESETS)[number]

export const DEFAULT_PREFS: PlaybackPrefs = {
  voiceURI: null,
  rate: 1,
  volume: 1,
}
