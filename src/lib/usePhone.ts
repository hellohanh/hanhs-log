import { useEffect, useState } from 'react'

// Phone layout (session 10, approved mockups at 412 × 891): every phone-only
// change sits behind this one width, so laptop, 150% zoom (960 px) and
// monitor layouts never change.
export const PHONE_QUERY = '(max-width: 760px)'

// Session 19 (Hanh): a per-device override of the automatic choice — a toggle
// (a floating icon and a ☰ menu item) flips the whole app between the desktop
// and mobile layouts. It's for tablets and the Z Fold 8 open in landscape,
// where the automatic layout may not be the one you want. Unset = automatic,
// and the choice is remembered on this device only.
export type LayoutPref = 'desktop' | 'mobile'
const PREF_KEY = 'hanhs-log-layout'
const prefListeners = new Set<() => void>()

export function readLayoutPref(): LayoutPref | null {
  try {
    const v = localStorage.getItem(PREF_KEY)
    return v === 'desktop' || v === 'mobile' ? v : null
  } catch {
    return null
  }
}

export function setLayoutPref(v: LayoutPref | null) {
  try {
    if (v) localStorage.setItem(PREF_KEY, v)
    else localStorage.removeItem(PREF_KEY)
  } catch {
    /* private mode: the choice just doesn't stick */
  }
  prefListeners.forEach(l => l())
}

/** The automatic answer from the screen, before any override. */
function autoPhone(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(PHONE_QUERY).matches
}

/** The layout in force: the override if the device has set one, else automatic. */
export function isPhone(): boolean {
  const pref = readLayoutPref()
  return pref ? pref === 'mobile' : autoPhone()
}

/** True while the mobile layout is in force; follows rotation, resizing and the toggle. */
export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(isPhone)
  useEffect(() => {
    const update = () => setPhone(isPhone())
    const mq = typeof window.matchMedia === 'function' ? window.matchMedia(PHONE_QUERY) : null
    mq?.addEventListener('change', update)
    prefListeners.add(update)
    update()
    return () => {
      mq?.removeEventListener('change', update)
      prefListeners.delete(update)
    }
  }, [])
  return phone
}

/** A touch device (no fine pointer): where the layout toggle is offered. */
export function isTouch(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
}

/** The layout toggle: the layout in force, and a flip to the other one. */
export function useLayoutToggle(): { phone: boolean; flip: () => void } {
  const phone = useIsPhone()
  return { phone, flip: () => setLayoutPref(phone ? 'desktop' : 'mobile') }
}
