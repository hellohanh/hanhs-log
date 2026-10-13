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
}

/** "English : Local", or whichever part is filled. Each part is title-cased (session 6). */
export function joinName(en: string, local: string): string {
  const e = en.trim() ? titleCase(en.trim()) : ''
  const l = local.trim() ? titleCase(local.trim()) : ''
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
