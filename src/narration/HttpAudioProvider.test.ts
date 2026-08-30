import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHttpAudioProvider, HTTP_TTS_VOICE, probeHttpTts } from './HttpAudioProvider'
import type { SpeechChunk, SpeakOptions, UtteranceHandlers } from './types'

function chunk(text = 'Hallo Welt'): SpeechChunk {
  return {
    id: '0:0',
    blockIndex: 0,
    chunkIndex: 0,
    chapterId: 'ch-1',
    text,
    kind: 'paragraph',
    isHeading: false,
    pauseAfterMs: 0,
  }
}

const options: SpeakOptions = { voiceId: 'chatterbox-de', rate: 1.25, volume: 0.8, lang: 'de-DE' }

class FakeAudio {
  src = ''
  currentTime = 0
  duration = 1.5
  playbackRate = 1
  volume = 1
  paused = true
  onplaying: ((ev: Event) => void) | null = null
  onended: ((ev: Event) => void) | null = null
  onerror: ((ev: Event) => void) | null = null

  play = vi.fn(async () => {
    this.paused = false
    this.onplaying?.(new Event('playing'))
  })

  pause = vi.fn(() => {
    this.paused = true
  })

  load = vi.fn()
  removeAttribute = vi.fn()
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function wavResponse(): Response {
  return new Response(new Uint8Array([82, 73, 70, 70]), {
    status: 200,
    headers: { 'Content-Type': 'audio/wav' },
  })
}

describe('probeHttpTts', () => {
  it('returns true only for a healthy ok payload', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ ok: true, backend: 'chatterbox-multilingual-v3' }))
    await expect(probeHttpTts({ fetchFn, baseUrl: '/tts' })).resolves.toBe(true)
    expect(fetchFn).toHaveBeenCalledWith('/tts/health', expect.objectContaining({ method: 'GET' }))
  })

  it('returns false when the server is down or unhealthy', async () => {
    await expect(
      probeHttpTts({ fetchFn: async () => jsonResponse({ ok: false }), baseUrl: '/tts' }),
    ).resolves.toBe(false)
    await expect(
      probeHttpTts({
        fetchFn: async () => {
          throw new Error('ECONNREFUSED')
        },
      }),
    ).resolves.toBe(false)
  })
})

describe('createHttpAudioProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('lists the Chatterbox German voice without cloning Web Speech voices', async () => {
    const provider = createHttpAudioProvider()
    expect(provider.id).toBe('neural-http')
    expect(provider.label).toBe('Neuronale Stimme')
    await expect(provider.listVoices()).resolves.toEqual([HTTP_TTS_VOICE])
  })

  it('POSTs text and plays the returned WAV, with pause/resume/cancel on the Audio element', async () => {
    const createObjectURL = vi.fn(() => 'blob:fake-audio')
    const revokeObjectURL = vi.fn()
    vi.spyOn(URL, 'createObjectURL').mockImplementation(createObjectURL)
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(revokeObjectURL)

    const audio = new FakeAudio()
    const fetchFn = vi.fn(async () => wavResponse())
    const provider = createHttpAudioProvider({
      fetchFn,
      createAudio: () => audio as unknown as HTMLAudioElement,
    })

    const handlers: UtteranceHandlers = {
      onStart: vi.fn(),
      onEnd: vi.fn(),
      onError: vi.fn(),
    }
    const spoken = provider.speak(chunk(), options, handlers)

    await vi.waitFor(() => expect(audio.play).toHaveBeenCalled())
    expect(fetchFn).toHaveBeenCalledWith(
      '/tts/speak',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          text: 'Hallo Welt',
          lang: 'de-DE',
          rate: 1.25,
          volume: 0.8,
        }),
      }),
    )
    expect(audio.playbackRate).toBe(1.25)
    expect(audio.volume).toBe(0.8)
    expect(handlers.onStart).toHaveBeenCalledTimes(1)

    spoken.pause()
    expect(audio.pause).toHaveBeenCalled()
    expect(audio.paused).toBe(true)

    spoken.resume()
    expect(audio.play).toHaveBeenCalledTimes(2)
    expect(audio.paused).toBe(false)

    spoken.cancel()
    expect(audio.pause).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-audio')
    expect(handlers.onError).not.toHaveBeenCalled()
  })

  it('clamps playbackRate to 0.75–2', async () => {
    const audio = new FakeAudio()
    const provider = createHttpAudioProvider({
      fetchFn: async () => wavResponse(),
      createAudio: () => audio as unknown as HTMLAudioElement,
    })
    provider.speak(chunk(), { ...options, rate: 4 }, {})
    await vi.waitFor(() => expect(audio.play).toHaveBeenCalled())
    expect(audio.playbackRate).toBe(2)

    const slow = new FakeAudio()
    const slowProvider = createHttpAudioProvider({
      fetchFn: async () => wavResponse(),
      createAudio: () => slow as unknown as HTMLAudioElement,
    })
    slowProvider.speak(chunk(), { ...options, rate: 0.1 }, {})
    await vi.waitFor(() => expect(slow.play).toHaveBeenCalled())
    expect(slow.playbackRate).toBe(0.75)
  })

  it('reports a retryable error when POST fails', async () => {
    const provider = createHttpAudioProvider({
      fetchFn: async () => new Response('nope', { status: 502 }),
    })
    const onError = vi.fn()
    provider.speak(chunk(), options, { onError })
    await vi.waitFor(() => expect(onError).toHaveBeenCalled())
    expect(onError.mock.calls[0][0]).toMatchObject({
      retryable: true,
      chunkId: '0:0',
      blockIndex: 0,
    })
  })

  it('does not fire onError when cancel aborts an in-flight POST', async () => {
    let release!: (value: Response) => void
    const hung = new Promise<Response>((resolve) => {
      release = resolve
    })
    const provider = createHttpAudioProvider({ fetchFn: () => hung })
    const onError = vi.fn()
    const spoken = provider.speak(chunk(), options, { onError })
    spoken.cancel()
    release(wavResponse())
    await Promise.resolve()
    await Promise.resolve()
    expect(onError).not.toHaveBeenCalled()
  })
})
