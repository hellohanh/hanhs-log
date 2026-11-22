// Live exchange rates for the Conversion page (session 20, Hanh chose
// ExchangeRate-API's open access: no key, ~166 currencies, updated once a
// day; its terms ask for a credit link on the page). Fetched at most once a
// day and kept on this device, so the page works offline with the last rates.

export const RATES_URL = 'https://open.er-api.com/v6/latest/USD'
const KEY = 'hanhs-log-rates'

export interface Rates {
  /** 1 USD = rates[code]. */
  rates: Record<string, number>
  /** When ExchangeRate-API last updated them (ms since 1970). */
  updated: number
  /** When it will next update (ms); fetch again after this. */
  next: number
}

function read(): Rates | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const r = JSON.parse(raw) as Rates
    return r && r.rates && typeof r.updated === 'number' ? r : null
  } catch {
    return null
  }
}

function write(r: Rates) {
  try {
    localStorage.setItem(KEY, JSON.stringify(r))
  } catch {
    /* storage full or blocked: still works for this visit */
  }
}

/** The rates kept on this device, if any (shown at once, before any fetch). */
export function cachedRates(): Rates | null {
  return read()
}

/** Fresh rates if the kept ones are due for an update; otherwise the kept ones.
 *  Offline or on an error, the kept ones (or an error if there are none). */
export async function loadRates(now = Date.now()): Promise<Rates> {
  const kept = read()
  if (kept && now < kept.next && now - kept.updated < 36 * 3600 * 1000) return kept
  try {
    const res = await fetch(RATES_URL)
    if (!res.ok) throw new Error(`rates: ${res.status}`)
    const j = await res.json()
    if (j.result !== 'success' || !j.rates) throw new Error('rates: bad reply')
    const r: Rates = {
      rates: j.rates,
      updated: (j.time_last_update_unix ?? now / 1000) * 1000,
      next: (j.time_next_update_unix ?? now / 1000 + 86400) * 1000
    }
    write(r)
    return r
  } catch (e) {
    if (kept) return kept
    throw e
  }
}
