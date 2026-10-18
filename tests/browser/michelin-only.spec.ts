import { test, expect } from '@playwright/test'
import { michelinHidden } from '../../src/lib/pinRules'

// Session 14: the MICHELIN chip hides non-MICHELIN pins from the map (so the
// numbered bubbles count MICHELIN places only), except the pin being edited
// and the Day route's own stops.
test('the MICHELIN chip hides, not fades', () => {
  const off = { editing: false, otdPins: null, michelinOnly: false }
  const on = { ...off, michelinOnly: true }
  expect(michelinHidden({ id: 'a', michelin: null }, off)).toBe(false)
  expect(michelinHidden({ id: 'a', michelin: null }, on)).toBe(true)
  expect(michelinHidden({ id: 'b', michelin: 'bib' }, on)).toBe(false)
  expect(michelinHidden({ id: 'c', michelin: 'mentioned' }, on)).toBe(false)
  expect(michelinHidden({ id: 'd', michelin: '2' }, on)).toBe(false)
  expect(michelinHidden({ id: 'a', michelin: null }, { ...on, editing: true })).toBe(false)
  expect(michelinHidden({ id: 'a', michelin: null }, { ...on, otdPins: new Set(['a']) })).toBe(false)
  expect(michelinHidden({ id: 'x', michelin: null }, { ...on, otdPins: new Set(['a']) })).toBe(true)
})
