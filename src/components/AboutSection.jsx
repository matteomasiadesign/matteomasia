import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Pause, Play, RotateCcw } from 'lucide-react'
import { addWheelSnap } from '../lib/smoothScroll.js'

// --- CHI SONO: LA STANZA ROSSA ---
// Atmosfera alla David Lynch: un sipario di velluto si apre su una stanza con
// tende cremisi e pavimento a zig-zag, una luce che tremola, grana di pellicola.
//
// Lo scroll serve solo ad aprire il sipario (con la rotella basta un gesto).
// Poi la stanza resta ferma e le didascalie scorrono da sole, come un film:
// emergono dal buio sfocate, restano il tempo di leggerle, svaniscono. Il
// titolo appare prima specchiato e poi si raddrizza. In basso una pellicola
// a segmenti mostra dove si è: si può saltare a una scena, mettere in pausa,
// o andare ai contatti. Scrollando si esce quando si vuole.

const clamp01 = (v) => Math.min(Math.max(v, 0), 1)
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

const CURTAIN_END = 0.8 // il sipario è tutto aperto a questo punto dello scroll
// Punti di aggancio per lo scroll a dito: sipario chiuso, sipario aperto
const SNAP_POINTS = [0, 1]
const pad = (n) => String(n).padStart(2, '0')

const label = 'block text-xs font-semibold uppercase tracking-[0.35em] text-[#f3ead7]/85'
const body = 'text-lg md:text-2xl font-medium leading-relaxed text-[#f3ead7]'
const mark = 'text-white font-semibold underline decoration-[#ff2b1c] decoration-2 underline-offset-4'

// Le didascalie, in ordine. ms: quanto resta sullo schermo (circa il tempo di
// leggerla); l'ultima resta finché non si riparte
const SCENES = [
  {
    ms: 4200,
    content: (
      <>
        <span className={label}>About</span>
        <h2 className="mt-6 text-4xl md:text-7xl leading-[1.05] text-[#f3ead7] lynch-glow">
          <span data-flip className="inline-block">Designer,<br /><span className="text-[#f3ead7]/60">class of ’97.</span></span>
        </h2>
      </>
    ),
  },
  {
    ms: 11000,
    content: (
      <p className={`${body} max-w-2xl lynch-glow`}>
        Nato in <strong className={mark}>Sardegna</strong>, inizio il mio percorso nelle arti visive attraverso la fotografia. Negli anni ho espanso questo linguaggio collaborando con diversi artisti, sviluppando competenze trasversali in videomaking, post-produzione, grafica e direzione multimediale.
      </p>
    ),
  },
  {
    ms: 10000,
    content: (
      <p className={`${body} max-w-2xl lynch-glow`}>
        Nel <strong className={mark}>2023</strong> conseguo la laurea in <strong className={mark}>Economia e Management</strong>, tornando al mondo visivo con un approccio più strutturato, strategico e orientato al business: dall'identità di marca al web design, fino allo sviluppo front-end.
      </p>
    ),
  },
  {
    ms: 9000,
    content: (
      <>
        <p className="max-w-3xl text-2xl md:text-4xl font-semibold leading-snug text-[#f3ead7] lynch-glow">
          Unisco tutto questo in un sistema compatto: visione, tecnica e direzione.
        </p>
        <p className="mt-6 max-w-xl text-base md:text-lg leading-relaxed text-[#f3ead7]/90 lynch-glow">
          Un mix diretto, progettato per comunicare. Posso aiutarti a strutturare una comunicazione efficace e multi-piattaforma per il tuo business, progetto o evento.
        </p>
      </>
    ),
  },
  {
    ms: 7000,
    content: (
      <>
        <span className={label}>Design + Code · Full-Stack</span>
        <h3 className="mt-5 text-4xl md:text-6xl text-[#f3ead7] lynch-glow">End-to-End</h3>
        <p className="mt-5 max-w-lg text-base md:text-xl leading-relaxed text-[#f3ead7]/90 lynch-glow">
          Dall'identità visiva ai contenuti, fino allo sviluppo front-end: un unico riferimento per l'intero ecosistema digitale.
        </p>
      </>
    ),
  },
  {
    content: (
      <>
        <span className={`${label} flex items-center gap-3`}>
          <span className="w-2 h-2 rounded-full bg-[#ff2b1c] lynch-flicker" /> Available for projects
        </span>
        <p className="mt-5 text-lg md:text-2xl text-[#f3ead7] lynch-glow">Porto Torres, Sardegna · Remote & on-site</p>
      </>
    ),
  },
]
const LAST = SCENES.length - 1

