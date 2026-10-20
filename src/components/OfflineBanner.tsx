import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { newPage, offlineState, onOfflineChange, savedLabel } from '../lib/offline'
import styles from './OfflineBanner.module.css'

// The dark offline line across the top (session 15, approved mockup):
// "Offline · showing what was saved Tue 9:42". It shows while any page is
// being answered from the copy saved on this device, and goes once a read
// works again. It sets --offline-h so full-height pages make room for it.
export function useOffline() {
  const [s, setS] = useState(offlineState)
  useEffect(() => onOfflineChange(setS), [])
  return s
}

export default function OfflineBanner() {
  const { offline, savedAt, missing } = useOffline()
  const { pathname } = useLocation()
  useEffect(() => newPage(), [pathname])
  useEffect(() => {
    document.documentElement.style.setProperty('--offline-h', offline ? '34px' : '0px')
  }, [offline])
  if (!offline) return null
  return (
    <div className={styles.line} role="status">
      <span className={styles.dot} aria-hidden="true" />
      {!savedAt
        ? "Offline · this page wasn't saved on this device yet"
        : missing
          ? `Offline · saved ${savedLabel(savedAt)}; parts of this page weren't saved yet`
          : `Offline · showing what was saved ${savedLabel(savedAt)}`}
    </div>
  )
}
