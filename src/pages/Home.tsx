import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DURATION_MS, FLYING_SCALE, HERO_H, HERO_W, frameAt } from '../lib/flightPath'
import styles from './Home.module.css'

const img = (name: string) => `${import.meta.env.BASE_URL}images/${name}`

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// The splash (approved mockup): the plane flies the dotted route over the
// illustration, hands over to the plane painted in the picture, and then the
// two sections come up for picking. Shown on every visit.
export default function Home() {
  const planeRef = useRef<SVGGElement>(null)
  const paintedRef = useRef<SVGImageElement>(null)
  const chooseRef = useRef<HTMLElement>(null)
  const rafRef = useRef(0)
  const [landed, setLanded] = useState(false)

  const draw = useCallback((p: number) => {
    const f = frameAt(p)
    planeRef.current?.setAttribute(
      'transform',
      `translate(${f.x.toFixed(1)} ${f.y.toFixed(1)}) rotate(${f.angle.toFixed(1)}) scale(${FLYING_SCALE})`
    )
    planeRef.current?.setAttribute('opacity', f.flyingOpacity.toFixed(3))
    paintedRef.current?.setAttribute('opacity', f.paintedOpacity.toFixed(3))
    return f.landed
  }, [])

  const fly = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    if (prefersReducedMotion()) {
      draw(1)
      setLanded(true)
      return
    }
    setLanded(false)
    let start = 0
    let shown = false
    const tick = (now: number) => {
      if (!start) start = now
      const p = Math.min(1, (now - start) / DURATION_MS)
      if (draw(p) && !shown) {
        shown = true
        setLanded(true)
      }
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else if (window.scrollY < 40) {
        // Glide down to the choices, unless the person already scrolled.
        chooseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [draw])

  useEffect(() => {
    draw(0)
    fly()
    return () => cancelAnimationFrame(rafRef.current)
  }, [draw, fly])

  // Someone who scrolls down before the plane lands still sees the choices.
  useEffect(() => {
    const el = chooseRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) setLanded(true)
    }, { threshold: 0.25 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <main className={styles.splash} data-landed={landed ? 'true' : 'false'}>
      <section aria-label="Introduction" className={styles.hero}>
        <div className={styles.art}>
          <svg
            viewBox={`0 0 ${HERO_W} ${HERO_H}`}
            role="img"
            aria-label="Watercolor travel map: a plane flies the dotted route around a bowl of phở and a bánh mì, then settles into place in the picture"
            className={styles.svg}
          >
            <image href={img('hero-noplane.webp')} x="0" y="0" width={HERO_W} height={HERO_H} />
            <image ref={paintedRef} href={img('hero-plane.webp')} x="540" y="40" width="680" height="290" opacity="0" />
            <g ref={planeRef} data-testid="flying-plane">
              <image href={img('plane.webp')} x="-180" y="-68" width="360" height="135" />
            </g>
          </svg>
          <button type="button" className={styles.replay} onClick={fly} data-ready={landed}>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 3-6.7" />
              <path d="M3 4v5h5" />
            </svg>
            Fly again
          </button>
        </div>
        <CitySearch />
      </section>

      <section ref={chooseRef} id="choose" aria-labelledby="choose-title" className={styles.choose}>
        <div className={styles.chooseInner}>
          <h2 id="choose-title" className={styles.reveal}>Where to?</h2>
          <div className={styles.cards}>
            <Link to="/wander" className={`${styles.card} ${styles.reveal}`}>
              <img src={img('card-wander.webp')} alt="" width="800" height="500" />
              <div className={styles.cardBody}>
                <span className="eyebrow">Wanderlog</span>
                <span className={styles.cardTitle}>Plan the days.</span>
                <span className={styles.cardText}>Maps, pins and a day-by-day timeline, shared with everyone on the trip.</span>
                <span className={styles.cardCta}>Open Wanderlog →</span>
              </div>
            </Link>
            <Link to="/savor" className={`${styles.card} ${styles.reveal}`}>
              <img src={img('card-savor.webp')} alt="" width="800" height="500" />
              <div className={styles.cardBody}>
                <span className="eyebrow">Savorlog</span>
                <span className={styles.cardTitle}>Remember the meals.</span>
                <span className={styles.cardText}>The places worth eating at, by country and main dish, ready for the next trip.</span>
                <span className={styles.cardCta}>Open Savorlog →</span>
              </div>
            </Link>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <span className={styles.footerMark}>Hanh's Log</span>
        <span>Wanderlog · Savorlog</span>
      </footer>
    </main>
  )
}

function CitySearch() {
  const navigate = useNavigate()
  const [city, setCity] = useState('')
  const [error, setError] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const c = city.trim()
    if (!c) {
      setError('Enter a city first.')
      return
    }
    navigate(`/search?city=${encodeURIComponent(c)}`)
  }

  return (
    <form className={styles.searchCard} onSubmit={submit} role="search">
      <p className="eyebrow">Hanh's Log</p>
      <h1 className={styles.title}>Every trip and every table, in one place.</h1>
      <label htmlFor="city" className={styles.label}>Where are you going?</label>
      <div className={styles.searchRow}>
        <input
          id="city"
          type="search"
          className="field"
          value={city}
          onChange={e => {
            setCity(e.target.value)
            if (error) setError('')
          }}
          placeholder="Rome, Hanoi, Tokyo"
          autoComplete="off"
          aria-describedby={error ? 'city-error' : undefined}
          aria-invalid={error ? true : undefined}
        />
        <button type="submit" className="btn">Search</button>
      </div>
      {error && <p id="city-error" className={styles.error}>{error}</p>}
    </form>
  )
}
