// Offline (session 15, step 1 of 3, approved mockup at 412 × 891): every
// database read is kept on this phone or computer, per person, as it
// happens, so a trip you've opened (and the Munch List and Spot List) still
// shows with no signal: "Offline · showing what was saved Tue 9:42".
// Hanh's choice: trips you've opened (nothing is fetched ahead). Changes made
// offline wait and send later (step 2); clashes are asked about (step 3).
//
// It works under the Supabase client (its fetch), so every page gets it
// without changes: a read that fails for lack of signal is answered from the
// saved copy. Sign-in calls are never kept. Signing out clears the copy.

const DB = 'hanhs-log-offline'
const STORE = 'reads'
/** Read-only database calls that are safe to answer from the saved copy. */
const READ_RPCS = new Set(['trip_people', 'trip_people_counts', 'trip_eateries', 'trip_leg_links', 'savorlog_people', 'savorlog_invite', 'claim_savorlog'])
/** A read waits this long on a weak signal before the saved copy is used. */
const SLOW_MS = 8000

interface Saved { key: string; user: string; body: string; status: number; type: string | null; range: string | null; savedAt: string }

// ---- the offline line's state ----

export interface OfflineState {
  offline: boolean
  /** The oldest saved copy shown on this page. */
  savedAt: string | null
  /** Something on this page had no saved copy yet. */
  missing: boolean
}
let state: OfflineState = { offline: false, savedAt: null, missing: false }
const listeners = new Set<(s: OfflineState) => void>()
function set(next: OfflineState) {
  if (next.offline === state.offline && next.savedAt === state.savedAt && next.missing === state.missing) return
  state = next
  listeners.forEach(l => l(state))
}
export const offlineState = () => state
export function onOfflineChange(l: (s: OfflineState) => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}
function markOffline(savedAt: string | null) {
  // Keep the oldest time shown on screen: that's how old the page could be.
  const was = state.offline ? state : { savedAt: null, missing: false }
  const older = was.savedAt && savedAt ? (was.savedAt < savedAt ? was.savedAt : savedAt) : was.savedAt ?? savedAt
  set({ offline: true, savedAt: older, missing: was.missing || !savedAt })
}
function markOnline() {
  if (state.offline) set({ offline: false, savedAt: null, missing: false })
}
/** A new page: its own reads decide what the offline line says. */
export function newPage() {
  if (state.offline) set({ offline: true, savedAt: null, missing: false })
}

// ---- a tiny IndexedDB store ----

let dbp: Promise<IDBDatabase | null> | null = null
function db(): Promise<IDBDatabase | null> {
  if (dbp) return dbp
  dbp = new Promise(resolve => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null)
      const req = indexedDB.open(DB, 1)
      req.onupgradeneeded = () => {
        const s = req.result.createObjectStore(STORE, { keyPath: 'key' })
        s.createIndex('user', 'user')
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbp
}
async function put(row: Saved): Promise<void> {
  const d = await db()
  if (!d) return
  await new Promise<void>(resolve => {
    try {
      const tx = d.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(row)
      tx.oncomplete = tx.onerror = tx.onabort = () => resolve()
    } catch {
      resolve()
    }
  })
}
async function get(key: string): Promise<Saved | null> {
  const d = await db()
  if (!d) return null
  return new Promise(resolve => {
    try {
      const req = d.transaction(STORE).objectStore(STORE).get(key)
      req.onsuccess = () => resolve((req.result as Saved | undefined) ?? null)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}
/** Forget everything saved on this device (sign-out). */
export async function clearOfflineCopy(): Promise<void> {
  const d = await db()
  if (!d) return
  await new Promise<void>(resolve => {
    try {
      const tx = d.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).clear()
      tx.oncomplete = tx.onerror = tx.onabort = () => resolve()
    } catch {
      resolve()
    }
  })
  markOnline()
}

// ---- the fetch the Supabase client uses ----

/** Who is asking: the signed-in person's id from their token (or "anon"). */
export function userOf(headers: Headers): string {
  const auth = headers.get('Authorization') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '')
  try {
    const part = token.split('.')[1]
    const json = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')))
    return typeof json.sub === 'string' ? json.sub : 'anon'
  } catch {
    return 'anon'
  }
}

/** Is this call a read we may keep and answer from the saved copy? */
export function isSavedRead(method: string, path: string): boolean {
  if (method === 'GET' || method === 'HEAD') return path.startsWith('/rest/v1/') && !path.startsWith('/rest/v1/rpc/')
  if (method === 'POST' && path.startsWith('/rest/v1/rpc/')) return READ_RPCS.has(path.slice('/rest/v1/rpc/'.length))
  return false
}

const OFFLINE_BODY = JSON.stringify({ message: "You're offline, and this wasn't saved on this device yet. Open it once with a connection." })

export function makeOfflineFetch(base: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const req = new Request(input, init)
    const url = new URL(req.url)
    const method = req.method.toUpperCase()
    if (!isSavedRead(method, url.pathname)) return base(input, init)
    const body = method === 'POST' ? await req.clone().text() : ''
    const user = userOf(req.headers)
    // Accept-Profile / Prefer change the answer's shape (count, single row).
    const key = [user, method, url.pathname + url.search, body, req.headers.get('Accept') ?? '', req.headers.get('Prefer') ?? ''].join('\n')

    const fromCopy = async (): Promise<Response> => {
      const saved = await get(key)
      markOffline(saved?.savedAt ?? null)
      if (!saved) return new Response(OFFLINE_BODY, { status: 503, headers: { 'Content-Type': 'application/json' } })
      const headers = new Headers({ 'X-Offline-Copy': saved.savedAt })
      if (saved.type) headers.set('Content-Type', saved.type)
      if (saved.range) headers.set('Content-Range', saved.range)
      return new Response(saved.body, { status: saved.status, headers })
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) return fromCopy()
    let timer: ReturnType<typeof setTimeout> | undefined
    const slow = new Promise<'slow'>(resolve => { timer = setTimeout(() => resolve('slow'), SLOW_MS) })
    const live = base(input, init).then(
      async res => {
        if (res.ok) {
          const text = await res.clone().text()
          void put({ key, user, body: text, status: res.status, type: res.headers.get('Content-Type'), range: res.headers.get('Content-Range'), savedAt: new Date().toISOString() })
          markOnline()
        }
        return res
      },
      (e: unknown) => {
        // Our own cancel (AbortController) isn't "offline".
        if ((e as Error)?.name === 'AbortError') throw e
        return null
      }
    )
    const first = await Promise.race([live, slow])
    clearTimeout(timer)
    if (first === 'slow') {
      // A weak signal: show the saved copy now if there is one; otherwise keep waiting.
      const saved = await get(key)
      if (saved) return fromCopy()
      const late = await live
      return late ?? fromCopy()
    }
    return first ?? fromCopy()
  }
}

/** "Tue 9:42" (24-hour, like the rest of the app) for the offline line. */
export function savedLabel(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const day = d.toLocaleDateString('en-US', { weekday: 'short' })
  return `${day} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}
