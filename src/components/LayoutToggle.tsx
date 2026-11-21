import { isTouch, useLayoutToggle } from '../lib/usePhone'
import styles from './LayoutToggle.module.css'

// Desktop / mobile layout toggle (session 19, Hanh). The control always shows
// where a tap takes you: in the mobile layout it offers Desktop (a monitor);
// in the desktop layout it offers Mobile (a phone). Two surfaces share it — a
// floating icon on touch devices (below) and a ☰ menu item (TargetLabel).

/** A monitor on a stand — the desktop layout. */
export function DesktopIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="12" rx="2" /><path d="M9 20h6M12 16v4" />
    </svg>
  )
}

/** A phone with its home indicator — the mobile layout. */
export function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="7" y="3" width="10" height="18" rx="2" /><path d="M11 18h2" />
    </svg>
  )
}

/** Where a tap takes you: the opposite layout to the one in force. */
export function layoutTarget(phone: boolean): { label: string; title: string; Icon: () => React.ReactElement } {
  return phone
    ? { label: 'Desktop', title: 'Switch to desktop layout', Icon: DesktopIcon }
    : { label: 'Mobile', title: 'Switch to mobile layout', Icon: PhoneIcon }
}

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h12M13 6l6 6-6 6" />
    </svg>
  )
}

/** The floating icon: touch devices only, every page, either layout. */
export default function LayoutToggle() {
  const { phone, flip } = useLayoutToggle()
  if (!isTouch()) return null
  const t = layoutTarget(phone)
  return (
    <button type="button" className={styles.float} onClick={flip} aria-label={t.title} title={t.title}>
      <Arrow />
      <t.Icon />
    </button>
  )
}
