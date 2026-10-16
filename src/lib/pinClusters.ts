// Numbered bubbles (Hanh, session 11): pins that crowd together on screen
// merge into one Savorlog-red bubble with a count. Greedy and pure, so tests
// can import it (L38). Full-strength pins seed groups first, so a bubble sits
// where the pins you care about are. Pins marked keepApart (the Day route's
// stops) never merge. At street level (zoom 15+) nothing merges.

export const CLUSTER_RADIUS_PX = 40
export const NO_MERGE_ZOOM = 15

export interface ClusterPoint {
  id: string
  x: number
  y: number
  faded: boolean
  keepApart?: boolean
}

export interface PinGroup {
  ids: string[]
  x: number
  y: number
  /** Faded only when every pin in it is faded. */
  faded: boolean
}

export function clusterPins(points: ClusterPoint[], zoom: number, radius = CLUSTER_RADIUS_PX): { singles: string[]; groups: PinGroup[] } {
  if (zoom >= NO_MERGE_ZOOM) return { singles: points.map(p => p.id), groups: [] }
  const order = [...points].sort((a, b) => Number(a.faded) - Number(b.faded))
  const taken = new Set<string>()
  const singles: string[] = []
  const groups: PinGroup[] = []
  const r2 = radius * radius
  for (const seed of order) {
    if (taken.has(seed.id)) continue
    taken.add(seed.id)
    if (seed.keepApart) { singles.push(seed.id); continue }
    const members = [seed]
    for (const p of order) {
      if (taken.has(p.id) || p.keepApart) continue
      const dx = p.x - seed.x
      const dy = p.y - seed.y
      if (dx * dx + dy * dy <= r2) { members.push(p); taken.add(p.id) }
    }
    if (members.length === 1) { singles.push(seed.id); continue }
    groups.push({
      ids: members.map(m => m.id),
      x: members.reduce((s, m) => s + m.x, 0) / members.length,
      y: members.reduce((s, m) => s + m.y, 0) / members.length,
      faded: members.every(m => m.faded)
    })
  }
  return { singles, groups }
}

/** Bubble diameter: grows a little with the count (32 px for 2, up to 52 px). */
export function bubbleSize(count: number): number {
  return Math.round(Math.min(52, 32 + Math.log2(Math.max(2, count)) * 4 - 4))
}
