// The Conversion page's pure helpers (session 20, Hanh): which currency a
// trip's country uses, how many decimals a currency shows, and turning what
// someone types into a number and back. No network here.
import { COUNTRY_CODES } from './cityName'

// ISO 3166 country code → ISO 4217 currency, for every country in the trip
// form's Country list (COUNTRY_CODES).
const CURRENCY_OF: Record<string, string> = {
  AD:'EUR', AE:'AED', AF:'AFN', AG:'XCD', AL:'ALL', AM:'AMD', AO:'AOA', AR:'ARS', AT:'EUR', AU:'AUD', AZ:'AZN', BA:'BAM',
  BB:'BBD', BD:'BDT', BE:'EUR', BF:'XOF', BG:'BGN', BH:'BHD', BI:'BIF', BJ:'XOF', BN:'BND', BO:'BOB', BR:'BRL', BS:'BSD',
  BT:'BTN', BW:'BWP', BY:'BYN', BZ:'BZD', CA:'CAD', CD:'CDF', CF:'XAF', CG:'XAF', CH:'CHF', CI:'XOF', CL:'CLP', CM:'XAF',
  CN:'CNY', CO:'COP', CR:'CRC', CU:'CUP', CV:'CVE', CY:'EUR', CZ:'CZK', DE:'EUR', DJ:'DJF', DK:'DKK', DM:'XCD', DO:'DOP',
  DZ:'DZD', EC:'USD', EE:'EUR', EG:'EGP', ER:'ERN', ES:'EUR', ET:'ETB', FI:'EUR', FJ:'FJD', FM:'USD', FR:'EUR', GA:'XAF',
  GB:'GBP', GD:'XCD', GE:'GEL', GH:'GHS', GM:'GMD', GN:'GNF', GQ:'XAF', GR:'EUR', GT:'GTQ', GW:'XOF', GY:'GYD', HK:'HKD',
  HN:'HNL', HR:'EUR', HT:'HTG', HU:'HUF', ID:'IDR', IE:'EUR', IL:'ILS', IN:'INR', IQ:'IQD', IR:'IRR', IS:'ISK', IT:'EUR',
  JM:'JMD', JO:'JOD', JP:'JPY', KE:'KES', KG:'KGS', KH:'KHR', KI:'AUD', KM:'KMF', KN:'XCD', KP:'KPW', KR:'KRW', KW:'KWD',
  KZ:'KZT', LA:'LAK', LB:'LBP', LC:'XCD', LI:'CHF', LK:'LKR', LR:'LRD', LS:'LSL', LT:'EUR', LU:'EUR', LV:'EUR', LY:'LYD',
  MA:'MAD', MC:'EUR', MD:'MDL', ME:'EUR', MG:'MGA', MH:'USD', MK:'MKD', ML:'XOF', MM:'MMK', MN:'MNT', MO:'MOP', MR:'MRU',
  MT:'EUR', MU:'MUR', MV:'MVR', MW:'MWK', MX:'MXN', MY:'MYR', MZ:'MZN', NA:'NAD', NE:'XOF', NG:'NGN', NI:'NIO', NL:'EUR',
  NO:'NOK', NP:'NPR', NR:'AUD', NZ:'NZD', OM:'OMR', PA:'PAB', PE:'PEN', PG:'PGK', PH:'PHP', PK:'PKR', PL:'PLN', PR:'USD',
  PS:'ILS', PT:'EUR', PW:'USD', PY:'PYG', QA:'QAR', RO:'RON', RS:'RSD', RU:'RUB', RW:'RWF', SA:'SAR', SB:'SBD', SC:'SCR',
  SD:'SDG', SE:'SEK', SG:'SGD', SI:'EUR', SK:'EUR', SL:'SLE', SM:'EUR', SN:'XOF', SO:'SOS', SR:'SRD', SS:'SSP', ST:'STN',
  SV:'USD', SY:'SYP', SZ:'SZL', TD:'XAF', TG:'XOF', TH:'THB', TJ:'TJS', TL:'USD', TM:'TMT', TN:'TND', TO:'TOP', TR:'TRY',
  TT:'TTD', TV:'AUD', TW:'TWD', TZ:'TZS', UA:'UAH', UG:'UGX', US:'USD', UY:'UYU', UZ:'UZS', VA:'EUR', VC:'XCD', VE:'VES',
  VN:'VND', VU:'VUV', WS:'WST', XK:'EUR', YE:'YER', ZA:'ZAR', ZM:'ZMW', ZW:'ZWG',}

/** The currency of a trip's country, from its English name ("Vietnam" → "VND"); null if unknown. */
export function currencyForCountry(name: string | null | undefined): string | null {
  const want = (name ?? '').trim().toLowerCase()
  if (!want) return null
  try {
    const dn = new Intl.DisplayNames(['en'], { type: 'region' })
    for (const code of COUNTRY_CODES) {
      if ((dn.of(code) ?? '').toLowerCase() === want) return CURRENCY_OF[code] ?? null
    }
  } catch {
    /* no Intl.DisplayNames: fall through */
  }
  return null
}

/** A currency's English name ("VND" → "Vietnamese dong"); the code if unknown. */
export function currencyName(code: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'currency' }).of(code) ?? code
  } catch {
    return code
  }
}

/** How many decimals a currency normally shows (VND 0, USD 2, JPY 0, KWD 3). */
export function decimalsFor(code: string): number {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits ?? 2
  } catch {
    return 2
  }
}

/** What was typed → a number ("100,000" → 100000); null if empty or not a number. */
export function parseAmount(text: string): number | null {
  const clean = text.replace(/[,\s]/g, '')
  if (clean === '' || clean === '.') return null
  const n = Number(clean)
  return Number.isFinite(n) ? n : null
}

/** A number → text with thousands commas and the currency's decimals (100000 → "100,000"). */
export function formatAmount(n: number, code: string): string {
  const d = decimalsFor(code)
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

/** Convert an amount between two currencies using USD-based rates (1 USD = rates[code]). */
export function convert(amount: number, from: string, to: string, rates: Record<string, number>): number | null {
  const a = rates[from]
  const b = rates[to]
  if (!a || !b) return null
  return (amount / a) * b
}
