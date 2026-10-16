import { test, expect } from '@playwright/test'
import { existsSync } from 'node:fs'

// Hanh's line-art icons (session 11): every non-food category, group and type
// has its ls_<key>.svg; Nom-Nom has none yet (keeps its current icons).
test('every non-food category, group and type has its line-art icon', async () => {
  const { CATEGORIES, pinLook } = await import('../../src/lib/pinCatalog')
  const missing: string[] = []
  let checked = 0
  for (const c of CATEGORIES) {
    const paths = [{ category: c.key, subcategory: null as string | null, subsubcategory: null as string | null }]
    for (const s of c.subs) {
      paths.push({ category: c.key, subcategory: s.key, subsubcategory: null })
      for (const l of s.leaves ?? []) paths.push({ category: c.key, subcategory: s.key, subsubcategory: l.key })
    }
    for (const p of paths) {
      const art = pinLook(p).art
      if (c.key === 'food') { expect(art).toBeNull(); continue }
      checked++
      if (!art || !existsSync(`src/assets/pin-icons/${art}.svg`)) missing.push(`${p.category}/${p.subcategory}/${p.subsubcategory} → ${art}`)
    }
  }
  expect(missing).toEqual([])
  expect(checked).toBe(46)
})
