import { useEffect, useState } from 'react'

// Phone layout (session 10, approved mockups at 412 × 891): every phone-only
// change sits behind this one width, so laptop, 150% zoom (960 px) and
// monitor layouts never change.
// Session 18 (Hanh, Z Fold8): a short touch screen counts too, so the Fold8
// opened wide (816 × ~530–616) gets the phone layout instead of a cramped
// computer one. Laptops keep a mouse (pointer: fine), so they're unchanged.
export const PHONE_QUERY = '(max-width: 760px), (pointer: coarse) and (max-height: 650px)'

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
