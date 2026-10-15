import { centreFor } from '../../lib/mapCentre'
import { useEffect, useRef, useState } from 'react'

// The map popup's frame (session 10): one Google InfoWindow per map, opened
// just above the clicked pin's point. React renders PlacePopup into the
// returned element through a portal, so the popup is ordinary page code.
// Shared by the trip map and the Savorlog map.

const PIN_RISE = 46 // the pin's height above its point, so the popup sits over the pin

export function useMapPopup(
  map: google.maps.Map | null,
  at: { lat: number; lng: number } | null,
  onClose: () => void,
  /** Width covered on the right (the itinerary panel). */
  inset = 0
): HTMLDivElement | null {
  const [el, setEl] = useState<HTMLDivElement | null>(null)
  const win = useRef<google.maps.InfoWindow | null>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!map) return
    const div = document.createElement('div')
    const w = new google.maps.InfoWindow({ content: div, headerDisabled: true, disableAutoPan: true, pixelOffset: new google.maps.Size(0, -PIN_RISE), maxWidth: 360 })
    const l = w.addListener('closeclick', () => closeRef.current())
    win.current = w
    setEl(div)
    return () => {
      l.remove()
      w.close()
      win.current = null
      setEl(null)
    }
  }, [map])

  useEffect(() => {
    const w = win.current
    if (!w || !map) return
    if (at) {
      w.setPosition(at)
      w.open({ map, shouldFocus: false })
      // Centre the pin in the visible part (left of the itinerary panel), a
      // little below the middle so the popup above it fits (session 10).
      const h = map.getDiv().clientHeight
      map.panTo(centreFor(at, map.getZoom() ?? 15, inset / 2, h * 0.2))
    } else w.close()
  }, [map, el, at?.lat, at?.lng]) // eslint-disable-line react-hooks/exhaustive-deps

  // A click anywhere outside the popup closes it (Hanh, session 10). A click
  // on another pin closes this one and opens that one.
  const open = Boolean(at)
  useEffect(() => {
    if (!el || !open) return
    const onDown = (e: PointerEvent) => {
      if (!el.contains(e.target as Node)) closeRef.current()
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [el, open])

  return el
}
