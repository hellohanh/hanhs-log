import { useEffect, useState } from 'react'

// Extra ☰ items a page offers (session 15, Hanh: on phones, Your trips' own
// actions go in the existing ☰ menu). The page sets them while it's open; the
// phone ☰ shows them under the site's own items.
export interface PageMenuItem {
  label: string
  /** A quiet count after the label, e.g. "3" or "0 left". */
  sub?: string
  onSelect?: () => void
  /** An in-app path, instead of onSelect. */
  to?: string
}
let items: PageMenuItem[] = []
const listeners = new Set<(i: PageMenuItem[]) => void>()
export function setPageMenu(next: PageMenuItem[]) {
  items = next
  listeners.forEach(l => l(items))
}
export function usePageMenu(): PageMenuItem[] {
  const [s, setS] = useState(items)
  useEffect(() => {
    listeners.add(setS)
    return () => { listeners.delete(setS) }
  }, [])
  return s
}
