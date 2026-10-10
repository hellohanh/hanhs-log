import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <main className="page">
      <h1 style={{ fontSize: 48, marginBottom: 16 }}>Page not found</h1>
      <p className="lede">
        That link doesn't go anywhere in Hanh's Log. <Link to="/">Go to the home page</Link>.
      </p>
    </main>
  )
}
