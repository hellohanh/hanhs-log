import { useEffect, useRef } from 'react'

// The phone's back gesture steps back one layer (session 10, approved):
// a full-screen form, then a pin card, then a full sheet, before leaving the
// page. While any layer is open we hold one extra history entry; Back pops
// it and we close the top layer. Closing a layer by tapping pops our entry
// quietly. The router's own state is copied so it sees the same page.
export function useBackStep(active: boolean, layer: string | null, closeTop: () => void): void {
  const held = useRef(false)
  const quiet = useRef(false)
  const closeRef = useRef(closeTop)
  closeRef.current = closeTop

  useEffect(() => {
    if (!active) return
    if (layer && !held.current) {
      window.history.pushState({ ...(window.history.state ?? {}), hlLayer: true }, '')
      held.current = true
    } else if (!layer && held.current) {
      held.current = false
      quiet.current = true
      window.history.back()
    }
  }, [active, layer])

  useEffect(() => {
    if (!active) return
    const onPop = () => {
      if (quiet.current) { quiet.current = false; return }
      if (!held.current) return
      held.current = false
      closeRef.current()
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [active])
}
