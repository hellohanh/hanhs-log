// Place names (E72, session 9): every pin and eatery is named
// "English : Local" — the English title, a spaced colon, then the local title
// (Vietnamese with full accents; Japanese as native script with romaji in
// brackets, "明治神宮 (Meiji Jingū)"). A place with only one name keeps just
// that one. The add cards take the two parts in separate boxes.
// CSS-free so tests can import it (L38).

import { titleCase } from './pinCatalog'

export const NAME_SEP = ' : '

export interface NameParts {
  en: string
  local: string
  /**
   * A box holding Google's exact spelling (tapped "Use it", session 14) is
   * saved as is, capitals and all; typing in it clears the flag.
   */
  exact?: { en?: boolean; local?: boolean }
}

/** "English : Local", or whichever part is filled. Each part is title-cased (session 6) unless it's Google's exact spelling. */
export function joinName(en: string, local: string, exact?: NameParts['exact']): string {
  const e = en.trim() ? (exact?.en ? en.trim() : titleCase(en.trim())) : ''
  const l = local.trim() ? (exact?.local ? local.trim() : titleCase(local.trim())) : ''
  return e && l ? `${e}${NAME_SEP}${l}` : e || l
}

/** Any letter outside plain A–Z (an accent, a tone mark, kana, kanji…). */
const LOCAL_LETTER = /[^\u0000-\u007F]/

/**
 * Splits a stored name back into its two boxes. A name saved before the
 * standard (or straight from Google) has no " : ": it goes in Local when it
 * has accented or non-Latin letters, else in English.
 */
export function splitName(name: string | null | undefined): NameParts {
  const n = (name ?? '').trim()
  const i = n.indexOf(NAME_SEP)
  if (i >= 0) return { en: n.slice(0, i).trim(), local: n.slice(i + NAME_SEP.length).trim() }
  return LOCAL_LETTER.test(n) ? { en: '', local: n } : { en: n, local: '' }
}

/**
 * The pin popup's two lines (session 11): the English name (bold) over the
 * local name; a place with only one name shows it as the main line.
 */
export function popupLines(name: string): [string, string | null] {
  const { en, local } = splitName(name)
  return en ? [en, local || null] : [local, null]
}

/** Letters only, no accents or capitals: "Bánh Xèo 46A" → "banh xeo 46a". */
export function plainName(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd').toLocaleLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Google's spelling to suggest under a name box (session 14): when a box holds
 * the same name as Google's, but with different accents or capitals, offer
 * Google's exact text. Returns which box, or null when nothing to suggest.
 */
export function googleSuggestion(parts: NameParts, google: string | null | undefined): { side: 'en' | 'local'; text: string } | null {
  const g = (google ?? '').trim()
  if (!g) return null
  for (const side of ['local', 'en'] as const) {
    const typed = parts[side].trim()
    if (!typed || plainName(typed) !== plainName(g)) continue
    const saved = parts.exact?.[side] ? typed : titleCase(typed)
    return saved === g ? null : { side, text: g }
  }
  return null
}
