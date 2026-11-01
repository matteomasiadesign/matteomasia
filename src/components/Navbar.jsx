import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Plus, X, MessageCircle, ArrowUpRight } from 'lucide-react'
import { setScrollLocked } from '../lib/smoothScroll.js'
import { useLocalTime } from '../lib/useLocalTime.js'

// --- NAVIGAZIONE ---
// Nella hero: una riga trasparente in alto, con le voci a sinistra.
// Dalla fine della hero (e sempre su mobile) resta solo un pulsante "+" in
// basso a destra. Cliccato, il pulsante si stacca come una goccia di liquido:
// si schiaccia, parte, si allunga nella direzione del moto lasciando due
// goccioline dietro, e percorre una curva fino al centro in alto. Lì si gonfia
// con una molla in un'isola nera (stile Dynamic Island) con il menu.
// Chiudendo fa il percorso inverso.
// Tutto si muove con transform, opacity e clip-path: niente layout animato.
//
// Il colore del "+" dipende dalla superficie sotto, letta dagli elementi con
// data-nav-surface: 'red' (hero, servizi, contatti), 'velvet' (Chi sono).
// Il resto è scuro.
//   red    → nero, segno rosso
//   dark   → rosso, segno nero
//   velvet → nero velato con filo crema, segno crema

const FAB = 56 // lato del pulsante (e della goccia)
const FAB_GAP = 24 // distanza del pulsante dai bordi dello schermo
const UP_MS = 640
const DOWN_MS = 520

const ICON = {
  red: 'text-[#ff2b1c]',
  dark: 'text-black',
  velvet: 'text-[#f3ead7]',
}
// Colore di partenza della goccia, uguale a quello del pulsante
const RGBA = {
  red: [0, 0, 0, 1],
  dark: [255, 43, 28, 1],
  velvet: [0, 0, 0, 0.7],
}
const ISLAND_RGBA = [0, 0, 0, 1]

// Isola: chiusa è un cerchio grande quanto la goccia, al centro in alto
const ISLAND_CLOSED = `inset(0px calc(50% - ${FAB / 2}px) calc(100% - ${FAB}px) calc(50% - ${FAB / 2}px) round ${FAB / 2}px)`
const ISLAND_OPEN = 'inset(0px 0px 0px 0px round 32px)'

// Molla con un piccolo rimbalzo, come l'isola dell'iPhone
const SPRING = 'linear(0, 0.06, 0.205, 0.387, 0.575, 0.744, 0.882, 0.985, 1.053, 1.091, 1.106, 1.104, 1.09, 1.072, 1.052, 1.033, 1.017, 1.005, 0.996, 0.991, 0.989, 0.989, 0.99, 0.992, 0.994, 0.996, 0.998, 0.999, 1, 1.001, 1)'
const springEasing = () =>
  (typeof CSS !== 'undefined' && CSS.supports('animation-timing-function', 'linear(0, 1)') ? SPRING : 'cubic-bezier(0.34, 1.4, 0.64, 1)')

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const mix = (a, b, t) => a + (b - a) * t
const rgba = (c0, c1, t) => `rgba(${c0.map((v, i) => (i < 3 ? Math.round(mix(v, c1[i], t)) : mix(v, c1[i], t).toFixed(3))).join(',')})`

// Fotogrammi della goccia lungo una curva: dal pulsante sale lungo il lato
// destro e piega verso il centro in alto. Ogni fotogramma la orienta nella
// direzione del moto e la allunga in proporzione alla velocità; all'inizio uno
// schiacciamento di "carica", lungo la strada un tremolio che si smorza.
function liquidFrames(S, E, up, c0, c1, size = 1, fadeOut = false) {
  const C = { x: S.x, y: E.y + (S.y - E.y) * 0.32 }
  const at = (u) => ({
    x: (1 - u) * (1 - u) * S.x + 2 * (1 - u) * u * C.x + u * u * E.x,
    y: (1 - u) * (1 - u) * S.y + 2 * (1 - u) * u * C.y + u * u * E.y,
  })
  const N = 30
  const len = Math.hypot(E.x - S.x, E.y - S.y)
  const frames = []
  for (let i = 0; i <= N; i++) {
    const tau = i / N
    const u = up ? easeInOut(tau) : 1 - easeInOut(tau)
    const p = at(u)
    // Direzione e velocità dal fotogramma vicino
    const q = at(up ? easeInOut(Math.min(tau + 0.02, 1)) : 1 - easeInOut(Math.min(tau + 0.02, 1)))
    const r = i === N ? at(up ? easeInOut(tau - 0.02) : 1 - easeInOut(tau - 0.02)) : p
    const dx = i === N ? p.x - r.x : q.x - p.x
    const dy = i === N ? p.y - r.y : q.y - p.y
    const speed = Math.hypot(dx, dy) / (len * 0.02 || 1)
    const stretch = Math.min(0.85, speed * 0.42)
    const wobble = 1 + 0.07 * Math.sin(tau * Math.PI * 7) * (1 - tau)
    let sx = (1 + stretch) * size
    let sy = (1 - stretch * 0.38) * wobble * size
    // Carica alla partenza, assestamento all'arrivo
    if (i === 0) { sx = 0.86 * size; sy = 1.14 * size }
    if (i === N) { sx = size; sy = size }
    const angle = Math.atan2(dy, dx)
    const frame = {
      offset: tau,
      transform: `translate(${(p.x - FAB / 2).toFixed(1)}px, ${(p.y - FAB / 2).toFixed(1)}px) rotate(${angle.toFixed(3)}rad) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`,
      backgroundColor: rgba(c0, c1, tau),
      opacity: fadeOut ? Math.max(0, 1 - tau * 1.15) : 1,
    }
    frames.push(frame)
  }
  return frames
}

