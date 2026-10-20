// Offline step 2 (session 15, approved mockup screen 2): a change made with no
// signal waits on the device and sends itself when the signal returns. Until
// then, the pages show it as if it were saved ("waiting to send"): every read
// of that table gets the waiting changes laid over it. Pure helpers here (no
// browser storage), so the tests can use them directly.

/** A database change waiting to be sent, exactly as the app asked for it. */
export interface QueuedOp {
  seq: number
  user: string
  method: 'POST' | 'PATCH' | 'DELETE'
  /** e.g. /rest/v1/itinerary_stops */
  path: string
  /** The filters, e.g. ?id=eq.123 or ?on_conflict=pin_id,user_id */
  search: string
  body: string
  prefer: string
  createdAt: string
  /** The ids of the rows it adds or changes (for "waiting to send"). */
  ids: string[]
  /** Step 3: the row as this device last saw it, before the change. */
  before?: Record<string, unknown> | null
}

/** Tables a change may wait for offline. Others need a connection. */
export const QUEUE_TABLES = new Set([
  'itinerary_days', 'travel_legs', 'itinerary_activities', 'itinerary_stops', 'itinerary_connectors',
  'pins', 'pin_reviews', 'spots', 'spot_reviews', 'eateries', 'eatery_reviews', 'trips', 'profiles', 'custom_dishes'
])
/** Tables whose rows have a uuid `id`: a new row gets its id on the device. */
export const ID_TABLES = new Set([
  'itinerary_days', 'travel_legs', 'itinerary_activities', 'itinerary_stops', 'itinerary_connectors',
  'pins', 'spots', 'eateries', 'trips', 'custom_dishes'
])

export const tableOf = (path: string) => path.replace(/^\/rest\/v1\//, '')
export function isQueueableWrite(method: string, path: string): boolean {
  if (!['POST', 'PATCH', 'DELETE'].includes(method) || !path.startsWith('/rest/v1/') || path.startsWith('/rest/v1/rpc/')) return false
  return QUEUE_TABLES.has(tableOf(path))
}

type Row = Record<string, unknown>
interface Filter { col: string; op: string; val: string }
const NOT_FILTERS = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'])

/** PostgREST filters from a query string: col=eq.x, col=in.(a,b), col=is.null. */
export function parseFilters(search: string): Filter[] {
  const out: Filter[] = []
  new URLSearchParams(search).forEach((v, col) => {
    if (NOT_FILTERS.has(col)) return
    const dot = v.indexOf('.')
    out.push({ col, op: dot < 0 ? v : v.slice(0, dot), val: dot < 0 ? '' : v.slice(dot + 1) })
  })
  return out
}
function matchOne(row: Row, f: Filter): boolean | null {
  const have = row[f.col]
  const s = have == null ? null : String(have)
  switch (f.op) {
    case 'eq': return s === f.val
    case 'neq': return s !== f.val
    case 'is': return f.val === 'null' ? have == null : f.val === 'true' ? have === true : f.val === 'false' ? have === false : null
    case 'in': {
      const list = f.val.replace(/^\(|\)$/g, '').split(',').map(x => x.replace(/^"|"$/g, ''))
      return s != null && list.includes(s)
    }
    default: return null // not understood: treat as no match
  }
}
/** Does the row pass all of these filters? (Unknown filters: no.) */
export function rowMatches(row: Row, filters: Filter[]): boolean {
  return filters.every(f => matchOne(row, f) === true)
}

function bodyRows(op: QueuedOp): Row[] {
  try {
    const b = JSON.parse(op.body || 'null')
    return Array.isArray(b) ? b : b && typeof b === 'object' ? [b] : []
  } catch {
    return []
  }
}

/** The waiting changes laid over what a read returned. */
export function applyOps(rows: Row[], readSearch: string, ops: QueuedOp[]): Row[] {
  const readFilters = parseFilters(readSearch)
  let out = rows.map(r => ({ ...r }))
  for (const op of ops) {
    const opFilters = parseFilters(op.search)
    if (op.method === 'PATCH') {
      const patch = bodyRows(op)[0] ?? {}
      out = out.map(r => (rowMatches(r, opFilters) ? { ...r, ...patch } : r))
    } else if (op.method === 'DELETE') {
      out = out.filter(r => !rowMatches(r, opFilters))
    } else {
      const conflict = new URLSearchParams(op.search).get('on_conflict')?.split(',').filter(Boolean)
      const merge = /resolution=merge-duplicates/.test(op.prefer)
      const ignore = /resolution=ignore-duplicates/.test(op.prefer)
      for (const r of bodyRows(op)) {
        const same = (x: Row) => (conflict && conflict.length ? conflict.every(c => String(x[c]) === String(r[c])) : r.id != null && x.id === r.id)
        const at = out.findIndex(same)
        if (at >= 0) {
          if (merge) out[at] = { ...out[at], ...r }
          else if (!ignore) out[at] = { ...out[at], ...r }
        } else if (rowMatches(r, readFilters)) {
          out.push({ ...r })
        }
      }
    }
  }
  return out
}

/** The ids a change touches: new rows' ids, or the id it filters on. */
export function idsOf(method: string, search: string, body: string): string[] {
  const ids = new Set<string>()
  if (method === 'POST') {
    try {
      const b = JSON.parse(body || 'null')
      for (const r of Array.isArray(b) ? b : [b]) {
        if (r && typeof r === 'object') {
          if (typeof r.id === 'string') ids.add(r.id)
          for (const k of ['pin_id', 'spot_id', 'eatery_id']) if (typeof r[k] === 'string') ids.add(r[k])
        }
      }
    } catch { /* no ids */ }
  }
  for (const f of parseFilters(search)) if (f.op === 'eq' && (f.col === 'id' || f.col.endsWith('_id'))) ids.add(f.val)
  return [...ids]
}

/** A new row gets its id now, so later offline edits to it can find it. */
export function withIds(table: string, body: string, makeId: () => string): string {
  if (!ID_TABLES.has(table)) return body
  try {
    const b = JSON.parse(body || 'null')
    const add = (r: Row) => (r && typeof r === 'object' && r.id == null ? { ...r, id: makeId() } : r)
    return JSON.stringify(Array.isArray(b) ? b.map(add) : add(b))
  } catch {
    return body
  }
}

/** What to do with an answer when sending a waiting change. */
export function sendOutcome(status: number): 'done' | 'retry' | 'failed' {
  if (status >= 200 && status < 300) return 'done'
  // Signed out meanwhile, too many requests, or the server's trouble: later.
  if (status === 401 || status === 408 || status === 429 || status >= 500) return 'retry'
  return 'failed'
}
