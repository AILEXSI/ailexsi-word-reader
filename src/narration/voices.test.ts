import { describe, expect, it } from 'vitest'
import { pickDefaultVoice, scoreVoice, sortVoices } from './voices'
import type { VoiceInfo } from './types'

function voice(partial: Partial<VoiceInfo> & Pick<VoiceInfo, 'id' | 'name' | 'lang'>): VoiceInfo {
  return { local: false, default: false, ...partial }
}

describe('scoreVoice', () => {
  it('prefers de-DE neural voices over English novelty voices', () => {
    const neural = scoreVoice(voice({ id: '1', name: 'Microsoft Katja Online (Natural)', lang: 'de-DE' }))
    const english = scoreVoice(voice({ id: '2', name: 'Samantha', lang: 'en-US', default: true }))
    const novelty = scoreVoice(voice({ id: '3', name: 'Zarvox', lang: 'en-US' }))
    expect(neural).toBeGreaterThan(english)
    expect(english).toBeGreaterThan(novelty)
  })

  it('ranks de-DE above de-AT and generic de', () => {
    const deDE = scoreVoice(voice({ id: 'a', name: 'Anna', lang: 'de-DE' }))
    const deAT = scoreVoice(voice({ id: 'b', name: 'Anna', lang: 'de-AT' }))
    expect(deDE).toBeGreaterThan(deAT)
  })
})

describe('pickDefaultVoice', () => {
  it('keeps a remembered voice and otherwise picks the best German one', () => {
    const voices = [
      voice({ id: 'en', name: 'Samantha', lang: 'en-US', default: true }),
      voice({ id: 'de', name: 'Google Deutsch', lang: 'de-DE' }),
    ]
    expect(pickDefaultVoice(voices, null)?.id).toBe('de')
    expect(pickDefaultVoice(voices, 'en')?.id).toBe('en')
    expect(sortVoices(voices)[0].id).toBe('de')
  })
})
