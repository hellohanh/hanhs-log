import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useIsPhone } from '../lib/usePhone'
import styles from './UpdateNotice.module.css'

// "A new version of Hanh's Log is ready · Reload" (session 13, E103, mockup
// approved). The app checks for a new deploy each time you come back to it
// (tab or app becomes visible again); a new version then waits until you
// press Reload, so nothing half-typed is lost. ✕ hides the bar until the
// next return. Fixes having to refresh several times after a merge (L54).
export default function UpdateNotice() {
  const phone = useIsPhone()
  const [hidden, setHidden] = useState(false)
  const [reg, setReg] = useState<ServiceWorkerRegistration | null>(null)
  const {
    needRefresh: [needRefresh],
    updateServiceWorker
  } = useRegisterSW({ onRegisteredSW: (_url, r) => { if (r) setReg(r) } })

  useEffect(() => {
    if (!reg) return
    const onShow = () => {
      if (document.visibilityState !== 'visible') return
      setHidden(false)
      reg.update().catch(() => {})
    }
    document.addEventListener('visibilitychange', onShow)
    return () => document.removeEventListener('visibilitychange', onShow)
  }, [reg])

  if (!needRefresh || hidden) return null
  return (
    <div className={`${styles.bar} ${phone ? styles.phone : ''}`} role="status">
      <span>{phone ? 'New version ready' : "A new version of Hanh's Log is ready"}</span>
      <button type="button" className={styles.reload} onClick={() => updateServiceWorker(true)}>Reload</button>
      <button type="button" className={styles.x} aria-label="Later" title="Later" onClick={() => setHidden(true)}>✕</button>
    </div>
  )
}
