import { Link } from 'react-router-dom'

// Temporary home page for Milestone 1. Milestone 2 replaces it with the
// approved scrolling splash (hero illustration, city search, section cards).
export default function Home() {
  return (
    <main className="page">
      <p className="eyebrow">Hanh's Log</p>
      <h1 style={{ fontSize: 'clamp(40px, 6vw, 72px)', margin: '12px 0 16px' }}>Every trip and every table, in one place.</h1>
      <p className="lede">The splash page lands in the next milestone. For now, pick a section.</p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 32 }}>
        <Link to="/wander" className="btn">Wanderlog</Link>
        <Link to="/savor" className="btn btn-quiet">Savorlog</Link>
      </div>
    </main>
  )
}
