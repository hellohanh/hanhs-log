import { FormEvent, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

// One results page per city: your trips there and your eateries there.
// The lists fill in once trips (milestone 3) and Savorlog (milestone 4) move over.
export default function Search() {
  const [params] = useSearchParams()
  const city = (params.get('city') ?? '').trim()
  const navigate = useNavigate()
  const [next, setNext] = useState(city)
  const [error, setError] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const c = next.trim()
    if (!c) {
      setError('Enter a city first.')
      return
    }
    navigate(`/search?city=${encodeURIComponent(c)}`)
  }

  return (
    <main className="page">
      <p className="eyebrow">City search</p>
      <h1 style={{ fontSize: 'clamp(40px, 6vw, 64px)', margin: '12px 0 24px' }}>{city || 'Pick a city'}</h1>

      <form role="search" onSubmit={submit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', maxWidth: 560 }}>
        <label htmlFor="city" className="sr-only">City</label>
        <input
          id="city"
          type="search"
          className="field"
          style={{ flex: '1 1 220px', minWidth: 0, width: 'auto' }}
          value={next}
          onChange={e => {
            setNext(e.target.value)
            if (error) setError('')
          }}
          placeholder="Rome, Hanoi, Tokyo"
          autoComplete="off"
        />
        <button type="submit" className="btn" style={{ minHeight: 52 }}>Search</button>
      </form>
      {error && <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--accent)' }}>{error}</p>}

      {city && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 24, marginTop: 48 }}>
          <section className="card" style={{ padding: 28 }} aria-labelledby="trips-title">
            <p className="eyebrow">Wanderlog</p>
            <h2 id="trips-title" style={{ fontSize: 32, margin: '8px 0 12px' }}>Your trips in {city}</h2>
            <p style={{ margin: 0, color: 'var(--muted)' }}>Trips show up here once Wanderlog moves into Hanh's Log.</p>
          </section>
          <section className="card" style={{ padding: 28 }} aria-labelledby="eats-title">
            <p className="eyebrow">Savorlog</p>
            <h2 id="eats-title" style={{ fontSize: 32, margin: '8px 0 12px' }}>Your eateries in {city}</h2>
            <p style={{ margin: 0, color: 'var(--muted)' }}>Eateries within 20 km of {city} show up here once Savorlog opens.</p>
          </section>
        </div>
      )}
    </main>
  )
}
