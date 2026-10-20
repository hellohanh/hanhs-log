import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { usePageMenu } from '../lib/pageMenu'
import { useAuth } from '../lib/auth'
import { useTheme } from '../lib/theme'
import styles from './PhoneMenu.module.css'

// The ☰ menu on phones (session 10, approved): Wanderlog, Savorlog, dark /
// light mode and Sign in / out, so the header is one slim row. Closes on a
// tap outside, Escape, or picking an item. Since session 15 it also holds the
// open page's own actions (Your trips: Several-trips links, Invite to several
// trips, Import old pins) and the How-to guide (a plain page, /how-to/).
export default function PhoneMenu() {
  const { session, signOut } = useAuth()
  const { isDark, toggle } = useTheme()
  const [open, setOpen] = useState(false)
  const page = usePageMenu()
  const navigate = useNavigate()
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const down = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', down, true)
    window.addEventListener('keydown', key)
    return () => { document.removeEventListener('pointerdown', down, true); window.removeEventListener('keydown', key) }
  }, [open])

  return (
    <div ref={box} className={styles.wrap}>
      <button type="button" className={styles.burger} aria-label="Menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>
      {open && (
        <nav className={styles.menu} aria-label="Sections">
          <NavLink to="/wander" className={styles.item} onClick={() => setOpen(false)}>Wanderlog</NavLink>
          <NavLink to="/savor" className={styles.item} onClick={() => setOpen(false)}>Savorlog</NavLink>
          <NavLink to="/roam" className={styles.item} onClick={() => setOpen(false)}>Roaminglog</NavLink>
          {page.length > 0 && <hr className={styles.rule} />}
          {page.map(i => (
            <button key={i.label} type="button" className={styles.item} onClick={() => { setOpen(false); if (i.to) navigate(i.to); else i.onSelect?.() }}>
              <span className={styles.label}>{i.label}</span>
              {i.sub && <span className={styles.sub}>{i.sub}</span>}
            </button>
          ))}
          <hr className={styles.rule} />
          {/* A plain page outside the app, so a real link (not a route). */}
          <a href={`${import.meta.env.BASE_URL}how-to/`} className={styles.item} onClick={() => setOpen(false)}>How-to</a>
          <button type="button" className={styles.item} data-testid="theme-toggle" onClick={() => { toggle(); setOpen(false) }}>
            {isDark ? 'Light mode' : 'Dark mode'}
          </button>
          {session ? (
            <button type="button" className={styles.item} onClick={() => { setOpen(false); signOut() }}>Sign out</button>
          ) : (
            <NavLink to="/signin" className={styles.item} onClick={() => setOpen(false)}>Sign in</NavLink>
          )}
        </nav>
      )}
    </div>
  )
}
