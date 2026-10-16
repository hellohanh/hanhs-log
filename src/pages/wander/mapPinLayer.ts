// HTML pins on a Google Maps overlay, so they look the same on the flat and
// the tilt map. Each pin's point sits exactly on its place; clicking opens its
// card. Shared by the trip map (TripMap) and the Savorlog map (SavorMap).
// Session 11: pins that crowd together merge into a numbered bubble
// (lib/pinClusters); tapping one glides the map in until its pins separate.

import { bubbleSize, clusterPins } from '../../lib/pinClusters'
import { glideTo } from '../../lib/glide'

export const BUBBLE_RED = '#9E2A2B'

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
  /** Never merges into a bubble (the Day route's stops). */
  keepApart?: boolean
}

export interface PinLayer {
  setPins(pins: MapPin[]): void
  setMap(map: google.maps.Map | null): void
}

// Made only once Google's code has loaded (google.maps doesn't exist before).
export function makePinLayer(onClick: (id: string) => void, pinClass: string): PinLayer {
  class Layer extends google.maps.OverlayView {
    private els = new Map<string, HTMLDivElement>()
    private bubbles: HTMLDivElement[] = []
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
      const at = new Map<string, { x: number; y: number }>()
      for (const p of this.pins) {
        const el = this.els.get(p.id)
        const pt = proj.fromLatLngToDivPixel(new google.maps.LatLng(p.lat, p.lng))
        if (!el || !pt) continue
        at.set(p.id, pt)
        el.style.left = `${pt.x - p.width / 2}px`
        el.style.top = `${pt.y - p.height}px`
      }
      // Bubbles: cluster by where each pin's point sits on screen.
      const zoom = (this.getMap() as google.maps.Map | null)?.getZoom?.() ?? 21
      const { singles, groups } = clusterPins(
        this.pins.filter(p => at.has(p.id)).map(p => ({ id: p.id, ...at.get(p.id)!, faded: p.faded, keepApart: p.keepApart })),
        zoom
      )
      for (const id of singles) this.els.get(id)!.style.display = ''
      for (const g of groups) for (const id of g.ids) this.els.get(id)!.style.display = 'none'
      this.drawBubbles(groups)
    }

    private drawBubbles(groups: { ids: string[]; x: number; y: number; faded: boolean }[]) {
      const pane = this.getPanes()?.overlayMouseTarget
      if (!pane) return
      while (this.bubbles.length > groups.length) this.bubbles.pop()!.remove()
      groups.forEach((g, i) => {
        let el = this.bubbles[i]
        if (!el) {
          el = document.createElement('div')
          el.className = this.pinClass
          el.dataset.bubble = '1'
          el.setAttribute('role', 'button')
          el.tabIndex = 0
          const open = (e: Event) => { e.stopPropagation(); this.openBubble(el!) }
          el.addEventListener('click', open)
          el.addEventListener('keydown', e => { if ((e as KeyboardEvent).key === 'Enter') open(e) })
          google.maps.OverlayView.preventMapHitsAndGesturesFrom(el)
          pane.appendChild(el)
          this.bubbles[i] = el
        }
        const size = bubbleSize(g.ids.length)
        el.dataset.ids = g.ids.join(',')
        el.textContent = String(g.ids.length)
        el.title = `${g.ids.length} places here. Click to zoom in`
        el.setAttribute('aria-label', el.title)
        Object.assign(el.style, {
          left: `${g.x - size / 2}px`,
          top: `${g.y - size / 2}px`,
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '50%',
          background: BUBBLE_RED,
          border: '3px solid #FFFFFF',
          boxSizing: 'border-box',
          boxShadow: '0 1px 4px rgba(0, 0, 0, 0.3)',
          color: '#FFFFFF',
          font: `700 ${size >= 40 ? 15 : 13}px "Segoe UI", system-ui, sans-serif`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: g.faded ? '0.1' : '1',
          zIndex: g.faded ? '0' : '2'
        })
      })
    }

    // Glide in until the bubble's pins separate (street level at most).
    private openBubble(el: HTMLDivElement) {
      const map = this.getMap() as google.maps.Map | null
      const ids = new Set((el.dataset.ids ?? '').split(','))
      const ps = this.pins.filter(p => ids.has(p.id))
      if (!map || ps.length === 0) return
      const south = Math.min(...ps.map(p => p.lat))
      const north = Math.max(...ps.map(p => p.lat))
      const west = Math.min(...ps.map(p => p.lng))
      const east = Math.max(...ps.map(p => p.lng))
      const zoom = map.getZoom() ?? 0
      glideTo(map, { bounds: { south, west, north, east }, pad: 80, maxZoom: Math.max(zoom + 1, 16) })
    }

    onRemove() {
      for (const el of this.els.values()) el.remove()
      this.els.clear()
      for (const el of this.bubbles) el.remove()
      this.bubbles = []
    }
  }
  return new Layer(onClick, pinClass)
}