// Superficie sotto un punto dello schermo, a una certa distanza dal fondo:
// un IntersectionObserver su una linea di 1px, così lo scroll non legge il
// layout a ogni frame
function useSurfaceAt(fromBottom) {
  const [surface, setSurface] = useState('red')

  useEffect(() => {
    let io = null
    const hits = new Map()

    const build = () => {
      io?.disconnect()
      hits.clear()
      const top = Math.max(window.innerHeight - fromBottom, 0)
      io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) hits.set(e.target, e.target.dataset.navSurface)
          else hits.delete(e.target)
        })
        const last = [...hits.values()].pop()
        setSurface(last || 'dark')
      }, { rootMargin: `-${top}px 0px -${Math.max(fromBottom - 1, 0)}px 0px` })
      document.querySelectorAll('[data-nav-surface]').forEach((el) => io.observe(el))
    }

    build()
    window.addEventListener('resize', build)
    return () => {
      io?.disconnect()
      window.removeEventListener('resize', build)
    }
  }, [fromBottom])

  return surface
}

// Livelli di colore del pulsante, incrociati con l'opacità
const FabLayers = ({ surface }) => (
  <>
    <span className={`nav-fade absolute inset-0 rounded-full bg-black ${surface === 'velvet' ? 'opacity-70' : 'opacity-100'}`} />
    <span className={`nav-fade absolute inset-0 rounded-full bg-[#ff2b1c] ${surface === 'dark' ? 'opacity-100' : 'opacity-0'}`} />
    <span className={`nav-fade absolute inset-0 rounded-full shadow-[inset_0_0_0_1px_rgba(243,234,215,0.28)] ${surface === 'velvet' ? 'opacity-100' : 'opacity-0'}`} />
  </>
)

