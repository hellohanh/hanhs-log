import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AVATAR_COLORS, initials, inviteUrl, removePerson, resetInvite, saveMyName, todayISO, type Person, type Trip } from '../../lib/trips'
import styles from './ShareDialog.module.css'

// Share & people (approved mockup): the invite link, the owner-only reset,
// and everyone on the trip by first name, with owner-only Remove.
export default function ShareDialog({
  trip,
  people,
  isOwner,
  myName,
  userId,
  onTokenChange,
  onPeopleChange,
  onNameChange,
  onClose
}: {
  trip: Trip
  people: Person[]
  isOwner: boolean
  myName: string | null
  userId: string
  onTokenChange: (token: string) => void
  onPeopleChange: () => void
  onNameChange: (name: string) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [copied, setCopied] = useState(false)
  const [notice, setNotice] = useState('')
  const [renaming, setRenaming] = useState(false)
  const link = inviteUrl(trip.invite_token)

  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      // Clipboard blocked: select the text so Ctrl+C works.
      ;(document.getElementById('invite-link') as HTMLInputElement | null)?.select()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function reset() {
    const ok = window.confirm(
      'Make a new invite link? The current link stops working. People already on the trip keep access.'
    )
    if (!ok) return
    try {
      onTokenChange(await resetInvite(trip.id))
      setNotice('New invite link made. The old one no longer works.')
    } catch (e) {
      setNotice(`Couldn't reset the link: ${(e as Error).message}`)
    }
  }

  async function remove(p: Person) {
    const who = p.display_name ?? 'this person'
    const ok = window.confirm(
      `Remove ${who} from this trip? They lose access right away. They could rejoin with the current invite link, so reset the link too if needed.`
    )
    if (!ok) return
    try {
      await removePerson(trip.id, p.user_id)
      setNotice(`Removed ${who}.`)
      onPeopleChange()
    } catch (e) {
      setNotice(`Couldn't remove ${who}: ${(e as Error).message}`)
    }
  }

  return (
    <dialog ref={ref} className={`segoe ${styles.dialog}`} aria-labelledby="share-title" onClose={onClose}>
      <div className={styles.head}>
        <h2 id="share-title" className={styles.title}>Share &amp; people</h2>
        <button type="button" className={styles.close} aria-label="Close" onClick={() => ref.current?.close()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <section className={styles.section}>
        <label htmlFor="invite-link" className={styles.label}>Invite link</label>
        <p className={styles.help}>
          Anyone with this link can join and edit the trip. They're asked for a first name when they join; no email needed.
        </p>
        <div className={styles.linkRow}>
          <input id="invite-link" readOnly value={link} onFocus={e => e.currentTarget.select()} className={styles.linkInput} />
          <button type="button" className="btn" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
        </div>
        {isOwner && (
          <button type="button" className={styles.textBtn} onClick={reset}>
            Reset link — old links stop working
          </button>
        )}
      </section>

      <section className={`${styles.section} ${styles.people}`}>
        <h3 className={styles.label}>People on this trip · {people.length}</h3>
        <ul className={styles.list}>
          {people.map((p, i) => (
            <li key={p.user_id} className={styles.person} data-testid="person">
              <span className={styles.avatar} style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }} aria-hidden="true">
                {initials(p.display_name)}
              </span>
              <span className={styles.who}>
                <span className={p.is_me ? styles.nameMe : styles.name}>
                  {p.display_name ?? 'No name yet'}{p.is_me && ' (you)'}
                </span>
                <span className={styles.sub}>
                  {[p.is_owner ? 'Owner' : null, joinedLabel(p.joined_at)].filter(Boolean).join(' · ')}
                  {p.is_me && !renaming && (
                    <>
                      {p.is_owner || p.joined_at ? ' · ' : ''}
                      <button type="button" className={styles.inlineBtn} onClick={() => setRenaming(true)}>
                        {p.display_name ? 'change your name' : 'add your name'}
                      </button>
                    </>
                  )}
                </span>
                {p.is_me && renaming && (
                  <RenameForm
                    userId={userId}
                    current={myName ?? ''}
                    onDone={name => {
                      setRenaming(false)
                      if (name) onNameChange(name)
                    }}
                  />
                )}
              </span>
              {isOwner && !p.is_me && (
                <button type="button" className="btn btn-quiet" style={{ minHeight: 40 }} onClick={() => remove(p)}>
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <p className={styles.notice} role="status" aria-live="polite">{notice}</p>
    </dialog>
  )
}

function joinedLabel(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const year = d.getFullYear() !== Number(todayISO().slice(0, 4)) ? `, ${d.getFullYear()}` : ''
  return `Joined ${label}${year}`
}

function RenameForm({ userId, current, onDone }: { userId: string; current: string; onDone: (name: string | null) => void }) {
  const [name, setName] = useState(current)
  const [error, setError] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault()
    const n = name.trim()
    if (!n) return setError('Type a first name.')
    try {
      await saveMyName(userId, n)
      onDone(n)
    } catch (err) {
      setError(`Couldn't save: ${(err as Error).message}`)
    }
  }
  return (
    <form className={styles.rename} onSubmit={submit}>
      <label htmlFor="rename" className="sr-only">Your first name</label>
      <input id="rename" value={name} maxLength={40} onChange={e => setName(e.target.value)} autoFocus />
      <button type="submit" className="btn" style={{ minHeight: 40 }}>Save</button>
      <button type="button" className="btn btn-quiet" style={{ minHeight: 40 }} onClick={() => onDone(null)}>Cancel</button>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </form>
  )
}
