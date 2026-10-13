import { useState } from 'react'

// The import queue's buttons on the add cards (E71, approved mockup session 9):
// Skip for good (asks first — a skipped place never comes back), ‹ Back, and
// Save and next (the form's submit).
export interface ImportActions {
  onSkip: () => void | Promise<void>
  onBack?: () => void
}

export default function ImportButtons({
  actions,
  busy,
  classes
}: {
  actions: ImportActions
  busy: boolean
  classes: { buttons: string; del: string; confirm: string }
}) {
  const [asking, setAsking] = useState(false)
  const [skipping, setSkipping] = useState(false)
  if (asking) {
    return (
      <div className={classes.confirm} role="alert">
        <span>Skip this place for good? It won't come back.</span>
        <button
          type="button"
          className="btn"
          disabled={skipping}
          onClick={async () => {
            setSkipping(true)
            try {
              await actions.onSkip()
            } finally {
              setSkipping(false)
              setAsking(false)
            }
          }}
        >
          {skipping ? 'Skipping…' : 'Skip'}
        </button>
        <button type="button" className="btn btn-quiet" onClick={() => setAsking(false)}>Keep</button>
      </div>
    )
  }
  return (
    <div className={classes.buttons}>
      <button type="button" className={`btn btn-quiet ${classes.del}`} onClick={() => setAsking(true)} disabled={busy}>Skip for good</button>
      {actions.onBack && <button type="button" className="btn btn-quiet" onClick={actions.onBack} disabled={busy}>‹ Back</button>}
      <button type="submit" className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save and next'}</button>
    </div>
  )
}
