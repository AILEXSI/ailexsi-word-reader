function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let hex = ''
  for (const b of bytes) hex += b.toString(16).padStart(2, '0')
  return hex
}

function fallbackHash(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let h1 = 2166136261
  for (let i = 0; i < bytes.length; i++) {
    h1 ^= bytes[i]
    h1 = Math.imul(h1, 16777619)
  }
  return (h1 >>> 0).toString(16).padStart(8, '0')
}

export async function hashBuffer(buffer: ArrayBuffer): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', buffer)
    return toHex(digest).slice(0, 24)
  }
  return fallbackHash(buffer)
}

export async function documentFingerprint(
  name: string,
  size: number,
  buffer: ArrayBuffer,
): Promise<string> {
  const hash = await hashBuffer(buffer)
  return `${name}|${size}|${hash}`
}
