import { FormEvent, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FLYING_SCALE, HERO_H, HERO_W, frameAt } from '../lib/flightPath'
import styles from './Home.module.css'

const img = (name: string) => `${import.meta.env.BASE_URL}images/${name}`

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// The splash (approved mockup). The picture stays pinned while you scroll and
// scrolling flies the plane along the dotted route (scrolling up flies it
// back). At the end it hands over to the plane painted in the picture, and
// the search card and the two section panels fade in. Shown on every visit.
export default function Home() {
  const runwayRef = useRef<HTMLElement>(null)
  const pinnedRef = useRef<HTMLDivElement>(null)
  const planeRef = useRef<SVGGElement>(null)
  const paintedRef = useRef<SVGImageElement>(null)
  const [reduced] = useState(prefersReducedMotion)
  const [landed, setLanded] = useState(reduced)
  const [started, setStarted] = useState(reduced)

  // Desktop layout (Hanh's spec): a 1080 × 800 container holding the
  // 1080 × 720 picture 40px from the top, with the search panel 20px in from
  // the left and its bottom on the 780px mark. On screens too small for it
  // the whole container shrinks together. Phones are laid out separately.
  useEffect(() => {
    const pinned = pinnedRef.current
    if (!pinned) return
    const fit = () => {
      const scale = Math.min(1, pinned.clientWidth / 1080, pinned.clientHeight / 800)
      pinned.style.setProperty('--s', scale.toFixed(4))
    }
    fit()
    window.addEventListener('resize', fit)
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit)
    ro?.observe(pinned)
    return () => {
      window.removeEventListener('resize', fit)
      ro?.disconnect()
    }
  }, [])

  useEffect(() => {
    const draw = (p: number) => {
      const f = frameAt(p)
      planeRef.current?.setAttribute(
        'transform',
        `translate(${f.x.toFixed(1)} ${f.y.toFixed(1)}) rotate(${f.angle.toFixed(1)}) scale(${FLYING_SCALE})`
      )
      planeRef.current?.setAttribute('opacity', f.flyingOpacity.toFixed(3))
      paintedRef.current?.setAttribute('opacity', f.paintedOpacity.toFixed(3))
      setLanded(f.landed)
      setStarted(p > 0.01)
    }

    if (reduced) {
      draw(1)
      return
    }

    // How far through the pinned stretch the page has scrolled, 0 to 1.
    // The picture is pinned just under the header; the flight runs from the
    // moment it pins until the stretch has scrolled past.
    const target = () => {
      const el = runwayRef.current
      const pinned = pinnedRef.current
      if (!el || !pinned) return 0
      const stickyTop = parseFloat(getComputedStyle(pinned).top) || 0
      const runway = el.offsetHeight - pinned.offsetHeight
      return runway > 0 ? Math.max(0, Math.min(1, (stickyTop - el.getBoundingClientRect().top) / runway)) : 1
    }

    // Ease toward the scroll position so wheel steps glide instead of jump.
    let shown = target()
    let raf = 0
    const step = () => {
      const goal = target()
      shown += (goal - shown) * 0.18
      if (Math.abs(goal - shown) < 0.0005) shown = goal
      draw(shown)
      raf = shown === goal ? 0 : requestAnimationFrame(step)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(step)
    }

    draw(shown)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [reduced])

  return (
    <main className={styles.splash} data-landed={landed ? 'true' : 'false'} data-motion={reduced ? 'reduced' : 'scroll'}>
      <section ref={runwayRef} aria-label="Introduction" className={styles.runway}>
        <div ref={pinnedRef} className={styles.pinned}>
          <div className={styles.column}>
          <div className={styles.art}>
            <svg
              viewBox={`0 0 ${HERO_W} ${HERO_H}`}
              role="img"
              aria-label="Watercolor travel map: as you scroll, a plane flies the dotted route around a bowl of phở and a bánh mì, then settles into place in the picture"
              className={styles.svg}
            >
              <image href={img('hero-noplane.webp')} x="0" y="0" width={HERO_W} height={HERO_H} />
              <image ref={paintedRef} href={img('hero-plane.webp')} x="540" y="40" width="680" height="290" opacity="0" />
              <g ref={planeRef} data-testid="flying-plane">
                <image href={img('plane.webp')} x="-180" y="-68" width="360" height="135" />
              </g>
            </svg>
            <p className={styles.hint} data-hidden={started} aria-hidden="true">
              Scroll to fly
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
            </p>
          </div>
          <CitySearch />
          </div>
        </div>
      </section>

      <section id="choose" aria-labelledby="choose-title" className={styles.choose}>
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
    <form className={`${styles.searchCard} ${styles.reveal}`} onSubmit={submit} role="search">
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
