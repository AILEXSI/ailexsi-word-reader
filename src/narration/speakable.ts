/** Strip pictographs so TTS does not say "rotes Herz". Words stay intact. */
export function toSpokenText(text: string): string {
  let t = text.replace(/\p{Extended_Pictographic}/gu, '')
  t = t.replace(/\uFE0F|\u200D/g, '')
  t = t.replace(/[ \t]+/g, ' ').trim()
  return t
}
