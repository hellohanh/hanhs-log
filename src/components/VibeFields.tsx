import { VIBES, type Vibes } from '../lib/vibe'
import styles from './VibeFields.module.css'

// The standalone "Vibe" box on the add / edit cards (session 14): nine ticks
// in Hanh's two-column layout, any number ticked together.
export default function VibeFields({ value, onChange, className }: {
  value: Vibes
  onChange: (next: Vibes) => void
  /** The card's own box style (its `.group`). */
  className?: string
}) {
  return (
    <fieldset className={className}>
      <legend>Vibe</legend>
      <div className={styles.grid}>
        {VIBES.map(v => (
          <label key={v.key} className={styles.tick}>
            <input
              type="checkbox"
              aria-label={v.label}
              checked={value[v.key]}
              onChange={e => onChange({ ...value, [v.key]: e.target.checked })}
            />
            <span>{v.lines.map((l, i) => <span key={i} className={styles.line}>{l}</span>)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
