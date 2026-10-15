import type { Eye } from '../lib/pinRules'
import styles from './EyeButton.module.css'

// The eye at the right of a Places row (session 10): solid = shown, faint =
// some of what's under it shown, crossed = hidden; plain grey while Show all
// pins is on (everything shows; clicking picks just this).
export default function EyeButton({ label, state, onClick }: { label: string; state: Eye; onClick: () => void }) {
  const hidden = state === 'off'
  const verb = state === 'on' ? 'Hide' : 'Show'
  const title = state === 'all' ? `Show only ${label} on the map` : `${verb} ${label} on the map`
  return (
    <button
      type="button"
      className={`${styles.eye} ${styles[state]}`}
      aria-label={title}
      aria-pressed={state === 'on' ? true : state === 'part' ? 'mixed' : false}
      title={title}
      onClick={e => { e.stopPropagation(); onClick() }}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
        {hidden && <path d="M3 3l18 18" />}
      </svg>
    </button>
  )
}
