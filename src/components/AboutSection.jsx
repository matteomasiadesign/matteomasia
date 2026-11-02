import React, { useEffect, useRef, useState } from 'react'
import { addWheelSnap } from '../lib/smoothScroll.js'

// --- CHI SONO: LA STANZA BUIA ---
// Atmosfera alla David Lynch: un sipario di velluto si apre su una stanza al
// buio con il pavimento a zig-zag. Una luce calda segue il cursore (sui touch
// vaga da sola) e fa emergere dal nero il pavimento e la polvere sospesa; il
// testo si sposta appena, in profondità, quando la luce si muove.
//
// Lo scroll serve solo ad aprire il sipario (con la rotella basta un gesto).
// A sipario aperto entra tutto insieme in meno di un secondo: il titolo
// (prima specchiato, poi si raddrizza) e quattro capitoli. Si
// sceglie il capitolo da leggere (hover, tap o frecce) e il testo cambia
// subito, senza aspettare nessun timer. Scrollando si esce quando si vuole.

const clamp01 = (v) => Math.min(Math.max(v, 0), 1)
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

const CURTAIN_END = 0.8 // il sipario è tutto aperto a questo punto dello scroll
const pad = (n) => String(n).padStart(2, '0')

const mark = 'text-white font-semibold'

const CHAPTERS = [
  {
    title: 'Origins',
    text: (
      <>
        Nato in <strong className={mark}>Sardegna</strong>, inizio il mio percorso nelle arti visive attraverso la fotografia. Negli anni ho espanso questo linguaggio collaborando con diversi artisti, sviluppando competenze trasversali in videomaking, post-produzione, grafica e direzione multimediale.
      </>
    ),
  },
  {
    title: 'Method',
    text: (
      <>
        Nel <strong className={mark}>2023</strong> conseguo la laurea in <strong className={mark}>Economia e Management</strong>, tornando al mondo visivo con un approccio più strutturato, strategico e orientato al business: dall'identità di marca al web design, fino allo sviluppo front-end.
      </>
    ),
  },
  {
    title: 'System',
    text: (
      <>
        Unisco tutto questo in un sistema compatto: <strong className={mark}>visione, tecnica e direzione</strong>. Un mix diretto, progettato per comunicare: posso aiutarti a strutturare una comunicazione efficace e multi-piattaforma per il tuo business, progetto o evento.
      </>
    ),
  },
  {
    title: 'End-to-End',
    text: (
      <>
        Dall'identità visiva ai contenuti, fino allo sviluppo front-end: <strong className={mark}>un unico riferimento</strong> per l'intero ecosistema digitale.
      </>
    ),
  },
]

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



