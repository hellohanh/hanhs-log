import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { inviteKind } from '../../lib/inviteLink'
import styles from './ShareDialog.module.css'

// Join with a link (session 15, approved mockup): an iPhone home-screen app
// keeps its own sign-in apart from Safari, and a link tapped in Messages
// always opens in Safari. Pasting the invite here opens it inside this app,
// where the usual invite page joins (a trip, several trips, or the family).
export default function JoinLinkDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const navigate = useNavigate()
  const [text, setText] = useState('')
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])
  const kind = inviteKind(text)
  return (
    <dialog ref={ref} className={`segoe ${styles.dialog} ${styles.small}`} aria-labelledby="join-link-title" onClose={onClose}>
      <form
        method="dialog"
        onSubmit={e => {
          e.preventDefault()
          if (!kind) return
          ref.current?.close()
          navigate(kind.path)
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <h2 id="join-link-title" className={styles.title}>Join with a link</h2>
        <p className={styles.help} style={{ margin: 0 }}>
          Paste the invite link someone sent you (a trip, several trips, or the Savorlog family). You'll join right here, in this app.
        </p>
        <textarea
          aria-label="Invite link"
          autoFocus
          rows={3}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="https://hellohanh.github.io/hanhs-log/wander/join/…"
          className={styles.linkInput}
          style={{ resize: 'none', wordBreak: 'break-all' }}
        />
        {text.trim() && (
          <p role="status" style={{ margin: 0, fontSize: 14, color: kind ? 'var(--ok, #3E9A4A)' : 'var(--accent)' }}>
            {kind ? `✓ ${kind.label}` : "That isn't a Hanh's Log invite link. Copy the whole link from the message and paste it here."}
          </p>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-quiet" onClick={() => ref.current?.close()}>Cancel</button>
          <button type="submit" className="btn" disabled={!kind}>Join</button>
        </div>
      </form>
    </dialog>
  )
}
