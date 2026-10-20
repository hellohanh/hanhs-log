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
// Step 2: a change with no signal waits here (offlineQueue.ts) and is laid
// over every read until it's sent; the yellow line counts what's waiting.

import { applyOps, changedOnly, clashFields, editedId, idsOf, isQueueableWrite, patchFields, sendOutcome, tableOf, withIds, type QueuedOp } from './offlineQueue'

const DB = 'hanhs-log-offline'
const STORE = 'reads'
const QUEUE = 'queue'
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
      const req = indexedDB.open(DB, 2)
      req.onupgradeneeded = () => {
        const d = req.result
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'key' }).createIndex('user', 'user')
        if (!d.objectStoreNames.contains(QUEUE)) d.createObjectStore(QUEUE, { keyPath: 'seq' })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbp
}
async function put(row: Saved | QueuedOp, store = STORE): Promise<void> {
  const d = await db()
  if (!d) return
  await new Promise<void>(resolve => {
    try {
      const tx = d.transaction(store, 'readwrite')
      tx.objectStore(store).put(row)
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
async function del(key: number, store: string): Promise<void> {
  const d = await db()
  if (!d) return
  await new Promise<void>(resolve => {
    try {
      const tx = d.transaction(store, 'readwrite')
      tx.objectStore(store).delete(key)
      tx.oncomplete = tx.onerror = tx.onabort = () => resolve()
    } catch {
      resolve()
    }
  })
}
async function all<T>(store: string): Promise<T[]> {
  const d = await db()
  if (!d) return []
  return new Promise(resolve => {
    try {
      const req = d.transaction(store).objectStore(store).getAll()
      req.onsuccess = () => resolve((req.result as T[]) ?? [])
      req.onerror = () => resolve([])
    } catch {
      resolve([])
    }
  })
}
/** Forget everything saved on this device (sign-out). Waiting changes are
 * sent first if there's a signal; otherwise they're lost with the copy. */
export async function clearOfflineCopy(): Promise<void> {
  await flushQueue()
  const d = await db()
  if (!d) return
  await new Promise<void>(resolve => {
    try {
      const tx = d.transaction([STORE, QUEUE], 'readwrite')
      tx.objectStore(STORE).clear()
      tx.objectStore(QUEUE).clear()
      tx.oncomplete = tx.onerror = tx.onabort = () => resolve()
    } catch {
      resolve()
    }
  })
  queue = []
  emitQueue()
  markOnline()
}

// ---- changes waiting to send (step 2) ----

export interface QueueState {
  /** How many changes are waiting on this device. */
  waiting: number
  /** Ids of the rows they touch, for the "waiting to send" tags. */
  ids: Set<string>
  sending: boolean
  /** Changes the database refused when they were sent (shown, then dismissed). */
  failed: { table: string; message: string }[]
  /** Bumped each time waiting changes were sent, so pages can reload. */
  sentRound: number
  /** When a change was last put aside (shows the "Saved on this phone" note). */
  lastQueuedAt: string | null
  /** Step 3: sending is paused on this change until you pick which one stays. */
  clash: Clash | null
}
export interface Clash {
  table: string
  /** The row's name or title, for the picker's heading. */
  label: string
  fields: { key: string; mine: unknown; theirs: unknown }[]
  mineAt: string
  theirsAt: string | null
  /** Who made the other change (their first name), if known. */
  who: string | null
}
let queue: QueuedOp[] = []
let qstate: QueueState = { waiting: 0, ids: new Set(), sending: false, failed: [], sentRound: 0, lastQueuedAt: null, clash: null }
/** Each row as this device last read it from the database (before its own
 * waiting changes), so a change sent later can tell what someone else did. */
const lastSeen = new Map<string, Record<string, unknown>>()
function remember(path: string, rows: Record<string, unknown>[]) {
  for (const r of rows) if (r && typeof r.id === 'string') lastSeen.set(`${path}:${r.id}`, r)
}
const qlisteners = new Set<(s: QueueState) => void>()
function emitQueue(patch: Partial<QueueState> = {}) {
  const ids = new Set(queue.flatMap(o => o.ids))
  qstate = { ...qstate, ...patch, waiting: queue.length, ids }
  qlisteners.forEach(l => l(qstate))
}
export const queueState = () => qstate
export function onQueueChange(l: (s: QueueState) => void): () => void {
  qlisteners.add(l)
  return () => qlisteners.delete(l)
}
export function dismissFailed() { emitQueue({ failed: [] }) }
let queueLoaded: Promise<void> | null = null
function loadQueue(): Promise<void> {
  queueLoaded ??= all<QueuedOp>(QUEUE).then(q => {
    queue = q.sort((a, b) => a.seq - b.seq)
    emitQueue()
  })
  return queueLoaded
}
let seqN = 0
const nextSeq = () => Date.now() * 1000 + (seqN++ % 1000)
/** The latest sign-in token and key seen, used when sending later. */
let lastHeaders: Record<string, string> = {}

let flushing: Promise<void> | null = null
let sendBase: typeof fetch = (...a) => fetch(...a)
/** Send the waiting changes, oldest first; stop at the first one that can't go yet. */
export function flushQueue(): Promise<void> {
  if (flushing) return flushing
  flushing = (async () => {
    await loadQueue()
    if (queue.length === 0) return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return
    const base = Object.keys(lastHeaders).length ? lastHeaders : null
    if (!base) return
    if (qstate.clash) return // waiting for your pick
    emitQueue({ sending: true })
    const failed = [...qstate.failed]
    let sent = 0
    while (queue.length) {
      const op = queue[0]
      const headers: Record<string, string> = { ...base, 'Content-Type': 'application/json' }
      // Step 3: before sending an edit, see whether someone else changed the
      // same thing since this device last read it; if so, ask (Hanh's choice).
      const id = op.method === 'PATCH' && op.before && op.seq !== resolvedSeq ? editedId(op.search) : null
      if (id) {
        let current: Record<string, unknown> | null | undefined
        try {
          const res = await sendBase(`${apiRoot}${op.path}?id=eq.${encodeURIComponent(id)}&select=*`, { headers: base })
          if (res.status >= 500 || res.status === 401) break
          current = res.ok ? ((await res.json()) as Record<string, unknown>[])[0] ?? null : undefined
        } catch {
          break
        }
        if (current === null) {
          // Removed meanwhile: there's nothing left to edit.
          failed.push({ table: tableOf(op.path), message: 'someone removed it meanwhile' })
          queue.shift()
          await del(op.seq, QUEUE)
          sent++
          continue
        }
        if (current) {
          // Send only what I changed (forms send every field).
          op.body = changedOnly(op.body, op.before)
          if (op.body === '{}') {
            queue.shift()
            await del(op.seq, QUEUE)
            sent++
            continue
          }
          let patch: Record<string, unknown> = {}
          try { patch = JSON.parse(op.body || '{}') } catch { /* nothing to compare */ }
          const keys = clashFields(op.before, current, patch)
          if (keys.length) {
            const who = typeof current.updated_by === 'string' ? await nameOf(current.updated_by, op.user) : null
            emitQueue({
              sending: false, failed,
              clash: {
                table: tableOf(op.path),
                label: String(current.name ?? current.title ?? op.before?.name ?? op.before?.title ?? ''),
                fields: keys.map(k => ({ key: k, mine: patch[k], theirs: current![k] })),
                mineAt: op.createdAt,
                theirsAt: typeof current.updated_at === 'string' ? current.updated_at : null,
                who
              }
            })
            return
          }
        }
      }
      if (op.prefer) headers.Prefer = op.prefer
      let status: number
      let message = ''
      try {
        const res = await sendBase(`${apiRoot}${op.path}${op.search}`, { method: op.method, headers, body: op.method === 'DELETE' ? undefined : op.body })
        status = res.status
        if (!res.ok) message = await res.text().then(t => { try { return (JSON.parse(t) as { message?: string }).message ?? t } catch { return t } }, () => '')
      } catch {
        break // no signal after all
      }
      const outcome = sendOutcome(status)
      if (outcome === 'retry') break
      if (outcome === 'failed') failed.push({ table: tableOf(op.path), message: message || `error ${status}` })
      queue.shift()
      await del(op.seq, QUEUE)
      sent++
    }
    emitQueue({ sending: false, failed, sentRound: sent ? qstate.sentRound + 1 : qstate.sentRound })
  })().finally(() => { flushing = null })
  return flushing
}
let apiRoot = ''
/** The change you just decided on goes without being checked again. */
let resolvedSeq: number | null = null
/** Your pick in the "which one stays?" picker. */
export async function resolveClash(keep: 'mine' | 'theirs'): Promise<void> {
  const op = queue[0]
  const clash = qstate.clash
  if (!op || !clash) return
  if (keep === 'theirs') {
    // Their value stays for the clashing fields; the rest of mine still goes.
    const clashing = new Set(clash.fields.map(f => f.key))
    op.body = patchFields(op.body, k => !clashing.has(k))
    if (op.body === '{}') {
      queue.shift()
      await del(op.seq, QUEUE)
    } else {
      await put(op, QUEUE)
    }
  }
  resolvedSeq = queue[0]?.seq === op.seq ? op.seq : null
  emitQueue({ clash: null })
  await flushQueue()
}
/** A first name for someone, from the trip and Savorlog people saved here. */
async function nameOf(uid: string, me: string): Promise<string | null> {
  if (uid === me) return 'You (on another device)'
  const rows = await all<Saved>(STORE)
  for (const r of rows) {
    if (!/\/rest\/v1\/rpc\/(trip_people|savorlog_people)/.test(r.key)) continue
    try {
      const people = JSON.parse(r.body) as { user_id: string; display_name: string | null }[]
      const p = Array.isArray(people) ? people.find(x => x.user_id === uid) : undefined
      if (p?.display_name) return p.display_name
    } catch { /* skip */ }
  }
  return null
}
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { setTimeout(() => void flushQueue(), 500) })
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

/** Lay the waiting changes for this table over a read's answer. */
async function overlay(res: Response, method: string, url: URL, user: string): Promise<Response> {
  if (method !== 'GET' || !res.ok) return res
  await loadQueue()
  const text = await res.clone().text()
  let data: unknown
  try { data = JSON.parse(text) } catch { return res }
  const single = !Array.isArray(data)
  remember(url.pathname, single ? (data ? [data as Record<string, unknown>] : []) : (data as Record<string, unknown>[]))
  const ops = queue.filter(o => o.user === user && o.path === url.pathname)
  if (ops.length === 0) return res
  const rows = applyOps(single ? (data ? [data as Record<string, unknown>] : []) : (data as Record<string, unknown>[]), url.search, ops)
  const headers = new Headers(res.headers)
  headers.delete('Content-Length')
  return new Response(JSON.stringify(single ? rows[0] ?? null : rows), { status: res.status, headers })
}

const QUEUED_NOTE = 'X-Offline-Waiting'
/** Keep a change on the device to send later; answer as the database would. */
async function enqueue(req: Request, url: URL, user: string): Promise<Response> {
  await loadQueue()
  const method = req.method.toUpperCase() as QueuedOp['method']
  const table = tableOf(url.pathname)
  const body = method === 'DELETE' ? '' : withIds(table, await req.clone().text(), () => crypto.randomUUID())
  const op: QueuedOp = {
    seq: nextSeq(), user, method, path: url.pathname, search: url.search, body,
    prefer: (req.headers.get('Prefer') ?? '').split(',').map(p => p.trim()).filter(p => p.startsWith('resolution=')).join(','),
    createdAt: new Date().toISOString(), ids: idsOf(method, url.search, body)
  }
  const edited = method === 'PATCH' ? editedId(url.search) : null
  if (edited) op.before = lastSeen.get(`${url.pathname}:${edited}`) ?? null
  queue.push(op)
  await put(op, QUEUE)
  emitQueue({ lastQueuedAt: op.createdAt })
  return new Response(null, { status: method === 'POST' ? 201 : 204, headers: { [QUEUED_NOTE]: '1' } })
}

export function makeOfflineFetch(base: typeof fetch = fetch): typeof fetch {
  sendBase = base
  return async (input, init) => {
    const req = new Request(input, init)
    const url = new URL(req.url)
    const method = req.method.toUpperCase()
    if (url.pathname.startsWith('/rest/v1/')) {
      apiRoot = url.origin
      const keep: Record<string, string> = {}
      for (const h of ['apikey', 'Authorization']) { const v = req.headers.get(h); if (v) keep[h] = v }
      if (keep.Authorization) lastHeaders = keep
    }
    if (isQueueableWrite(method, url.pathname)) {
      const user = userOf(req.headers)
      await loadQueue()
      // Waiting changes go first, so a new one waits its turn too.
      if (queue.length > 0 || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
        const res = await enqueue(req, url, user)
        void flushQueue()
        return res
      }
      try {
        return await base(input, init)
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') throw e
        return enqueue(req, url, user) // the signal dropped mid-save
      }
    }
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
      return overlay(new Response(saved.body, { status: saved.status, headers }), method, url, user)
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
          if (queue.length) void flushQueue()
        }
        return overlay(res, method, url, user)
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
