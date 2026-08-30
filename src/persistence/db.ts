import type { Manuscript, ReadingPosition } from '../types'

const DB_NAME = 'ailexsi-word-reader'
const DB_VERSION = 1

export interface StoredHandle {
  fingerprint: string
  handle: FileSystemFileHandle
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('manuscripts')) {
        db.createObjectStore('manuscripts', { keyPath: 'fingerprint' })
      }
      if (!db.objectStoreNames.contains('positions')) {
        db.createObjectStore('positions', { keyPath: 'fingerprint' })
      }
      if (!db.objectStoreNames.contains('handles')) {
        db.createObjectStore('handles', { keyPath: 'fingerprint' })
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB konnte nicht geöffnet werden.'))
  })
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB-Fehler'))
  })
}

export async function saveManuscript(manuscript: Manuscript): Promise<void> {
  const db = await openDb()
  try {
    const tx = db.transaction(['manuscripts', 'meta'], 'readwrite')
    tx.objectStore('manuscripts').put(manuscript)
    tx.objectStore('meta').put(manuscript.fingerprint, 'lastFingerprint')
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

export async function loadManuscript(fingerprint: string): Promise<Manuscript | null> {
  const db = await openDb()
  try {
    return (await reqToPromise(db.transaction('manuscripts').objectStore('manuscripts').get(fingerprint))) ?? null
  } finally {
    db.close()
  }
}

export async function loadLastFingerprint(): Promise<string | null> {
  const db = await openDb()
  try {
    const value = await reqToPromise(
      db.transaction('meta').objectStore('meta').get('lastFingerprint'),
    )
    return typeof value === 'string' ? value : null
  } finally {
    db.close()
  }
}

export async function savePosition(position: ReadingPosition): Promise<void> {
  const db = await openDb()
  try {
    await reqToPromise(db.transaction('positions', 'readwrite').objectStore('positions').put(position))
  } finally {
    db.close()
  }
}

export async function loadPosition(fingerprint: string): Promise<ReadingPosition | null> {
  const db = await openDb()
  try {
    return (await reqToPromise(db.transaction('positions').objectStore('positions').get(fingerprint))) ?? null
  } finally {
    db.close()
  }
}

export async function saveFileHandle(fingerprint: string, handle: FileSystemFileHandle): Promise<void> {
  const db = await openDb()
  try {
    const row: StoredHandle = { fingerprint, handle }
    await reqToPromise(db.transaction('handles', 'readwrite').objectStore('handles').put(row))
  } finally {
    db.close()
  }
}

export async function loadFileHandle(fingerprint: string): Promise<FileSystemFileHandle | null> {
  const db = await openDb()
  try {
    const row = (await reqToPromise(
      db.transaction('handles').objectStore('handles').get(fingerprint),
    )) as StoredHandle | undefined
    return row?.handle ?? null
  } finally {
    db.close()
  }
}

export async function loadLastSession(): Promise<{
  manuscript: Manuscript | null
  position: ReadingPosition | null
}> {
  const fingerprint = await loadLastFingerprint()
  if (!fingerprint) return { manuscript: null, position: null }
  const [manuscript, position] = await Promise.all([
    loadManuscript(fingerprint),
    loadPosition(fingerprint),
  ])
  return { manuscript, position }
}
