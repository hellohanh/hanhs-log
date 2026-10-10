import { useEffect, useRef, useState, type FormEvent } from 'react'
import { saveMyName } from '../../lib/trips'
import styles from './ShareDialog.module.css'

// Asked once, when someone opens a trip without a first name yet (including
// guests who just joined by link). Nobody sees anyone's email.
export default function NamePrompt({
  userId,
  onSaved,
  onLater
}: {
  userId: string
  onSaved: (name: string) => void
  onLater: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const n = name.trim()
    if (!n) return setError('Type a first name.')
    setSaving(true)
    try {
      await saveMyName(userId, n)
      ref.current?.close()
      onSaved(n)
    } catch (err) {
      setError(`Couldn't save: ${(err as Error).message}`)
      setSaving(false)
    }
  }

  return (
    <dialog ref={ref} className={`segoe ${styles.dialog} ${styles.small}`} aria-labelledby="name-title" onCancel={onLater}>
      <form onSubmit={submit} className={styles.nameForm}>
        <h2 id="name-title" className={styles.title}>What should people call you?</h2>
        <p className={styles.help}>Your first name is shown to the people on your trips. Nobody sees your email.</p>
        <label htmlFor="first-name" className={styles.label}>First name</label>
        <input id="first-name" className={styles.linkInput} value={name} maxLength={40} onChange={e => setName(e.target.value)} autoFocus />
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.buttons}>
          <button type="submit" className="btn" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          <button type="button" className="btn btn-quiet" onClick={() => { ref.current?.close(); onLater() }}>Later</button>
        </div>
      </form>
    </dialog>
  )
}
