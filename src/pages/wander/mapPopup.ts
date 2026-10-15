import { useEffect, useRef, useState } from 'react'

// The map popup's frame (session 10): one Google InfoWindow per map, opened
// just above the clicked pin's point. React renders PlacePopup into the
// returned element through a portal, so the popup is ordinary page code.
// Shared by the trip map and the Savorlog map.

const PIN_RISE = 46 // the pin's height above its point, so the popup sits over the pin

export function useMapPopup(
  map: google.maps.Map | null,
  at: { lat: number; lng: number } | null,
  onClose: () => void
): HTMLDivElement | null {
  const [el, setEl] = useState<HTMLDivElement | null>(null)
  const win = useRef<google.maps.InfoWindow | null>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!map) return
    const div = document.createElement('div')
    const w = new google.maps.InfoWindow({ content: div, headerDisabled: true, pixelOffset: new google.maps.Size(0, -PIN_RISE), maxWidth: 320 })
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
    } else w.close()
  }, [map, el, at?.lat, at?.lng]) // eslint-disable-line react-hooks/exhaustive-deps

  return el
}
