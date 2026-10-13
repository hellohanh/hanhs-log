import { joinName, type NameParts } from '../lib/placeName'

// The two name boxes on the add / edit cards (E72, approved mockup session 9):
// English title and Local title, saved as "English : Local".
export default function NameFields({
  value,
  onChange,
  fieldClass,
  hintClass
}: {
  value: NameParts
  onChange: (v: NameParts) => void
  fieldClass: string
  hintClass: string
}) {
  const saved = joinName(value.en, value.local)
  return (
    <>
      <label className={fieldClass}>
        English title
        <input value={value.en} onChange={e => onChange({ ...value, en: e.target.value })} maxLength={150} />
      </label>
      <label className={fieldClass}>
        Local title
        <input value={value.local} onChange={e => onChange({ ...value, local: e.target.value })} maxLength={150} />
      </label>
      <p className={hintClass}>
        Leave one empty if the place has only one name. Japan: native script, then romaji in brackets.
        <br />
        Saves as: <strong>{saved || '—'}</strong>
      </p>
    </>
  )
}
