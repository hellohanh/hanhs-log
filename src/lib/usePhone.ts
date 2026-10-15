import { useEffect, useState } from 'react'

// Phone layout (session 10, approved mockups at 412 × 891): every phone-only
// change sits behind this one width, so laptop, 150% zoom (960 px) and
// monitor layouts never change.
export const PHONE_QUERY = '(max-width: 760px)'

export function isPhone(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(PHONE_QUERY).matches
}

/** True while the window is phone-width; follows rotation and resizing. */
export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(isPhone)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(PHONE_QUERY)
    const on = () => setPhone(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return phone
}
