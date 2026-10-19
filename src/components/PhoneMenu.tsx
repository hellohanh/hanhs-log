import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useTheme } from '../lib/theme'
import styles from './PhoneMenu.module.css'

// The ☰ menu on phones (session 10, approved): Wanderlog, Savorlog, dark /
// light mode and Sign in / out, so the header is one slim row. Closes on a
// tap outside, Escape, or picking an item.
export default function PhoneMenu() {
  const { session, signOut } = useAuth()
  const { isDark, toggle } = useTheme()
  const [open, setOpen] = useState(false)
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