export default function Navbar({ menuItems, onSection }) {
  const [past, setPast] = useState(false) // oltre la hero
  // closed → rising (la goccia sale) → open → closing (l'isola si chiude e la goccia scende)
  const [phase, setPhase] = useState('closed')
  const time = useLocalTime()
  const surface = useSurfaceAt(FAB_GAP + FAB / 2)

  const fabRef = useRef(null)
  const blobRef = useRef(null)
  const dropRefs = [useRef(null), useRef(null)]
  const islandRef = useRef(null)
  const firstItemRef = useRef(null)
  const busy = useRef(false)
  const phaseRef = useRef('closed')
  const surfaceRef = useRef(surface)
  surfaceRef.current = surface

  const go = (p) => { phaseRef.current = p; setPhase(p) }

  useEffect(() => {
    const onScroll = () => setPast(window.scrollY > window.innerHeight * 0.6)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (islandRef.current) islandRef.current.style.clipPath = ISLAND_CLOSED
  }, [])

  // Punti di partenza (centro del "+") e di arrivo (centro dell'isola chiusa)
  const ends = () => {
    const f = fabRef.current.getBoundingClientRect()
    const i = islandRef.current.getBoundingClientRect()
    return {
      S: { x: f.left + f.width / 2, y: f.top + f.height / 2 },
      E: { x: i.left + i.width / 2, y: i.top + FAB / 2 },
    }
  }

  // La goccia e le due goccioline che la seguono
  const travel = (up) => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const { S, E } = ends()
    const from = up ? RGBA[surfaceRef.current] : ISLAND_RGBA
    const to = up ? ISLAND_RGBA : RGBA[surfaceRef.current]
    const dur = reduce ? 1 : up ? UP_MS : DOWN_MS
    const main = blobRef.current.animate(liquidFrames(S, E, up, from, to), { duration: dur, fill: 'forwards' })
    if (!reduce) {
      dropRefs.forEach((ref, k) => {
        ref.current.animate(liquidFrames(S, E, up, from, to, k ? 0.26 : 0.42, true), {
          duration: dur, delay: 45 + k * 50, fill: 'both',
        }).onfinish = (e) => e.target.cancel()
      })
    }
    return main.finished.then(() => main)
  }

  const open = async () => {
    if (busy.current || phaseRef.current !== 'closed') return
    busy.current = true
    setScrollLocked(true)
    go('rising')
    const blob = await travel(true)
    // La goccia è arrivata: al suo posto l'isola, che si gonfia con la molla
    go('open')
    const island = islandRef.current
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const grow = island.animate(
      [
        { clipPath: ISLAND_CLOSED, transform: 'translateX(-50%) scale(1)' },
        { clipPath: ISLAND_OPEN, transform: 'translateX(-50%) scale(1)' },
      ],
      { duration: reduce ? 1 : 720, easing: springEasing() },
    )
    requestAnimationFrame(() => blob.cancel())
    await grow.finished.catch(() => {})
    island.style.clipPath = ISLAND_OPEN
    firstItemRef.current?.focus({ preventScroll: true })
    busy.current = false
  }

  const close = async ({ refocus = true } = {}) => {
    if (busy.current || phaseRef.current !== 'open') return
    busy.current = true
    go('closing')
    const island = islandRef.current
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const shrink = island.animate(
      [{ clipPath: ISLAND_OPEN }, { clipPath: ISLAND_CLOSED }],
      { duration: reduce ? 1 : 380, delay: reduce ? 0 : 90, easing: 'cubic-bezier(0.5, 0, 0.75, 0)', fill: 'forwards' },
    )
    await shrink.finished.catch(() => {})
    island.style.clipPath = ISLAND_CLOSED
    shrink.cancel()
    setScrollLocked(false)
    const blob = travel(false)
    go('landing')
    const b = await blob
    go('closed')
    requestAnimationFrame(() => b.cancel())
    if (refocus) fabRef.current?.focus({ preventScroll: true })
    busy.current = false
  }

  useEffect(() => {
    if (phase !== 'open') return
    const onKey = (e) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // Voce del menu: si chiude l'isola e intanto la pagina scorre
  const goTo = (e, id) => {
    e.preventDefault()
    close({ refocus: false })
    setScrollLocked(false)
    onSection(id)
  }
  const anchorTop = (e, id) => {
    e.preventDefault()
    onSection(id)
  }

  const islandShown = phase === 'open' || phase === 'closing'
  const fabHidden = phase !== 'closed'

  return (
    <>
      {/* --- RIGA IN ALTO, SOLO NELLA HERO (desktop) --- */}
      <header
        className={`nav-spring hidden md:block fixed top-0 inset-x-0 z-50 text-black ${past ? '-translate-y-full opacity-0 pointer-events-none' : ''}`}
        {...(past && { inert: '' })}
      >
        <div className="wrap flex justify-center items-center h-[76px] text-sm font-medium">
          <nav aria-label="Principale" className="flex gap-8">
            {menuItems.map((item) => (
              <a key={item.id} href={`#${item.id}`} onClick={(e) => anchorTop(e, item.id)} className="hover:opacity-60 transition-opacity">
                {item.name}
              </a>
            ))}
            <Link to="/progetti" className="hover:opacity-60 transition-opacity">Archive</Link>
          </nav>
        </div>
      </header>

      {/* Velo dietro l'isola: un clic fuori la richiude */}
      <div
        aria-hidden="true"
        onClick={() => close()}
        className={`fixed inset-0 z-[64] bg-black/45 transition-opacity duration-500 ${phase === 'closed' || phase === 'landing' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      />

      {/* --- ISOLA DEL MENU, AL CENTRO IN ALTO --- */}
      <div
        ref={islandRef}
        id="site-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        data-lenis-prevent
        className={`hide-scrollbar fixed z-[66] left-1/2 rounded-[32px] bg-black text-[#ff2b1c] shadow-[0_24px_80px_rgba(0,0,0,0.55),inset_0_0_0_1px_rgba(255,43,28,0.28)] ${phase === 'open' ? 'menu-open' : ''} ${islandShown ? '' : 'invisible'}`}
        style={{
          top: 'calc(12px + env(safe-area-inset-top, 0px))',
          width: 'min(560px, calc(100vw - 24px))',
          maxHeight: 'calc(100svh - 24px)',
          overflowY: 'auto',
          transform: 'translateX(-50%)',
        }}
        {...(phase !== 'open' && { inert: '' })}
      >
        <div className="menu-item flex items-center justify-between pl-6 pr-2 pt-2 h-[60px]" style={{ '--i': 0 }}>
          <span className="text-xs font-semibold uppercase tracking-widest tabular-nums">Porto Torres · {time}</span>
          <button
            type="button"
            onClick={() => close()}
            aria-label="Chiudi il menu"
            className="w-11 h-11 rounded-full flex items-center justify-center bg-[#ff2b1c] text-black hover:scale-105 active:scale-95 transition-transform"
          >
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        <nav aria-label="Menu" className="px-3 pt-2 pb-3">
          <ul className="flex flex-col gap-1">
            {menuItems.map((item, i) => (
              <li key={item.id} className="menu-item" style={{ '--i': i + 1 }}>
                <a
                  ref={i === 0 ? firstItemRef : undefined}
                  href={`#${item.id}`}
                  onClick={(e) => goTo(e, item.id)}
                  className="flex items-baseline gap-4 rounded-full px-5 py-3 hover:bg-[#ff2b1c] hover:text-black focus-visible:bg-[#ff2b1c] focus-visible:text-black transition-colors duration-200"
                >
                  <span className="text-xs font-semibold tabular-nums opacity-70">{String(i + 1).padStart(2, '0')}</span>
                  <span className="font-display text-4xl md:text-5xl leading-none uppercase">{item.name}</span>
                </a>
              </li>
            ))}
            <li className="menu-item" style={{ '--i': menuItems.length + 1 }}>
              <Link
                to="/progetti"
                className="flex items-baseline gap-4 rounded-full px-5 py-3 hover:bg-[#ff2b1c] hover:text-black focus-visible:bg-[#ff2b1c] focus-visible:text-black transition-colors duration-200"
              >
                <span className="text-xs font-semibold tabular-nums opacity-70">{String(menuItems.length + 1).padStart(2, '0')}</span>
                <span className="font-display text-4xl md:text-5xl leading-none uppercase">Archive</span>
                <ArrowUpRight size={22} className="ml-auto self-center" />
              </Link>
            </li>
          </ul>
        </nav>

        <div className="menu-item flex flex-wrap items-center gap-2 px-4 pb-4" style={{ '--i': menuItems.length + 2 }}>
          <a
            href="https://wa.me/393495862375"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Scrivimi su WhatsApp"
            className="w-11 h-11 rounded-full flex items-center justify-center bg-[#ff2b1c] text-black hover:scale-105 active:scale-95 transition-transform"
          >
            <MessageCircle size={20} />
          </a>
          <a
            href="mailto:matteomasiadesign@gmail.com"
            className="h-11 px-5 rounded-full flex items-center border border-[#ff2b1c]/50 text-sm font-semibold hover:bg-[#ff2b1c] hover:text-black transition-colors"
          >
            matteomasiadesign@gmail.com
          </a>
        </div>
      </div>

      {/* --- LA GOCCIA E LE GOCCIOLINE (visibili solo durante il viaggio) --- */}
      {[...dropRefs, blobRef].map((ref, k) => (
        <span
          key={k}
          ref={ref}
          aria-hidden="true"
          className="fixed left-0 top-0 z-[67] rounded-full pointer-events-none opacity-0 will-change-transform"
          style={{ width: FAB, height: FAB }}
        />
      ))}

      {/* --- PULSANTE "+" --- */}
      <button
        ref={fabRef}
        type="button"
        onClick={open}
        aria-expanded={phase === 'open'}
        aria-controls="site-menu"
        aria-label="Apri il menu"
        className={`nav-spring fixed z-[60] rounded-full ${fabHidden ? 'scale-50 opacity-0 pointer-events-none' : past ? '' : 'md:scale-0 md:opacity-0 md:pointer-events-none'}`}
        style={{
          width: FAB,
          height: FAB,
          right: FAB_GAP,
          bottom: `calc(${FAB_GAP}px + env(safe-area-inset-bottom, 0px))`,
          transitionDuration: fabHidden ? '0.15s' : undefined,
        }}
      >
        <FabLayers surface={surface} />
        <Plus size={26} strokeWidth={2.5} className={`nav-ink relative mx-auto ${ICON[surface]}`} />
      </button>
    </>
  )
}
