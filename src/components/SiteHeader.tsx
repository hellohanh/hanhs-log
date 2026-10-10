import { useEffect, useRef } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useTheme } from '../lib/theme'
import styles from './SiteHeader.module.css'

function SunIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
    </svg>
  )
}

const navClass = ({ isActive }: { isActive: boolean }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)

export default function SiteHeader() {
  const { session, signOut } = useAuth()
  const { isDark, toggle } = useTheme()
  const ref = useRef<HTMLElement>(null)

  // The header wraps to two rows on phones; publish its real height so
  // pinned content (the splash picture) sits just below it.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const publish = () => document.documentElement.style.setProperty('--site-header-h', `${el.offsetHeight}px`)
    publish()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(publish)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <header ref={ref} className={styles.header}>
      <Link to="/" className={styles.wordmark}>
        Hanh's Log
      </Link>
      <nav aria-label="Sections" className={styles.nav}>
        <NavLink to="/wander" className={navClass}>
          Wanderlog
        </NavLink>
        <NavLink to="/savor" className={navClass}>
          Savorlog
        </NavLink>
        <button
          type="button"
          className={styles.iconButton}
          onClick={toggle}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          data-testid="theme-toggle"
        >
          {isDark ? <SunIcon /> : <MoonIcon />}
        </button>
        {session ? (
          <button type="button" className={styles.signIn} onClick={signOut}>
            Sign out
          </button>
        ) : (
          <Link to="/signin" className={styles.signIn}>
            Sign in
          </Link>
        )}
      </nav>
    </header>
  )
}