// Velluto: un rumore stirato in verticale fa da rilievo delle pieghe (larghe
// e irregolari), illuminato di lato e moltiplicato per il cremisi di base.
// Luce opaca e ombre morbide, niente riflessi lucidi.
// (È lo stesso filtro del fallback SVG in fondo al componente, come testo per la canvas)
const velvetFilter = (id, seed, freq) => (
  `<filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">` +
  `<feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="3" seed="${seed}" result="folds"/>` +
  '<feDiffuseLighting in="folds" surfaceScale="14" diffuseConstant="1.15" lighting-color="#ff8a7a" result="light">' +
  '<feDistantLight azimuth="180" elevation="34"/></feDiffuseLighting>' +
  '<feComposite in="light" in2="SourceGraphic" operator="arithmetic" k1="1" k2="0" k3="0" k4="0"/></filter>'
)

// Il filtro è pesante (rumore + luce su tutto lo schermo): lasciato vivo nella
// pagina, il browser lo ricalcolava appena la sezione si avvicinava, con un
// blocco di ~100ms proprio durante lo scroll (molto di più su mobile e Safari).
// Ora viene "cotto" una volta in una canvas alla densità dello schermo (stesso
// identico risultato), a strisce, nei momenti in cui la pagina è ferma.
const idle = (fn) => (window.requestIdleCallback ? window.requestIdleCallback(fn, { timeout: 1000 }) : setTimeout(fn, 60))
const bakeQueue = []
let bakePending = false
// Una striscia per frame: il lavoro vero lo fa la GPU quando la canvas viene
// consegnata a fine frame, quindi più strisce nello stesso frame tornerebbero
// a sommarsi in un unico blocco
const pumpBake = () => {
  if (bakePending || !bakeQueue.length) return
  bakePending = true
  requestAnimationFrame(() => idle(() => {
    bakePending = false
    const job = bakeQueue[0]
    if (job && job.step()) bakeQueue.shift()
    pumpBake()
  }))
}
const unqueueBake = (job) => {
  const i = bakeQueue.indexOf(job)
  if (i >= 0) bakeQueue.splice(i, 1)
}
const STRIP = 160 // altezza di una striscia, in px CSS

