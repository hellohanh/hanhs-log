// Pure helpers for where a trip's map opens (no network), kept apart so
// tests can use them directly.

/** Ho Chi Minh City's centre; the Districts overlay is offered within 20 km of it (E25). */
export const HCMC_CENTRE = { lat: 10.7769, lng: 106.7009 }

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = (d: number) => (d * Math.PI) / 180
  const dLat = r(b.lat - a.lat)
  const dLng = r(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

// ISO 3166 country codes; names come from the browser (Intl.DisplayNames),
// so the Country box can suggest every country without a big hand-typed list.
const CODES = (
  'AD AE AF AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ ' +
  'DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FR GA GB GD GE GH GM GN GQ GR GT GW GY HK HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP ' +
  'KE KG KH KI KM KN KP KR KW KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MO MR MT MU MV MW MX MY MZ NA NE NG NI ' +
  'NL NO NP NR NZ OM PA PE PG PH PK PL PR PS PT PW PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ ' +
  'TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VN VU WS XK YE ZA ZM ZW'
).split(' ')

/** Every country's English name, A to Z. */
export function countryNames(): string[] {
  try {
    const dn = new Intl.DisplayNames(['en'], { type: 'region' })
    return CODES.map(c => dn.of(c) ?? c).sort((a, b) => a.localeCompare(b))
  } catch {
    return []
  }
}
