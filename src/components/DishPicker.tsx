import { useState, type KeyboardEvent } from 'react'
import { byLabel, titleCase, type Sub } from '../lib/pinCatalog'
import { addCustomDish, useCustomDishes } from '../lib/customDishes'
import styles from './DishPicker.module.css'

// The Main dish menu (A–Z) with "+ Add a new dish…" (session 14, approved
// mockup): typing a dish adds it to this cuisine's list only, shared with
// everyone who sees the catalogue, and picks it.
const ADD = '__add'

export default function DishPicker({ cuisine, value, onChange }: {
  cuisine: Sub
  value: string
  onChange: (key: string) => void
}) {
  useCustomDishes()
  const [adding, setAdding] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const leaves = [...(cuisine.leaves ?? [])].sort(byLabel)

  async function add() {
    setBusy(true)
    setError('')
    try {
      const key = await addCustomDish(cuisine.key, typed)
      onChange(key)
      setAdding(false)
      setTyped('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); if (typed.trim()) void add() }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setAdding(false) }
  }

  if (adding) {
    const shown = typed.trim() ? titleCase(typed.trim()) : ''
    return (
      <div className={styles.add}>
        <input aria-label="New dish" autoFocus value={typed} maxLength={80} placeholder="Type the dish" onChange={e => setTyped(e.target.value)} onKeyDown={onKey} />
        {shown && <p className={styles.hint}>Adds to {cuisine.label} as: <b>{shown}</b></p>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.buttons}>
          <button type="button" className="btn" disabled={busy || !typed.trim()} onClick={() => void add()}>{busy ? 'Adding…' : 'Add'}</button>
          <button type="button" className="btn btn-quiet" onClick={() => { setAdding(false); setError('') }}>Cancel</button>
        </div>
      </div>
    )
  }
  return (
    <select aria-label="Main dish" value={value} onChange={e => (e.target.value === ADD ? setAdding(true) : onChange(e.target.value))}>
      <option value="">Main dish (optional)</option>
      {leaves.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
      <option value={ADD}>+ Add a new dish…</option>
    </select>
  )
}
