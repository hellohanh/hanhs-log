// HTML pins on a Google Maps overlay, so they look the same on the flat and
// the tilt map. Each pin's point sits exactly on its place; clicking opens its
// card. Shared by the trip map (TripMap) and the Savorlog map (SavorMap).

/** One pin drawn by lib/pinDraw (its point at the bottom centre). */
export interface MapPin {
  id: string
  lat: number
  lng: number
  title: string
  html: string
  width: number
  height: number
  /** Faded to 10% (Show all off, or filtered out). */
  faded: boolean
}

export interface PinLayer {
  setPins(pins: MapPin[]): void
  setMap(map: google.maps.Map | null): void
}

// Made only once Google's code has loaded (google.maps doesn't exist before).
export function makePinLayer(onClick: (id: string) => void, pinClass: string): PinLayer {
  class Layer extends google.maps.OverlayView {
    private els = new Map<string, HTMLDivElement>()
    private pins: MapPin[] = []

    constructor(private onClick: (id: string) => void, private pinClass: string) {
      super()
    }

    setPins(pins: MapPin[]) {
      this.pins = pins
      this.sync()
    }

    onAdd() {
      this.sync()
    }

    private sync() {
      const pane = this.getPanes()?.overlayMouseTarget
      if (!pane) return
      const keep = new Set(this.pins.map(p => p.id))
      for (const [id, el] of this.els) if (!keep.has(id)) { el.remove(); this.els.delete(id) }
      for (const p of this.pins) {
        let el = this.els.get(p.id)
        if (!el) {
          el = document.createElement('div')
          el.className = this.pinClass
          el.setAttribute('role', 'button')
          el.tabIndex = 0
          const id = p.id
          el.addEventListener('click', e => { e.stopPropagation(); this.onClick(id) })
          el.addEventListener('keydown', e => { if ((e as KeyboardEvent).key === 'Enter') this.onClick(id) })
          google.maps.OverlayView.preventMapHitsAndGesturesFrom(el)
          pane.appendChild(el)
          this.els.set(p.id, el)
        }
        if (el.dataset.html !== p.html) {
          el.innerHTML = p.html
          el.dataset.html = p.html
        }
        el.title = p.title
        el.setAttribute('aria-label', p.title)
        el.style.width = `${p.width}px`
        el.style.height = `${p.height}px`
        el.style.opacity = p.faded ? '0.1' : '1'
        el.style.zIndex = p.faded ? '0' : '1'
      }
      this.draw()
    }

    draw() {
      const proj = this.getProjection()
      if (!proj) return
      for (const p of this.pins) {
        const el = this.els.get(p.id)
        const pt = proj.fromLatLngToDivPixel(new google.maps.LatLng(p.lat, p.lng))
        if (!el || !pt) continue
        el.style.left = `${pt.x - p.width / 2}px`
        el.style.top = `${pt.y - p.height}px`
      }
    }

    onRemove() {
      for (const el of this.els.values()) el.remove()
      this.els.clear()
    }
  }
  return new Layer(onClick, pinClass)
}
