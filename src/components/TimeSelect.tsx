import styles from './TimeSelect.module.css'

// 24-hour time entry (Hanh, session 10: "everywhere"): an hour menu 00–23
// and a minute menu in 5s, the same on every computer and phone (the
// browser's own time box shows AM/PM on a US computer). A minute that isn't
// a multiple of 5 (an older entry) stays in the list so it isn't lost.
// value is "" or "HH:MM"; onChange gets the same.

const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'))
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

export default function TimeSelect({
  label,
  value,
  onChange,
  className
}: {
  label: string
  value: string
  onChange: (v: string) => void
  className?: string
}) {
  const [h, m] = value ? value.slice(0, 5).split(':') : ['', '']
  const mins = m && !MINUTES.includes(m) ? [...MINUTES, m].sort() : MINUTES
  return (
    <div className={className} role="group" aria-label={label}>
      <span aria-hidden="true">{label}</span>
      <span className={styles.row}>
        <select aria-label={`${label} hour`} value={h} onChange={e => onChange(e.target.value ? `${e.target.value}:${m || '00'}` : '')}>
          <option value="">--</option>
          {HOURS.map(x => <option key={x} value={x}>{x}</option>)}
        </select>
        <span className={styles.colon} aria-hidden="true">:</span>
        <select aria-label={`${label} minute`} value={m} onChange={e => onChange(`${h || '00'}:${e.target.value || '00'}`)}>
          {!h && <option value="">--</option>}
          {mins.map(x => <option key={x} value={x}>{x}</option>)}
        </select>
      </span>
    </div>
  )
}
