import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { fetchTrip } from '../../lib/trips'
import { cachedRates, loadRates, type Rates } from '../../lib/rates'
import { convert, currencyForCountry, currencyName, formatAmount, parseAmount } from '../../lib/currency'
import styles from './ConvertPage.module.css'

// Conversion (session 20, Hanh): the trip's country currency on top, US
// dollars below; typing in either box fills in the other. Opened from a trip
// (☰ → Conversion carries ?trip=<id>) the top box is that trip's currency;
// opened anywhere else it starts blank until Change picks one. Change lasts
// for this visit only. Rates: ExchangeRate-API, once a day, kept on this
// device so the page works offline.

const USD = 'USD'

/** A rate readable at a glance: 26,180 · 151.3 · 0.9241. */
function rateText(n: number): string {
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (n >= 1) return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
  return n.toLocaleString('en-US', { maximumSignificantDigits: 4 })
}

function dayLabel(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function ConvertPage() {
  const [params] = useSearchParams()
  const tripId = params.get('trip')
  const { session } = useAuth()
  const [code, setCode] = useState<string | null>(null)
  const [topText, setTopText] = useState('')
  const [usdText, setUsdText] = useState('')
  const lastEdited = useRef<'top' | 'usd'>('top')
  const [rates, setRates] = useState<Rates | null>(() => cachedRates())
  const [rateError, setRateError] = useState('')
  const [picking, setPicking] = useState(false)
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)

  useEffect(() => {
    let live = true
    loadRates().then(r => { if (live) { setRates(r); setRateError('') } }).catch(() => { if (live) setRateError('none') })
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { live = false; window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  // The trip's country decides the top currency (when opened from a trip).
  useEffect(() => {
    if (!tripId || !session) return
    let live = true
    fetchTrip(tripId).then(t => { if (live && t) setCode(c => c ?? currencyForCountry(t.country)) }).catch(() => {})
    return () => { live = false }
  }, [tripId, session])

  // Recompute the other box when the currency or the rates change.
  useEffect(() => {
    if (!code || !rates) return
    if (lastEdited.current === 'top') {
      const n = parseAmount(topText)
      const v = n === null ? null : convert(n, code, USD, rates.rates)
      setUsdText(v === null ? '' : formatAmount(v, USD))
    } else {
      const n = parseAmount(usdText)
      const v = n === null ? null : convert(n, USD, code, rates.rates)
      setTopText(v === null ? '' : formatAmount(v, code))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, rates])

  const typeTop = (text: string) => {
    lastEdited.current = 'top'
    setTopText(text)
    const n = parseAmount(text)
    const v = n === null || !code || !rates ? null : convert(n, code, USD, rates.rates)
    setUsdText(v === null ? '' : formatAmount(v, USD))
  }
  const typeUsd = (text: string) => {
    lastEdited.current = 'usd'
    setUsdText(text)
    const n = parseAmount(text)
    const v = n === null || !code || !rates ? null : convert(n, USD, code, rates.rates)
    setTopText(v === null ? '' : formatAmount(v, code ?? USD))
  }
  // Tidy the box you just left: 100000 → 100,000.
  const tidy = (which: 'top' | 'usd') => {
    const text = which === 'top' ? topText : usdText
    const c = which === 'top' ? code : USD
    const n = parseAmount(text)
    if (n === null || !c) return
    if (which === 'top') setTopText(formatAmount(n, c))
    else setUsdText(formatAmount(n, c))
  }

  const rateLine = code && rates && rates.rates[code] ? `1 USD = ${rateText(rates.rates[code])} ${code}` : null

  return (
    <main className={`segoe ${styles.page}`}>
      <div className={styles.card}>
        <p className="eyebrow">Hanh's Log</p>
        <h1 className={styles.title}>Conversion</h1>

        <div className={styles.box}>
          <div className={styles.row}>
            <span className={styles.which}>{code ? <><b>{code}</b> · {currencyName(code)}</> : 'No currency picked'}</span>
            <button type="button" className={styles.change} onClick={() => setPicking(true)}>{code ? 'Change' : 'Choose'}</button>
          </div>
          <label htmlFor="conv-top" className="sr-only">{code ? `${currencyName(code)} amount` : 'Amount in the top currency'}</label>
          <input id="conv-top" className={styles.amount} inputMode="decimal" autoComplete="off" value={topText} disabled={!code}
            placeholder={code ? '0' : 'Choose a currency first'} onChange={e => typeTop(e.target.value)} onBlur={() => tidy('top')} />
        </div>

        <div className={styles.swap} aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v18M4 7l4-4 4 4M16 21V3M12 17l4 4 4-4" /></svg>
        </div>

        <div className={styles.box}>
          <div className={styles.row}><span className={styles.which}><b>USD</b> · {currencyName(USD)}</span></div>
          <label htmlFor="conv-usd" className="sr-only">US dollar amount</label>
          <input id="conv-usd" className={styles.amount} inputMode="decimal" autoComplete="off" value={usdText}
            placeholder="0.00" onChange={e => typeUsd(e.target.value)} onBlur={() => tidy('usd')} />
        </div>

        <div className={styles.meta}>
          {rates ? (
            <p>{rateLine ? <>{rateLine} · rates from </> : 'Rates from '}{dayLabel(rates.updated)}{!online && ' (offline: last rates kept on this device)'}</p>
          ) : rateError ? (
            <p role="status">Couldn't get rates. Connect to the internet once; after that this page works offline.</p>
          ) : (
            <p role="status">Getting today's rates…</p>
          )}
          <p><a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer">Rates by ExchangeRate-API</a></p>
        </div>
      </div>

      {picking && <CurrencyPicker codes={rates ? Object.keys(rates.rates) : []} current={code} onPick={c => { setCode(c); setPicking(false) }} onClose={() => setPicking(false)} />}
    </main>
  )
}

function CurrencyPicker({ codes, current, onPick, onClose }: { codes: string[]; current: string | null; onPick: (c: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const list = useMemo(() => codes.filter(c => c !== USD).map(c => ({ c, name: currencyName(c) })).sort((a, b) => a.name.localeCompare(b.name)), [codes])
  const shown = list.filter(i => !q.trim() || `${i.c} ${i.name}`.toLowerCase().includes(q.trim().toLowerCase()))
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])
  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.picker} role="dialog" aria-modal="true" aria-label="Choose a currency" onClick={e => e.stopPropagation()}>
        <div className={styles.pickHead}>
          <input className="field" type="search" autoFocus placeholder="Search: yen, EUR, baht" value={q} onChange={e => setQ(e.target.value)} aria-label="Search currencies" />
          <button type="button" className="btn btn-quiet" onClick={onClose}>Close</button>
        </div>
        {codes.length === 0 ? (
          <p className={styles.empty}>The currency list comes with the rates. Connect to the internet once.</p>
        ) : (
          <ul className={styles.list}>
            {shown.map(i => (
              <li key={i.c}>
                <button type="button" className={`${styles.option} ${i.c === current ? styles.on : ''}`} onClick={() => onPick(i.c)}>
                  <span>{i.name}</span><b>{i.c}</b>
                </button>
              </li>
            ))}
            {shown.length === 0 && <li className={styles.empty}>No currency matches "{q}".</li>}
          </ul>
        )}
      </div>
    </div>
  )
}