const Velvet = ({ id, seed, freq = '0.011 0.0006' }) => {
  const canvasRef = useRef(null)
  const [baked, setBaked] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    let job = null
    let size = ''
    let timer = 0
    let shown = false

    const bake = () => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const key = `${w}x${h}@${dpr}`
      // Su mobile la barra dell'indirizzo cambia l'altezza della finestra ma non
      // quella della scena (100svh): stessa misura, niente da rifare
      if (!w || !h || key === size) return
      size = key
      if (job) unqueueBake(job)

      // Ogni striscia è un SVG a sé, ritagliato con viewBox: il rumore dipende solo
      // dalle coordinate, quindi le strisce combaciano senza giunture, e il
      // browser calcola il filtro solo sulla striscia (un'unica immagine
      // verrebbe calcolata tutta al primo disegno)
      const filter = velvetFilter('v', seed, freq)
      const strips = []
      for (let y0 = 0; y0 < h; y0 += STRIP) {
        const hh = Math.min(STRIP, h - y0)
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${hh}" viewBox="0 ${y0} ${w} ${hh}" preserveAspectRatio="none">` +
          `${filter}<rect width="${w}" height="${h}" fill="#8c0d18" filter="url(#v)"/></svg>`
        const img = new Image()
        img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
        strips.push({ img, y0, hh })
      }
      // La prima volta si disegna direttamente sulla canvas (ancora nascosta);
      // dopo un resize su una tela a parte, scambiata a lavoro finito, così
      // nel frattempo resta visibile il velluto vecchio
      const out = shown ? document.createElement('canvas') : canvas
      out.width = Math.round(w * dpr)
      out.height = Math.round(h * dpr)
      const ctx = out.getContext('2d')
      let i = 0
      const current = {
        step: () => {
          const { img, y0, hh } = strips[i++]
          const dy = Math.round(y0 * dpr)
          ctx.drawImage(img, 0, dy, out.width, Math.round((y0 + hh) * dpr) - dy)
          if (i < strips.length) return false
          if (out !== canvas) {
            canvas.width = out.width
            canvas.height = out.height
            canvas.getContext('2d').drawImage(out, 0, 0)
          }
          shown = true
          setBaked(true)
          return true
        },
      }
      job = current
      // Si parte quando tutte le strisce sono pronte; se qualcosa non si
      // carica resta il velluto SVG vivo
      Promise.all(strips.map(({ img }) => new Promise((ok, fail) => {
        if (img.complete && img.naturalWidth) ok()
        else { img.onload = ok; img.onerror = fail }
      }))).then(() => {
        if (job !== current) return
        bakeQueue.push(current)
        pumpBake()
      }, () => {})
    }

    const onResize = () => {
      clearTimeout(timer)
      timer = setTimeout(bake, 300)
    }
    // Si parte quando la pagina ha finito di caricarsi e di animare la hero
    // (la prima striscia costa di più: la GPU prepara gli shader del filtro)
    timer = setTimeout(bake, 2500)
    window.addEventListener('resize', onResize)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', onResize)
      if (job) unqueueBake(job)
      job = null
    }
  }, [seed, freq])

  return (
    <>
      <canvas ref={canvasRef} aria-hidden="true" className={`absolute inset-0 w-full h-full ${baked ? '' : 'invisible'}`} />
      {/* Finché la canvas non è pronta resta il filtro vivo, identico */}
      {!baked && (
        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" aria-hidden="true">
          <filter id={id} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency={freq} numOctaves="3" seed={seed} result="folds" />
            <feDiffuseLighting in="folds" surfaceScale="14" diffuseConstant="1.15" lightingColor="#ff8a7a" result="light">
              <feDistantLight azimuth="180" elevation="34" />
            </feDiffuseLighting>
            <feComposite in="light" in2="SourceGraphic" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" />
          </filter>
          <rect width="100%" height="100%" fill="#8c0d18" filter={`url(#${id})`} />
        </svg>
      )}
    </>
  )
}


