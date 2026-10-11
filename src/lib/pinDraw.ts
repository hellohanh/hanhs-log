import { MATERIAL_ICONS } from './materialIcons'
import { MICHELIN_RED } from './pinCatalog'

// Drawing a pin (pin standard E28, Q3 and Q4 decided in session 4):
// - a white teardrop with a 1.5 px black outline, its point on the exact
//   spot, a colour disc and a white icon (33 px wide);
// - MICHELIN places (mentioned, Bib Gourmand or starred): 36 px, deep red
//   disc and our own six-petal flower; 1–3 stars in a white chip above;
// - the status badge at the top-right: blank orange for WTG, or for VIS the
//   verdict: green with a white ✓ (revisit), yellow with a black dash
//   (second chance), red with a white ✗ (don't go back).
// Returned as an HTML string so the map markers and the Places panel draw
// exactly the same pin.

export type Badge = 'wtg' | 'revisit' | 'second' | 'no'
export type Michelin = 'mentioned' | '1' | '2' | '3' | null

export const BADGE: Record<Badge, { fill: string; ink: string; label: string }> = {
  wtg: { fill: '#E8862A', ink: '#E8862A', label: 'Want to go' },
  revisit: { fill: '#2F8A3E', ink: '#FFFFFF', label: 'Visited: revisit' },
  second: { fill: '#F2C230', ink: '#111111', label: 'Visited: deserves a 2nd chance' },
  no: { fill: '#C8352F', ink: '#FFFFFF', label: "Visited: don't go back" }
}

// Hanh's own drawings, bundled as text so they can be drawn inside the pin.
const CUSTOM = import.meta.glob('../assets/pin-icons/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const customIcons: Record<string, { viewBox: string; inner: string }> = {}
for (const [path, svg] of Object.entries(CUSTOM)) {
  const name = path.split('/').pop()!.replace('.svg', '')
  const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1] ?? '0 0 160 160'
  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
  customIcons[name] = { viewBox, inner }
}

/** An icon as an <svg> string in white (or `color`), `size` px square. */
export function iconSvg(name: string, size: number, color = '#FFFFFF'): string {
  const c = customIcons[name]
  if (c) return `<svg width="${size}" height="${size}" viewBox="${c.viewBox}" style="color:${color}" aria-hidden="true">${c.inner}</svg>`
  const d = MATERIAL_ICONS[name] ?? MATERIAL_ICONS.location_on
  return `<svg width="${size}" height="${size}" viewBox="0 -960 960 960" fill="${color}" aria-hidden="true"><path d="${d}"/></svg>`
}

const PETAL = 'M50 40 C41 37 35 26 38 13 Q40 8 44 11 L50 17 L56 11 Q60 8 62 13 C65 26 59 37 50 40 Z M50 36 L50 25'

/** Our own six-petal outline flower (never the MICHELIN Guide logo). */
export function flowerSvg(size: number, color = '#FFFFFF'): string {
  const ns = 'vector-effect="non-scaling-stroke"'
  const petals = [0, 60, 120, 180, 240, 300].map(r => `<path d="${PETAL}" transform="rotate(${r} 50 50)" ${ns}/>`).join('')
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" stroke="${color}" stroke-width="1" stroke-linejoin="round" aria-hidden="true">${petals}<circle cx="50" cy="50" r="7" ${ns}/></svg>`
}

export function badgeSvg(b: Badge, size = 13): string {
  const { fill, ink } = BADGE[b]
  const mark =
    b === 'revisit' ? `<path d="M3.8 6.6 5.6 8.4 9.2 4.6" stroke="${ink}" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    : b === 'second' ? `<path d="M3.8 6.5h5.4" stroke="${ink}" stroke-width="1.8" stroke-linecap="round"/>`
    : b === 'no' ? `<path d="M4.4 4.4 8.6 8.6M8.6 4.4 4.4 8.6" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/>`
    : ''
  return `<svg width="${size}" height="${size}" viewBox="0 0 13 13" aria-hidden="true"><circle cx="6.5" cy="6.5" r="5.75" fill="${fill}" stroke="#FFFFFF" stroke-width="1.5"/>${mark}</svg>`
}

export interface PinDrawing {
  color: string
  icon: string
  michelin: Michelin
  badge: Badge
}

/** Size of the drawn pin, including room for the badge and the stars chip. */
export function pinBox(p: Pick<PinDrawing, 'michelin'>) {
  const w = p.michelin ? 36 : 33
  const h = Math.round(w * 1.3)
  const top = p.michelin && p.michelin !== 'mentioned' ? 20 : 6 // stars chip or the badge's overhang
  return { w, h, top, width: w + 12, height: h + top }
}

/**
 * The whole pin as HTML. The pin's point is at the bottom centre of the
 * returned box (left = width / 2, top = height).
 */
export function pinHtml(p: PinDrawing): string {
  const { w, h, top, width, height } = pinBox(p)
  const r = w / 2
  const disc = p.michelin ? 12.5 : 11.5
  const color = p.michelin ? MICHELIN_RED : p.color
  const left = (width - w) / 2
  const icon = p.michelin ? flowerSvg(20) : iconSvg(p.icon, 15)
  const iconSize = p.michelin ? 20 : 15
  const stars = p.michelin && p.michelin !== 'mentioned' ? '★'.repeat(Number(p.michelin)) : ''
  const shape = `M${r} ${h - 1.5} C${r} ${h - 1.5} 2 ${h * 0.62} 2 ${r} A${r - 2} ${r - 2} 0 1 1 ${w - 2} ${r} C${w - 2} ${h * 0.62} ${r} ${h - 1.5} ${r} ${h - 1.5}Z`
  return (
    `<div style="position:relative;width:${width}px;height:${height}px;pointer-events:none">` +
    (stars
      ? `<span style="position:absolute;left:50%;top:0;transform:translateX(-50%);background:#fff;border:1px solid #111;border-radius:999px;padding:0 5px;font:700 11px/16px system-ui,sans-serif;color:#C8102E;white-space:nowrap">${stars}</span>`
      : '') +
    `<svg style="position:absolute;left:${left}px;top:${top}px" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">` +
    `<path d="${shape}" fill="#FFFFFF" stroke="#111111" stroke-width="1.5"/><circle cx="${r}" cy="${r}" r="${disc}" fill="${color}"/></svg>` +
    `<span style="position:absolute;left:${left + r - iconSize / 2}px;top:${top + r - iconSize / 2}px;display:flex">${icon}</span>` +
    `<span style="position:absolute;left:${left + w - 8}px;top:${top - 5}px;display:flex">${badgeSvg(p.badge)}</span>` +
    `</div>`
  )
}
