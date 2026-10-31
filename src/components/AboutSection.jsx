import React, { useEffect, useRef, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { getLenis, setWheelInterceptor } from '../lib/smoothScroll.js'

// --- CHI SONO: LA STANZA ROSSA ---
// Atmosfera alla David Lynch: un sipario di velluto si apre su una stanza con
// tende cremisi e pavimento a zig-zag, una luce che tremola, grana di pellicola.
// La scena resta fissata al centro dello schermo; scorrendo, i testi compaiono
// uno alla volta come didascalie: emergono dal buio sfocati, restano, svaniscono.
// Il titolo appare prima specchiato e poi si raddrizza.
//
// Ogni scena ha data-from / data-to: la parte dello scroll della sezione (0..1)
// in cui è visibile. L'ultima (data-last) non svanisce.
//
// Con la rotella non c'è scroll intermedio: ogni gesto porta alla scena dopo
// (o prima) con un'animazione. Sui touch ci pensano i punti di aggancio CSS.

const clamp01 = (v) => Math.min(Math.max(v, 0), 1)
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
const easeOut = (t) => 1 - Math.pow(1 - t, 3)

const CURTAIN_END = 0.12 // il sipario è tutto aperto a questo punto dello scroll
const SNAP_S = 1.15 // durata del passaggio da una scena all'altra, in secondi
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

// Le fermate: sipario chiuso, il centro di ogni scena, la fine della sezione
const sceneStop = (from, to, last) => (last ? from + (to - from) * 0.6 : (from + to) / 2)
// Fermate delle scene qui sotto (data-from / data-to), per l'aggancio touch
const SCENES = [[0.12, 0.27], [0.27, 0.42], [0.42, 0.57], [0.57, 0.72], [0.72, 0.86], [0.86, 0.97, true]]
const SNAP_POINTS = [0, ...SCENES.map(([f, t, last]) => sceneStop(f, t, last)), 1]

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

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const q = (sel) => section.querySelector(sel)
    const curtainL = q('[data-curtain="left"]')
    const curtainR = q('[data-curtain="right"]')
    const intro = q('[data-intro]')
    const floor = q('[data-floor]')
    const room = q('[data-room]')
    // Dati delle didascalie letti una volta sola; "last" ricorda l'ultimo stato
    // scritto, così a ogni frame si tocca solo lo stile che cambia davvero
    const scenes = [...section.querySelectorAll('[data-scene]')].map((el) => ({
      el,
      from: parseFloat(el.dataset.from),
      to: parseFloat(el.dataset.to),
      last: el.dataset.last !== undefined,
      flip: el.querySelector('[data-flip]'),
      prev: { op: -1, y: null, flip: null },
    }))

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

      // Lenta carrellata in avanti dentro la stanza
      room.style.transform = `scale(${1 + 0.12 * p})`
      floor.style.transform = `rotateX(62deg) translateY(${p * 18}%)`

      for (const s of scenes) {
        const { el, from, to, last, flip, prev } = s
        const t = (p - from) / (to - from)
        let op = 0
        if (t >= 0 && (t <= 1 || last)) op = clamp01(Math.min(1, t / 0.3, last ? 1 : (1 - t) / 0.3))
        const y = `translateY(${(1 - op) * (t < 0.5 ? 14 : -14)}px)`
        if (op !== prev.op) {
          const fading = op > 0 && op < 1
          // Spenta del tutto: nascosta, così il browser non ridisegna testi e ombre
          el.style.visibility = op > 0 ? '' : 'hidden'
          el.style.opacity = String(op)
          el.style.filter = fading ? `blur(${(1 - op) * 10}px)` : ''
          // Solo mentre sfuma ha un livello suo: sfocatura e opacità le applica la
          // GPU senza ridisegnare i testi con l'alone a ogni frame
          el.style.willChange = fading ? 'opacity, transform, filter' : ''
          el.style.pointerEvents = op > 0.6 ? 'auto' : 'none'
          prev.op = op
        }
        if (y !== prev.y) { el.style.transform = y; prev.y = y }
        // Il titolo: specchiato all'inizio, si raddrizza girando su se stesso
        if (flip) {
          const f = `scaleX(${-1 + 2 * easeOut(clamp01(t / 0.4))})`
          if (f !== prev.flip) { flip.style.transform = f; prev.flip = f }
        }
      }
    }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(update) }

    // --- Scatto da una scena all'altra con la rotella ---
    const stops = [0, ...scenes.map((s) => sceneStop(s.from, s.to, s.last)), 1]
    let snapping = false
    let lastWheel = 0
    let lastAbs = 0
    const snap = (lenis, y) => {
      snapping = true
      lenis.scrollTo(y, {
        duration: SNAP_S,
        easing: easeInOutCubic,
        lock: true,
        force: true,
        onComplete: () => { snapping = false; lastWheel = performance.now() },
      })
    }
    const intercept = ({ deltaY, event }) => {
      const lenis = getLenis()
      if (!lenis || !event.type.includes('wheel') || event.ctrlKey || !deltaY) return false
      if (snapping) { event.preventDefault(); return true }
      // Un gesto nuovo: una pausa, o una spinta più forte della coda d'inerzia
      const now = performance.now()
      const abs = Math.abs(deltaY)
      const fresh = now - lastWheel > 160 || abs > lastAbs * 1.6 + 4
      lastWheel = now
      lastAbs = abs
      const top = section.getBoundingClientRect().top + window.scrollY
      const span = section.offsetHeight - window.innerHeight
      if (span <= 0) return false
      const dir = Math.sign(deltaY)
      const p = (lenis.animatedScroll - top) / span
      // Da fuori: entrando ci si aggancia al bordo della sezione
      if (p < -0.001) {
        if (dir > 0 && lenis.targetScroll + deltaY >= top) { event.preventDefault(); snap(lenis, top); return true }
        return false
      }
      if (p > 1.001) {
        if (dir < 0 && lenis.targetScroll + deltaY <= top + span) { event.preventDefault(); snap(lenis, top + span); return true }
        return false
      }
      // Ai due capi si esce con lo scroll normale
      if ((dir < 0 && p <= 0.002) || (dir > 0 && p >= 0.998)) return false
      event.preventDefault()
      if (!fresh) return true
      const next = dir > 0
        ? stops.find((s) => s > p + 0.01) ?? 1
        : [...stops].reverse().find((s) => s < p - 0.01) ?? 0
      snap(lenis, top + next * span)
      return true
    }

    // Ascolta lo scroll solo quando la sezione è vicina allo schermo; lontano
    // dallo schermo mette in pausa anche le animazioni infinite (tende, luce, grana)
    let listening = false
    const io = new IntersectionObserver(([entry]) => {
      section.classList.toggle('lynch-idle', !entry.isIntersecting)
      if (entry.isIntersecting && !listening) {
        window.addEventListener('scroll', schedule, { passive: true })
        window.addEventListener('resize', schedule)
        setWheelInterceptor(intercept)
        listening = true
        schedule()
      } else if (!entry.isIntersecting && listening) {
        window.removeEventListener('scroll', schedule)
        window.removeEventListener('resize', schedule)
        setWheelInterceptor(null)
        listening = false
        update()
      }
    }, { rootMargin: '25% 0px 25% 0px' })
    io.observe(section)
    update()

    return () => {
      io.disconnect()
      setWheelInterceptor(null)
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [])

  const label = 'block text-xs font-semibold uppercase tracking-[0.35em] text-[#f3ead7]/85'
  const body = 'text-lg md:text-2xl font-medium leading-relaxed text-[#f3ead7]'
  const scene = 'absolute inset-0 flex flex-col items-center justify-center text-center px-6 opacity-0 pointer-events-none'

  return (
    <section ref={sectionRef} data-nav-surface="velvet" className="relative z-10 bg-black h-[480vh]">
      {/* Il menu porta a sipario già aperto, sulla prima didascalia */}
      <div id="bio" aria-hidden="true" className="absolute left-0 top-[calc((100%-100svh)*0.195)]" />
      {/* Punti di aggancio per lo scroll a dito, uno per fermata */}
      {SNAP_POINTS.map((p) => (
        <div key={p} aria-hidden="true" className="about-snap absolute left-0 h-px w-px" style={{ top: `calc((100% - 100svh) * ${p})` }} />
      ))}

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

        {/* Didascalie */}
        <div className="absolute inset-0">
          <div data-scene data-from="0.12" data-to="0.27" className={scene}>
            <span className={label}>About</span>
            <h2 className="mt-6 text-4xl md:text-7xl leading-[1.05] text-[#f3ead7] lynch-glow">
              <span data-flip className="inline-block will-change-transform">Designer,<br /><span className="text-[#f3ead7]/60">class of ’97.</span></span>
            </h2>
          </div>

          <div data-scene data-from="0.27" data-to="0.42" className={scene}>
            <p className={`${body} max-w-2xl lynch-glow`}>
              Nato in <strong className="text-white font-semibold underline decoration-[#ff2b1c] decoration-2 underline-offset-4">Sardegna</strong>, inizio il mio percorso nelle arti visive attraverso la fotografia. Negli anni ho espanso questo linguaggio collaborando con diversi artisti, sviluppando competenze trasversali in videomaking, post-produzione, grafica e direzione multimediale.
            </p>
          </div>

          <div data-scene data-from="0.42" data-to="0.57" className={scene}>
            <p className={`${body} max-w-2xl lynch-glow`}>
              Nel <strong className="text-white font-semibold underline decoration-[#ff2b1c] decoration-2 underline-offset-4">2023</strong> conseguo la laurea in <strong className="text-white font-semibold underline decoration-[#ff2b1c] decoration-2 underline-offset-4">Economia e Management</strong>, tornando al mondo visivo con un approccio più strutturato, strategico e orientato al business: dal 3D modeling al web design e front-end engineering.
            </p>
          </div>

          <div data-scene data-from="0.57" data-to="0.72" className={scene}>
            <p className="max-w-3xl text-2xl md:text-4xl font-semibold leading-snug text-[#f3ead7] lynch-glow">
              Unisco tutto questo in un sistema compatto: visione, tecnica e direzione.
            </p>
            <p className="mt-6 max-w-xl text-base md:text-lg leading-relaxed text-[#f3ead7]/90 lynch-glow">
              Un mix diretto, progettato per comunicare. Posso aiutarti a strutturare una comunicazione efficace e multi-piattaforma per il tuo business, progetto o evento.
            </p>
          </div>

          <div data-scene data-from="0.72" data-to="0.86" className={scene}>
            <span className={label}>Design + Code · Full-Stack</span>
            <h3 className="mt-5 text-4xl md:text-6xl text-[#f3ead7] lynch-glow">End-to-End</h3>
            <p className="mt-5 max-w-lg text-base md:text-xl leading-relaxed text-[#f3ead7]/90 lynch-glow">
              Dall'identità visiva e 3D fino allo sviluppo front-end moderno: un unico riferimento per l'intero ecosistema digitale.
            </p>
          </div>

          <div data-scene data-last data-from="0.86" data-to="0.97" className={scene}>
            <span className={`${label} flex items-center gap-3`}>
              <span className="w-2 h-2 rounded-full bg-[#ff2b1c] lynch-flicker" /> Available for projects
            </span>
            <p className="mt-5 text-lg md:text-2xl text-[#f3ead7] lynch-glow">Porto Torres, Sardegna · Remote & on-site</p>
            <button
              onClick={onContact}
              className="mt-10 group flex items-center gap-3 px-7 py-3.5 border border-[#f3ead7]/60 text-[#f3ead7] text-sm uppercase tracking-[0.3em] hover:bg-[#f3ead7] hover:text-black focus-visible:bg-[#f3ead7] focus-visible:text-black transition-colors duration-500"
            >
              Get in touch
              <ArrowUpRight size={16} />
            </button>
          </div>
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

        {/* Pellicola: grana e vignettatura sopra tutto */}
        <div aria-hidden="true" className="lynch-grain absolute pointer-events-none" />
        <div aria-hidden="true" className="lynch-vignette absolute inset-0 pointer-events-none" />
      </div>
    </section>
  )
}