export default function AboutSection({ onContact }) {
  const sectionRef = useRef(null)
  const barRef = useRef(null)
  const fillsRef = useRef([])
  const elapsedRef = useRef(0)
  const [started, setStarted] = useState(false) // sipario aperto: il film gira
  const [inView, setInView] = useState(false)
  const [playing, setPlaying] = useState(true)
  const [current, setCurrent] = useState(0)

  // Porta alla scena i, col suo segmento di pellicola da riempire da capo
  const go = useCallback((i) => {
    elapsedRef.current = 0
    const fill = fillsRef.current[i]
    if (fill) fill.style.transform = ''
    setCurrent(i)
  }, [])

  // Sipario richiuso: il film si riavvolge
  useEffect(() => {
    if (started) return
    go(0)
    setPlaying(true)
  }, [started, go])

  // Il tempo della scena: riempie il segmento e poi passa alla successiva.
  // Si ferma in pausa, a sezione fuori schermo e sull'ultima scena
  useEffect(() => {
    if (!started || !inView || !playing || current >= LAST) return
    const fill = fillsRef.current[current]
    let raf = 0
    let last = performance.now()
    const tick = (now) => {
      // Al massimo 100ms per frame: tornando da un'altra scheda non salta avanti
      elapsedRef.current += Math.min(now - last, 100)
      last = now
      const k = Math.min(elapsedRef.current / SCENES[current].ms, 1)
      fill.style.transform = `scaleX(${k})`
      if (k < 1) raf = requestAnimationFrame(tick)
      else go(current + 1)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [started, inView, playing, current, go])

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const q = (sel) => section.querySelector(sel)
    const curtainL = q('[data-curtain="left"]')
    const curtainR = q('[data-curtain="right"]')
    const intro = q('[data-intro]')
    const floor = q('[data-floor]')
    const room = q('[data-room]')
    const bar = barRef.current
    let isOpen = false

    let raf = 0
    const update = () => {
      raf = 0
      const rect = section.getBoundingClientRect()
      const span = rect.height - window.innerHeight
      const p = span > 0 ? clamp01(-rect.top / span) : 1

      // Il sipario si apre e il velluto si raccoglie ai lati
      const open = easeInOut(clamp01(p / CURTAIN_END))
      curtainL.style.transform = `scaleX(${1 - 0.86 * open})`
      curtainR.style.transform = `scaleX(${1 - 0.86 * open})`
      intro.style.opacity = String(1 - clamp01(open * 2.5))
      // La pellicola compare a sipario quasi aperto (da nascosta esce dal giro del Tab)
      const barOp = clamp01((open - 0.6) / 0.4)
      bar.style.opacity = String(barOp)
      bar.style.visibility = barOp > 0 ? '' : 'hidden'

      // Lenta carrellata in avanti dentro la stanza
      room.style.transform = `scale(${1 + 0.12 * p})`
      floor.style.transform = `rotateX(62deg) translateY(${p * 18}%)`

      // Parte a sipario aperto, si riavvolge a sipario chiuso (in mezzo non cambia,
      // così un piccolo scroll non lo fa ripartire)
      if (!isOpen && open >= 0.9) { isOpen = true; setStarted(true) }
      else if (isOpen && open <= 0.1) { isOpen = false; setStarted(false) }
    }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(update) }

    // --- Con la rotella: un gesto apre il sipario, uno lo richiude ---
    const resolveWheel = (deltaY, pos, next) => {
      const top = section.getBoundingClientRect().top + window.scrollY
      const end = top + section.offsetHeight - window.innerHeight // sipario aperto
      if (end <= top) return null
      // Scendendo: arrivati al sipario (o a metà apertura) si va a sipario aperto
      if (deltaY > 0 && pos < end - 2 && next > top) return end
      // Risalendo dai contatti ci si ferma sulla stanza; dalla stanza il sipario si chiude
      if (deltaY < 0 && pos > top + 2 && next < end) return pos > end + 2 ? end : top
      return null
    }
    let removeSnap = null

    // Ascolta lo scroll solo quando la sezione è vicina allo schermo; lontano
    // dallo schermo mette in pausa anche le animazioni infinite (tende, luce,
    // grana) e il film
    let listening = false
    const io = new IntersectionObserver(([entry]) => {
      section.classList.toggle('lynch-idle', !entry.isIntersecting)
      setInView(entry.isIntersecting)
      if (entry.isIntersecting && !listening) {
        window.addEventListener('scroll', schedule, { passive: true })
        window.addEventListener('resize', schedule)
        removeSnap = addWheelSnap(resolveWheel)
        listening = true
        schedule()
      } else if (!entry.isIntersecting && listening) {
        window.removeEventListener('scroll', schedule)
        window.removeEventListener('resize', schedule)
        removeSnap()
        listening = false
        update()
      }
    }, { rootMargin: '25% 0px 25% 0px' })
    io.observe(section)
    update()

    return () => {
      io.disconnect()
      removeSnap?.()
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [])

  const ended = current === LAST
  const toggle = () => {
    if (ended) { go(0); setPlaying(true) } else setPlaying((v) => !v)
  }

  return (
    // Su mobile il sipario si apre in poco meno di mezzo schermo di scroll
    <section ref={sectionRef} data-nav-surface="velvet" aria-label="About" className="relative z-10 bg-black h-[145svh] md:h-[200vh]">
      {/* Il menu porta a sipario già aperto, sulla prima didascalia */}
      <div id="bio" aria-hidden="true" className="absolute left-0 top-[calc(100%-100svh)]" />
      {/* Punti di aggancio per lo scroll a dito */}
      {SNAP_POINTS.map((p) => (
        <div key={p} aria-hidden="true" className="snap-point absolute left-0 h-px w-px" style={{ top: `calc((100% - 100svh) * ${p})` }} />
      ))}
      {/* Tutto il testo per chi usa un lettore di schermo, senza aspettare il film */}
      <div className="sr-only">
        {SCENES.map((s, i) => <div key={i}>{s.content}</div>)}
      </div>

      <div className="sticky top-0 h-[100svh] overflow-hidden">
        {/* La stanza: tende sul fondo e pavimento a zig-zag */}
        {/* will-change: la carrellata (scale a ogni frame) la applica la GPU; senza,
            il velluto SVG e le luci verrebbero ridisegnati a ogni passo dello scroll */}
        <div data-room aria-hidden="true" className="absolute inset-0 origin-[50%_60%] will-change-transform">
          <div className="lynch-drapes absolute inset-0">
            <Velvet id="velvet-back" seed={7} freq="0.017 0.0009" />
          </div>
          <div className="absolute inset-x-0 bottom-0 h-[36%] [perspective:700px] overflow-hidden">
            <div data-floor className="lynch-floor absolute left-[-60%] right-[-60%] top-0 h-[260%] origin-top" />
          </div>
          <div className="lynch-light absolute inset-0" />
          {/* Alone scuro dietro le didascalie, per leggerle sopra velluto e pavimento */}
          <div className="lynch-scrim absolute inset-0" />
        </div>

        {/* Didascalie: una alla volta (le transizioni sono in index.css) */}
        <div aria-hidden="true" className="absolute inset-0">
          {SCENES.map((s, i) => (
            <div
              key={i}
              className={`lynch-scene absolute inset-0 flex flex-col items-center justify-center text-center px-6 pb-36 md:pb-16 pointer-events-none ${started && i === current ? 'is-active' : i < current ? 'is-past' : ''}`}
            >
              {s.content}
            </div>
          ))}
        </div>

        {/* Il sipario davanti, chiuso all'inizio */}
        <div data-curtain="left" aria-hidden="true" className="lynch-curtain absolute inset-y-0 left-0 w-1/2 origin-left">
          <Velvet id="velvet-left" seed={3} />
        </div>
        <div data-curtain="right" aria-hidden="true" className="lynch-curtain absolute inset-y-0 right-0 w-1/2 origin-right">
          <Velvet id="velvet-right" seed={11} />
        </div>
        <div data-intro aria-hidden="true" className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-xs font-semibold uppercase tracking-[0.5em] text-[#f3ead7]/80 lynch-glow">About</span>
        </div>

        {/* Pellicola: un segmento per scena, pausa, contatti. Su mobile sta sopra il "+" */}
        <div ref={barRef} className="absolute inset-x-0 bottom-24 md:bottom-8 z-10 px-6">
          <div className="mx-auto max-w-xl">
            <div className="flex gap-1.5">
              {SCENES.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Scena ${i + 1} di ${SCENES.length}`}
                  aria-current={i === current ? 'step' : undefined}
                  className="group flex-1 py-3 -my-3"
                >
                  <span className="block h-[3px] rounded-full overflow-hidden bg-[#f3ead7]/25 group-hover:bg-[#f3ead7]/45 transition-colors">
                    <span
                      ref={(el) => { fillsRef.current[i] = el }}
                      className="lynch-progress block h-full bg-[#f3ead7]"
                      // Il segmento della scena in corso lo riempie il timer
                      style={i === current && i < LAST ? undefined : { transform: `scaleX(${i <= current ? 1 : 0})` }}
                    />
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-[#f3ead7]">
                <button
                  type="button"
                  onClick={toggle}
                  aria-label={ended ? 'Rivedi da capo' : playing ? 'Metti in pausa' : 'Riprendi'}
                  className="-m-2 w-10 h-10 grid place-items-center rounded-full hover:bg-[#f3ead7]/10 focus-visible:bg-[#f3ead7]/10 transition-colors"
                >
                  {ended ? <RotateCcw size={16} /> : playing ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <span className="text-xs font-semibold tracking-[0.3em] tabular-nums text-[#f3ead7]/85 lynch-glow">
                  {pad(current + 1)} / {pad(SCENES.length)}
                </span>
              </div>
              <button
                type="button"
                onClick={onContact}
                className="rounded-full inline-flex items-center gap-2 px-5 py-2.5 border-[3px] border-[#f3ead7] text-[#f3ead7] text-xs font-semibold uppercase tracking-[0.25em] hover:bg-[#f3ead7] hover:text-black focus-visible:bg-[#f3ead7] focus-visible:text-black active:scale-95 transition-colors duration-300"
              >
                Get in touch
                <ArrowUpRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Pellicola: grana e vignettatura sopra tutto */}
        <div aria-hidden="true" className="lynch-grain absolute pointer-events-none" />
        <div aria-hidden="true" className="lynch-vignette absolute inset-0 pointer-events-none" />
      </div>
    </section>
  )
}