// Luce, polvere e profondità: un unico ciclo per frame, acceso solo con la
// sezione vicina allo schermo. Buio e luce sono due livelli enormi spostati
// con transform (niente ridisegno); la polvere è una canvas leggera.
const useRoomLight = (stageRef, active) => {
  useEffect(() => {
    if (!active) return
    const stage = stageRef.current
    const q = (sel) => stage.querySelector(sel)
    const torch = q('[data-torch]')
    const beam = q('[data-beam]')
    const canvas = q('[data-dust]')
    const ctx = canvas.getContext('2d')
    const depth = [...stage.querySelectorAll('[data-depth]')].map((el) => [el, Number(el.dataset.depth)])
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const fine = window.matchMedia('(pointer: fine)').matches

    let w = 0
    let h = 0
    let dpr = 1
    const resize = () => {
      w = stage.clientWidth
      h = stage.clientHeight
      dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
    }
    resize()

    // Granelli di polvere: salgono piano e ondeggiano; si vedono solo vicino
    // alla luce. Posizioni e velocità in frazioni dello schermo (al secondo)
    const motes = Array.from({ length: fine ? 70 : 36 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.6 + Math.random() * 1.6,
      vy: -(0.004 + Math.random() * 0.012),
      ph: Math.random() * Math.PI * 2,
    }))

    // La luce va verso il cursore con un ritardo morbido; senza cursore (touch,
    // o mouse fuori dalla finestra) vaga lenta sul pavimento
    const light = { x: 0.5, y: 0.6 }
    let target = null
    const onMove = (e) => {
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return
      const r = stage.getBoundingClientRect()
      target = {
        x: Math.min(Math.max((e.clientX - r.left) / r.width, -0.1), 1.1),
        y: Math.min(Math.max((e.clientY - r.top) / r.height, -0.1), 1.1),
      }
    }
    const onLeave = () => { target = null }

    let raf = 0
    let last = performance.now()
    let t = 0
    const frame = (now) => {
      const dt = Math.min(now - last, 100) / 1000
      last = now
      t += dt
      const goal = target || { x: 0.5 + Math.sin(t * 0.21) * 0.24, y: 0.62 + Math.sin(t * 0.33 + 1) * 0.1 }
      const k = reduce ? 1 : 1 - Math.exp(-dt * (target ? 6 : 1.2))
      light.x += (goal.x - light.x) * k
      light.y += (goal.y - light.y) * k
      const lx = light.x * w
      const ly = light.y * h
      const at = `translate3d(${lx.toFixed(1)}px, ${ly.toFixed(1)}px, 0) translate(-50%, -50%)`
      torch.style.transform = at
      beam.style.transform = at

      // Il testo si sposta al contrario della luce: i piani più vicini di più
      if (!reduce) {
        const ox = light.x - 0.5
        const oy = light.y - 0.5
        for (const [el, d] of depth) el.style.transform = `translate3d(${(-ox * d).toFixed(2)}px, ${(-oy * d * 0.6).toFixed(2)}px, 0)`
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#f3ead7'
      const R = Math.max(w, h) * 0.3
      for (const m of motes) {
        if (!reduce) {
          m.x += Math.sin(t * 0.5 + m.ph) * 0.006 * dt
          m.y += m.vy * dt
          if (m.y < -0.02) { m.y = 1.02; m.x = Math.random() }
        }
        const px = m.x * w
        const py = m.y * h
        const d = Math.hypot(px - lx, py - ly) / R
        if (d >= 1) continue
        ctx.globalAlpha = (1 - d) * (1 - d) * (0.6 + 0.4 * Math.sin(t * 1.6 + m.ph))
        ctx.beginPath()
        ctx.arc(px, py, m.r, 0, Math.PI * 2)
        ctx.fill()
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    window.addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('mouseleave', onLeave)
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('mouseleave', onLeave)
      window.removeEventListener('resize', resize)
    }
  }, [stageRef, active])
}

export default function AboutSection() {
  const sectionRef = useRef(null)
  const stageRef = useRef(null)
  const [started, setStarted] = useState(false) // sipario aperto: la stanza si accende
  const [inView, setInView] = useState(false)
  const [active, setActive] = useState(0)

  useRoomLight(stageRef, inView)

  // Sipario richiuso: si riparte dal primo capitolo
  useEffect(() => {
    if (!started) setActive(0)
  }, [started])

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const q = (sel) => section.querySelector(sel)
    const curtainL = q('[data-curtain="left"]')
    const curtainR = q('[data-curtain="right"]')
    const floor = q('[data-floor]')
    const room = q('[data-room]')
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

      // Lenta carrellata in avanti dentro la stanza
      room.style.transform = `scale(${1 + 0.12 * p})`
      floor.style.transform = `rotateX(62deg) translateY(${p * 18}%)`

      // Si accende a sipario quasi aperto, si spegne a sipario chiuso (in mezzo
      // non cambia, così un piccolo scroll non fa ripartire l'entrata)
      if (!isOpen && open >= 0.85) { isOpen = true; setStarted(true) }
      else if (isOpen && open <= 0.1) { isOpen = false; setStarted(false) }
    }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(update) }

    // --- Con la rotella: un gesto apre il sipario, uno lo richiude ---
    const resolveWheel = (deltaY, pos, next) => {
      const top = section.getBoundingClientRect().top + window.scrollY
      const end = top + section.offsetHeight - window.innerHeight // sipario aperto
      if (end <= top) return null
      // Scendendo: quando il sipario ha coperto più di metà schermo (o è a metà
      // apertura) si va a sipario aperto, senza notch passati a guardare il velluto
      if (deltaY > 0 && pos < end - 2 && next > top - window.innerHeight * 0.4) return end
      // Risalendo dai contatti ci si ferma sulla stanza; dalla stanza il sipario si chiude
      if (deltaY < 0 && pos > top + 2 && next < end) return pos > end + 2 ? end : top
      return null
    }
    let removeSnap = null

    // --- A dito: il sipario non resta a metà. Quando lo scroll si ferma lo si
    // porta aperto o chiuso, nella direzione in cui si stava andando (mai contro) ---
    const coarse = window.matchMedia('(pointer: coarse)')
    let lastY = window.scrollY
    let dir = 1
    let touching = false
    let settle = 0
    const finishCurtain = () => {
      if (touching || !coarse.matches) return
      const rect = section.getBoundingClientRect()
      const span = rect.height - window.innerHeight
      const p = span > 0 ? -rect.top / span : 0
      if (p <= 0.02 || p >= CURTAIN_END) return
      const top = rect.top + window.scrollY
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      window.scrollTo({ top: dir > 0 ? top + span : top, behavior: reduce ? 'auto' : 'smooth' })
    }
    const onScroll = () => {
      schedule()
      const y = window.scrollY
      if (y !== lastY) dir = Math.sign(y - lastY)
      lastY = y
      clearTimeout(settle)
      settle = setTimeout(finishCurtain, 150)
    }
    const onTouchStart = () => { touching = true; clearTimeout(settle) }
    const onTouchEnd = () => { touching = false; clearTimeout(settle); settle = setTimeout(finishCurtain, 150) }

    // Ascolta lo scroll solo quando la sezione è vicina allo schermo; lontano
    // dallo schermo mette in pausa anche le animazioni infinite (luce, grana)
    let listening = false
    const io = new IntersectionObserver(([entry]) => {
      section.classList.toggle('lynch-idle', !entry.isIntersecting)
      setInView(entry.isIntersecting)
      if (entry.isIntersecting && !listening) {
        window.addEventListener('scroll', onScroll, { passive: true })
        window.addEventListener('resize', schedule)
        window.addEventListener('touchstart', onTouchStart, { passive: true })
        window.addEventListener('touchend', onTouchEnd, { passive: true })
        removeSnap = addWheelSnap(resolveWheel)
        listening = true
        lastY = window.scrollY
        schedule()
      } else if (!entry.isIntersecting && listening) {
        window.removeEventListener('scroll', onScroll)
        window.removeEventListener('resize', schedule)
        window.removeEventListener('touchstart', onTouchStart)
        window.removeEventListener('touchend', onTouchEnd)
        clearTimeout(settle)
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
      clearTimeout(settle)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  // Frecce su e giù tra i capitoli
  const onKey = (e, i) => {
    const step = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const buttons = e.currentTarget.closest('ol').querySelectorAll('button')
    buttons[(i + step + buttons.length) % buttons.length].focus()
  }

  return (
    // Su mobile il sipario si apre in poco meno di mezzo schermo di scroll
    <section ref={sectionRef} data-nav-surface="velvet" aria-label="Chi sono" className="relative z-10 bg-black h-[145svh] md:h-[200vh]">
      {/* Il menu porta a sipario già aperto */}
      <div id="bio" aria-hidden="true" className="absolute left-0 top-[calc(100%-100svh)]" />

      <div ref={stageRef} className={`sticky top-0 h-[100svh] overflow-hidden ${started ? 'is-open' : ''}`}>
        {/* La stanza: buio e pavimento a zig-zag */}
        {/* will-change: la carrellata (scale a ogni frame) la applica la GPU */}
        <div data-room aria-hidden="true" className="lynch-room absolute inset-0 origin-[50%_60%] will-change-transform">
          <div className="absolute inset-x-0 bottom-0 h-[38%] [perspective:700px] overflow-hidden">
            <div data-floor className="lynch-floor absolute left-[-60%] right-[-60%] top-0 h-[260%] origin-top" />
          </div>
        </div>
        {/* Il buio con un buco dove sta la luce, la luce calda e la polvere */}
        <div data-torch aria-hidden="true" className="lynch-torch absolute left-0 top-0 pointer-events-none" />
        <div data-beam aria-hidden="true" className="lynch-beam absolute left-0 top-0 pointer-events-none" />
        <canvas data-dust aria-hidden="true" className="absolute inset-0 w-full h-full pointer-events-none" />

        {/* Il contenuto: titolo e testo a sinistra, capitoli a destra (su mobile
            in colonna, il testo si apre sotto il capitolo scelto) */}
        <div className="relative z-10 h-full about-wrap flex flex-col justify-center pt-14 pb-24 md:py-24">
          <div className="grid-12 gap-y-7 md:items-end">
            <div data-depth="16" className="col-span-12 md:col-span-7 will-change-transform">
              <h2 className="about-in text-[clamp(1.9rem,8.4vw,2.6rem)] md:text-[clamp(2.6rem,5.4vw,5.25rem)] leading-[1.02] whitespace-nowrap text-[#f3ead7] lynch-glow" style={{ '--i': 0 }}>
                <span className="about-flip inline-block">Designer,<br /><span className="text-[#f3ead7]/50">class of ’97.</span></span>
              </h2>
              {/* Su desktop il testo del capitolo scelto: tutti nello stesso posto,
                  alto quanto il più lungo, così cambiando nulla salta */}
              <div className="about-in hidden md:grid mt-10 lg:mt-12 max-w-2xl" style={{ '--i': 1 }}>
                {CHAPTERS.map((c, i) => (
                  <p
                    key={c.title}
                    className={`about-text [grid-area:1/1] text-xl lg:text-2xl font-medium leading-relaxed text-[#f3ead7]/90 lynch-glow ${i === active ? 'is-active' : ''}`}
                  >
                    {c.text}
                  </p>
                ))}
              </div>
            </div>

            <div data-depth="7" className="col-span-12 md:col-span-5 md:col-start-8 lg:col-span-4 lg:col-start-9 will-change-transform">
              <ol className="border-b border-[#f3ead7]/15">
                {CHAPTERS.map((c, i) => (
                  <li key={c.title} className={`about-in about-ch relative border-t border-[#f3ead7]/15 ${i === active ? 'is-active' : ''}`} style={{ '--i': 2 + i }}>
                    <span aria-hidden="true" className="about-ch-line absolute left-0 right-0 -top-px h-px bg-[#f3ead7]" />
                    <button
                      type="button"
                      aria-expanded={i === active}
                      onClick={() => setActive(i)}
                      onPointerEnter={(e) => { if (e.pointerType === 'mouse') setActive(i) }}
                      onFocus={() => setActive(i)}
                      onKeyDown={(e) => onKey(e, i)}
                      className="w-full flex items-baseline gap-4 md:gap-5 py-3 md:py-5 text-left focus-visible:outline-offset-[-3px]"
                    >
                      <span className="about-ch-num text-[11px] font-semibold tabular-nums tracking-[0.3em]">{pad(i + 1)}</span>
                      <span className="about-ch-title font-display flex-1 min-w-0 text-xl md:text-3xl leading-tight">{c.title}</span>
                    </button>
                    {/* Su mobile il testo si apre sotto il capitolo */}
                    <div className="about-acc md:hidden">
                      <div className="overflow-hidden">
                        <p className="pb-4 pl-9 text-[15px] leading-[1.6] text-[#f3ead7]/90">{c.text}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>

        {/* Il sipario davanti, chiuso all'inizio */}
        <div data-curtain="left" aria-hidden="true" className="lynch-curtain absolute inset-y-0 left-0 w-1/2 origin-left z-20">
          <Velvet id="velvet-left" seed={3} />
        </div>
        <div data-curtain="right" aria-hidden="true" className="lynch-curtain absolute inset-y-0 right-0 w-1/2 origin-right z-20">
          <Velvet id="velvet-right" seed={11} />
        </div>

        {/* Pellicola: grana e vignettatura sopra tutto */}
        <div aria-hidden="true" className="lynch-grain absolute pointer-events-none z-30" />
        <div aria-hidden="true" className="lynch-vignette absolute inset-0 pointer-events-none z-30" />
      </div>
    </section>
  )
}
