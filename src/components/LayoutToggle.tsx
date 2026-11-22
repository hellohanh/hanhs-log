import { isTouch, useLayoutToggle } from '../lib/usePhone'
import styles from './LayoutToggle.module.css'

// Desktop / mobile layout toggle (session 19, Hanh). The control always shows
// where a tap takes you: in the mobile layout it offers Desktop (a monitor);
// in the desktop layout it offers Mobile (a phone). Two surfaces share it — a
// round button in each map's button set (session 20; the floating pill is
// gone) and a ☰ menu item.

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

/** The arrow beside the map button: its tip sits 1.5 px left of the
 *  circle's outer edge (Hanh's rail, session 20). Drawn outside the button,
 *  no background. */
function Arrow() {
  return (
    <svg className={styles.arrow} viewBox="0 0 13 12" width="13" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 6H13M8.5 1.5L13 6L8.5 10.5" />
    </svg>
  )
}

/** The map button (session 20, Hanh): last in each map's button set — the
 *  phone column and the computer row on trip maps, Foodie Finds and the Spot
 *  List. Touch devices only. Takes the map's own round-button class. */
export function MapLayoutButton({ className, row }: { className: string; row?: boolean }) {
  const { phone, flip } = useLayoutToggle()
  if (!isTouch()) return null
  const t = layoutTarget(phone)
  return (
    <button type="button" className={`${className} ${styles.mapBtn} ${row ? styles.inRow : ''}`} onClick={flip} aria-label={t.title} title={t.title}>
      <Arrow />
      <t.Icon />
    </button>
  )
}
