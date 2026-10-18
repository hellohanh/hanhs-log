import { googleSuggestion, joinName, type NameParts } from '../lib/placeName'
import styles from './NameFields.module.css'

// The two name boxes on the add / edit cards (E72, approved mockup session 9):
// English title and Local title, saved as "English : Local".
// Session 14 (approved mockup): when Google spells the same name differently
// (accents or capitals), a line under that box offers Google's spelling;
// "Use it" puts Google's exact text in the box, kept as is on save.
export default function NameFields({
  value,
  onChange,
  fieldClass,
  hintClass,
  google
}: {
  value: NameParts
  onChange: (v: NameParts) => void
  fieldClass: string
  hintClass: string
  /** Google's name for this place, when known. */
  google?: string | null
}) {
  const saved = joinName(value.en, value.local, value.exact)
  const sug = googleSuggestion(value, google)
  const type = (side: 'en' | 'local', text: string) =>
    onChange({ ...value, [side]: text, exact: { ...value.exact, [side]: false } })
  const suggestion = (side: 'en' | 'local') =>
    sug?.side === side && (
      <span className={styles.sug} role="status">
        Google spells it: <b>{sug.text}</b> ·{' '}
        <button type="button" className={styles.use} aria-label={`Use Google's spelling: ${sug.text}`}
          onClick={() => onChange({ ...value, [side]: sug.text, exact: { ...value.exact, [side]: true } })}>
          Use it
        </button>
      </span>
    )
  return (
    <>
      <label className={fieldClass}>
        English title
        <input value={value.en} onChange={e => type('en', e.target.value)} maxLength={150} />
        {suggestion('en')}
      </label>
      <label className={fieldClass}>
        Local title
        <input value={value.local} onChange={e => type('local', e.target.value)} maxLength={150} />
        {suggestion('local')}
      </label>
      <p className={hintClass}>
        Leave one empty if the place has only one name. Japan: native script, then romaji in brackets.
        <br />
        Saves as: <strong>{saved || '—'}</strong>
      </p>
    </>
  )
}
