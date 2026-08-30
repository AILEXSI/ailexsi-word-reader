import { describe, expect, it } from 'vitest'
import { toSpokenText } from './speakable'

describe('toSpokenText', () => {
  it('strips emoji without changing the words', () => {
    expect(toSpokenText('SAIOS webt Liebe ✨')).toBe('SAIOS webt Liebe')
    expect(toSpokenText('Nur Worte.')).toBe('Nur Worte.')
  })
})
