// Address, phone and website on every place (session 16, Hanh, approved
// mockup; migration 0026). Each saved value means:
//   null → never saved: show Google's live answer (as before 0026);
//   ''   → cleared on purpose: show nothing, even if Google has one;
//   text → what someone typed, or Google's value kept on Save.
// Pure helpers here so the tests can use them directly.

export type ContactKey = 'address' | 'phone' | 'website'
export const CONTACT_KEYS: ContactKey[] = ['address', 'phone', 'website']
export type Contact = Record<ContactKey, string | null>

/** What the popup shows for one field: the saved value, else Google's; '' hides it. */
export function shownContact(saved: string | null | undefined, google: string | null): string | null {
  if (saved === '') return null
  return saved ?? google
}

/** Where an edit-panel field's value came from (the tag beside its label). */
export type FieldSource = 'saved' | 'google' | 'edited' | 'hidden' | 'none'

export interface ContactField {
  value: string
  source: FieldSource
}

/** A field as the edit panel opens: the saved value, or Google's filled in when never saved. */
export function openField(saved: string | null | undefined, google: string | null): ContactField {
  if (saved === '') return { value: '', source: 'hidden' }
  if (saved != null) return { value: saved, source: 'saved' }
  if (google) return { value: google, source: 'google' }
  return { value: '', source: 'none' }
}

/** After typing in a field. */
export function typedField(value: string): ContactField {
  return { value, source: value.trim() === '' ? 'hidden' : 'edited' }
}

/** What Save stores: text as typed (Google's kept too); a cleared field '' (hide);
 * a field that was empty all along stays null so Google's answer can show later. */
export function savedValue(f: ContactField): string | null {
  const v = f.value.trim()
  if (v) return v
  return f.source === 'hidden' ? '' : null
}

/** "Hidden" only means something when there's an answer to hide or one was saved. */
export const TAG: Record<FieldSource, string | null> = {
  saved: null,
  google: 'from Google',
  edited: 'edited',
  hidden: 'hidden',
  none: null
}

/** A website typed without https:// still opens. */
export function websiteHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

/** Digits and + only, for a tel: link. */
export const telOf = (phone: string) => phone.replace(/[^\d+]/g, '')

// ---- before migration 0026 runs: the columns aren't there yet ----

/** The database doesn't know phone / website yet (0026 waiting). */
export function missingContactColumns(e: { message?: string } | null | undefined): boolean {
  return !!e?.message && /\b(phone|website)\b/.test(e.message)
}

/** The row without phone / website, to save the rest before 0026 runs. */
export function withoutContact<T extends Record<string, unknown>>(row: T): Omit<T, 'phone' | 'website'> {
  const { phone: _p, website: _w, ...rest } = row
  void _p
  void _w
  return rest
}
