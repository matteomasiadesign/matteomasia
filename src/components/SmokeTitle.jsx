import React, { useEffect, useRef } from 'react'
import { createSmokeFluid, FLUID } from '../lib/smokeFluid.js'

// --- TITOLO CHE SI SBRICIOLA IN FUMO ---
// Il font (Doto) è fatto di puntini su una griglia, e l'effetto lavora sui
// puntini come un retino di stampa: avvicinando il cursore si restringono, di
// più quanto più sono vicini, e quelli quasi spariti si staccano, volano verso
// il cursore e diventano fumo strada facendo. Allontanando il cursore tornano
// a gonfiarsi. Entrando nel titolo tutto esplode in una nube e poi le lettere
// si ricompongono con un'onda di puntini da sinistra a destra.
// Su touch basta un tocco per l'esplosione.
//
// Come funziona: finché l'effetto è fermo si vede il testo vero. Appena serve,
// il titolo viene ridisegnato identico su una canvas (stessa font, stesse
// posizioni) e il testo vero diventa trasparente. Ogni puntino cambiato viene
// cancellato dal testo e ridisegnato in scala, ritagliandolo da una copia del
// titolo: così ha sempre la forma vera del puntino di Doto, anche in volo.
// Ogni puntino staccato è una particella e disegna una maschera da cui la
// simulazione di fluido (src/lib/smokeFluid.js) fa uscire il fumo. Quando
// tutto è tornato a posto si torna al testo vero.

const HOLD_MS = 900 // quanto resta la nube prima che il titolo si ricomponga
const REFORM_MS = 1500
const LINGER_MS = 7000 // dopo l'ultimo puntino, il tempo perché il fumo svanisca
const RATE = 11 // fumo rilasciato al secondo da un puntino in volo
const MASK_SCALE = 0.5 // risoluzione della maschera rispetto al fumo
const SHRINK_MS = 140 // quanto in fretta un puntino si restringe verso il cursore
const RELAX_MS = 380 // e quanto in fretta torna grande quando il cursore si allontana
const MAX_SHRINK = 0.85 // quanto si restringe al massimo un puntino col cursore addosso
// Ogni puntino si stacca sotto una sua scala, scelta a caso in questo
// intervallo: già a media distanza se ne staccano alcuni qua e là
const DETACH_MIN = 0.15
const DETACH_MAX = 0.7
const REGROW_GAP = 0.2 // un puntino staccato ricresce quando potrebbe stare così sopra la sua soglia
const CRUMBLE_PER_MS = 0.25 // puntini staccati al ms, al massimo
const MAX_PARTICLES = 900

const rand = (a, b) => a + Math.random() * (b - a)
const clamp01 = (v) => Math.min(Math.max(v, 0), 1)
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t) }
// Arriva con un piccolo rimbalzo oltre la misura piena
const easeOutBack = (t) => { const c = 1.2; const u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u }

export default function SmokeTitle({ lines, className = '' }) {
  const wrapRef = useRef(null)
  const titleRef = useRef(null)
  const textRef = useRef(null)
  const canvasRef = useRef(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const title = titleRef.current
    const textCanvas = textRef.current
    const canvas = canvasRef.current
    if (!wrap || !title || !textCanvas || !canvas) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const hero = wrap.closest('section') || wrap.parentElement
    const fluid = createSmokeFluid(canvas)
    const tctx = textCanvas.getContext('2d')
    const mask = document.createElement('canvas')
    const mctx = mask.getContext('2d')
    // Copia del titolo da cui si ritagliano i puntini
    const source = document.createElement('canvas')
    const sctx = source.getContext('2d')
    const letterEls = [...title.querySelectorAll('[data-smoke]')]
    // Prima che le parole abbiano finito di entrare l'effetto resta spento
    const words = title.querySelectorAll('.hero-reveal-word').length
    const readyAt = performance.now() + words * 280 + 1500

    // Lettera: { text, x, y, w, h, base }
    // Puntino: { x, y, s, sx, sy, k, g, sc, on, healAt, kind, bias }
    //   k = scala dovuta al cursore, g = quanto è ricresciuto dopo il distacco,
    //   sc = scala disegnata, sx/sy = dove si trova nella copia del titolo
    let letters = []
    let dots = []
    let particles = []
    let W = 1
    let H = 1
    let dpr = 1
    let pxPerCell = 8
    let fontSize = 100
    let font = ''
    let color = '#000'
    let dotC = 4 // dal bordo della cella al centro del puntino
    let measured = false
    let showing = false // true: si vede la canvas, il testo vero è trasparente
    let raf = 0
    let last = 0
    let time = 0
    let lastActive = 0
    let mode = 'idle' // idle | burst | reform
    let modeStart = 0
    let burstNow = false
    let blocked = false // dopo un'esplosione serve uscire dal titolo per la prossima
    let maskEmpty = true
    let shrunk = false // qualche puntino è ristretto ma ancora al suo posto
    let crumble = 0
    // Cursore in px CSS rispetto alla hero
    const pointer = { x: -1e4, y: -1e4, vx: 0, vy: 0, t: 0, inside: false, inHero: false, moved: false }

    // Dimensioni della hero, posizione delle lettere e puntini di ogni glifo
    const measure = () => {
      const hr = hero.getBoundingClientRect()
      const wr = wrap.getBoundingClientRect()
      W = hr.width
      H = hr.height
      dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      for (const c of [textCanvas, canvas]) {
        c.style.left = `${hr.left - wr.left}px`
        c.style.top = `${hr.top - wr.top}px`
        c.style.width = `${W}px`
        c.style.height = `${H}px`
      }
      textCanvas.width = Math.round(W * dpr)
      textCanvas.height = Math.round(H * dpr)
      if (fluid) {
        const info = fluid.resize(W, H)
        pxPerCell = info.pxPerCell
        mask.width = Math.round(info.dyeW * MASK_SCALE)
        mask.height = Math.round(info.dyeH * MASK_SCALE)
      }

      const cs = getComputedStyle(title)
      fontSize = parseFloat(cs.fontSize)
      font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
      if (!showing) color = cs.color

      // I glifi disegnati su una canvas grande quanto il titolo, per leggere
      // quali celle della griglia sono piene
      const glyphs = document.createElement('canvas')
      const gw = Math.ceil(wr.width) + 2
      const gh = Math.ceil(wr.height) + 2
      glyphs.width = gw
      glyphs.height = gh
      const g = glyphs.getContext('2d', { willReadFrequently: true })
      g.font = font
      g.textBaseline = 'alphabetic'
      const metrics = g.measureText('M')
      const asc = metrics.fontBoundingBoxAscent ?? fontSize * 0.8
      const desc = metrics.fontBoundingBoxDescent ?? fontSize * 0.2
      // Doto è monospazio su una griglia di 6 colonne per carattere
      const pitch = metrics.width / 6
      const rects = letterEls.map((el) => el.getBoundingClientRect())
      const baseOf = (r) => r.top - wr.top + (r.height - (asc + desc)) / 2 + asc
      rects.forEach((r, i) => g.fillText(letterEls[i].textContent, r.left - wr.left, baseOf(r)))
      const data = g.getImageData(0, 0, gw, gh).data
      const alpha = (x, y) => {
        const xi = Math.round(x)
        const yi = Math.round(y)
        return xi >= 0 && yi >= 0 && xi < gw && yi < gh ? data[(yi * gw + xi) * 4 + 3] : 0
      }
      const ox = wr.left - hr.left
      const oy = wr.top - hr.top

      // La stessa copia a piena risoluzione, per ritagliare i puntini
      source.width = Math.ceil(gw * dpr)
      source.height = Math.ceil(gh * dpr)
      sctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      sctx.font = font
      sctx.textBaseline = 'alphabetic'
      sctx.fillStyle = color
      rects.forEach((r, i) => sctx.fillText(letterEls[i].textContent, r.left - wr.left, baseOf(r)))

      dots = []
      let dotW = 0
      letters = rects.map((r, i) => {
        const x0 = Math.floor(r.left - wr.left)
        const y0 = Math.floor(r.top - wr.top)
        const x1 = Math.min(gw, Math.ceil(r.right - wr.left))
        const y1 = Math.min(gh, Math.ceil(r.bottom - wr.top))
        // Dove comincia l'inchiostro (a meno del pixel): lì comincia la griglia
        let left = Infinity
        let top = Infinity
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const a = data[(y * gw + x) * 4 + 3]
            if (a > 20) {
              left = Math.min(left, x + 1 - a / 255)
              top = Math.min(top, y + 1 - a / 255)
            }
          }
        }
        if (Number.isFinite(left)) {
          for (let cy = top; cy < y1; cy += pitch) {
            for (let cx = left; cx < x1; cx += pitch) {
              if (alpha(cx + pitch / 2, cy + pitch / 2) <= 120) continue
              // Il puntino sta nell'angolo in alto a sinistra della cella:
              // la sua larghezza dice attorno a quale centro restringerlo
              if (!dotW) {
                const yi = Math.round(cy + pitch * 0.4)
                for (let xi = Math.round(cx); xi < Math.round(cx + pitch); xi++) if (alpha(xi, yi) > 127) dotW++
              }
              dots.push({
                x: cx + ox, y: cy + oy, s: pitch,
                sx: cx * dpr, sy: cy * dpr,
                k: 1, g: 1, sc: 1, on: true, healAt: Infinity, kind: '',
                bias: rand(0.7, 1.2), cut: rand(DETACH_MIN, DETACH_MAX),
              })
            }
          }
        }
        return {
          text: letterEls[i].textContent,
          x: r.left - hr.left, y: r.top - hr.top, w: r.width, h: r.height,
          base: baseOf(r) + oy,
        }
      })
      dotC = Math.min(Math.max(dotW, pitch * 0.5), pitch) / 2
      particles = []
      maskEmpty = false
      measured = true
    }

    const addParticle = (p) => { if (particles.length < MAX_PARTICLES) particles.push(p) }

    // Un puntino si stacca e diventa particella, grande quanto era in quel
    // momento; con toCursor vola verso il cursore, altrimenti sale con l'aria calda
    const detach = (d, toCursor, burstFrom) => {
      const k0 = Math.max(d.sc, 0.15)
      d.on = false
      d.g = 0
      d.sc = 0
      d.healAt = Infinity
      const x = d.x + dotC
      const y = d.y + dotC
      let vx
      let vy
      if (burstFrom) {
        const dx = x - burstFrom.x
        const dy = y - burstFrom.y
        const n = Math.hypot(dx, dy) || 1
        const sp = rand(0.04, 0.16)
        vx = (dx / n) * sp + rand(-0.06, 0.06)
        vy = (dy / n) * sp * 0.7 + rand(-0.08, 0.03)
      } else if (toCursor) {
        const dx = pointer.x - x
        const dy = pointer.y - y
        const n = Math.hypot(dx, dy) || 1
        const sp = rand(0.02, 0.06)
        vx = (dx / n) * sp + rand(-0.02, 0.02)
        vy = (dy / n) * sp + rand(-0.02, 0.02)
      } else {
        vx = rand(-0.01, 0.01)
        vy = -rand(0.02, 0.04)
      }
      addParticle({
        x, y, vx, vy,
        age: 0, life: burstFrom ? rand(700, 1500) : rand(900, 1700),
        s: d.s, sx: d.sx, sy: d.sy, k0, seed: Math.random() * 100,
        attract: !!toCursor,
      })
    }

    // Esplosione: tutti i puntini volano via in una nube di fumo, spinti in
    // fuori dal centro del titolo
    const burst = () => {
      mode = 'burst'
      modeStart = performance.now()
      burstNow = true
      blocked = true
      const cx = letters.reduce((s, L) => s + L.x + L.w / 2, 0) / letters.length
      const cy = letters.reduce((s, L) => s + L.y + L.h / 2, 0) / letters.length
      for (const d of dots) {
        if (d.on || d.sc > 0) detach(d, false, { x: cx, y: cy })
        d.healAt = Infinity
      }
      if (!fluid) return
      for (const L of letters) {
        const lx = L.x + L.w / 2
        const ly = L.y + L.h / 2
        const dx = lx - cx
        const dy = ly - cy
        const n = Math.hypot(dx, dy) || 1
        const sp = rand(0.06, 0.16)
        const ang = rand(-Math.PI, Math.PI)
        push(
          lx, ly,
          (dx / n) * sp + Math.cos(ang) * 0.08 + Math.max(-0.2, Math.min(0.2, pointer.vx * 0.05)),
          (dy / n) * sp * 0.6 + Math.sin(ang) * 0.08 + Math.max(-0.2, Math.min(0.2, pointer.vy * 0.05)) - 0.04,
          fontSize * rand(0.5, 0.8),
        )
      }
    }

    // Ricomposizione: un'onda di puntini che si gonfiano da sinistra a destra
    const reform = (now) => {
      mode = 'reform'
      modeStart = now
      let x0 = Infinity
      let x1 = -Infinity
      for (const d of dots) { x0 = Math.min(x0, d.x); x1 = Math.max(x1, d.x) }
      const span = Math.max(x1 - x0, 1)
      for (const d of dots) {
        d.kind = 'reform'
        d.healAt = now + ((d.x - x0) / span) * REFORM_MS * 0.6 + rand(0, REFORM_MS * 0.25)
      }
    }

    // Spinta nel fluido in px/ms del cursore, convertita in celle al secondo
    const push = (x, y, vx, vy, radiusPx) => {
      const k = 1000 / pxPerCell
      fluid.splat(x / W, 1 - y / H, vx * k, -vy * k, 0, (radiusPx / H) ** 2, false)
    }

    // Da quanto lontano il cursore comincia a sbriciolare le lettere
    const reach = () => Math.max(fontSize * 3.2, 200)

    const updateDots = (now, dt) => {
      const R = reach()
      const eroding = mode === 'idle' && pointer.inside
      crumble = Math.min(crumble + dt * CRUMBLE_PER_MS, 6)
      shrunk = false
      // Si parte da un punto a caso, così il limite di distacchi per frame
      // non favorisce sempre le prime lettere
      const n = dots.length
      const first = (Math.random() * n) | 0
      for (let j = 0; j < n; j++) {
        const d = dots[(first + j) % n]
        // Retino: vicino al cursore il puntino si restringe fino a sparire,
        // con un po' di caso perché il bordo non sia un cerchio perfetto
        let target = 1
        if (eroding) {
          const dist = Math.hypot(d.x + dotC - pointer.x, d.y + dotC - pointer.y)
          target = clamp01(1 - (1 - smooth(0, R, dist)) * MAX_SHRINK * d.bias)
        }
        d.k += (target - d.k) * (1 - Math.exp(-dt / (target < d.k ? SHRINK_MS : RELAX_MS)))
        if (target === 1 && d.k > 0.995) d.k = 1

        if (d.on) {
          if (eroding && d.k < d.cut && crumble >= 1) {
            crumble -= 1
            detach(d, pointer.inHero)
          }
        } else if (d.healAt === Infinity) {
          // Staccato: ricresce quando il cursore gli lascia spazio
          if (mode === 'idle' && target > Math.min(d.cut + REGROW_GAP, 0.95)) {
            d.kind = 'erode'
            d.healAt = now + rand(0, 250)
          }
        } else if (now > d.healAt) {
          d.g += dt / (d.kind === 'reform' ? 420 : 520)
          if (d.g >= 1) {
            d.g = 1
            d.on = true
            d.healAt = Infinity
            d.kind = ''
          }
        }
        d.sc = d.on ? d.k : now > d.healAt ? d.k * easeOutBack(d.g) : 0
        if (d.on && d.k < 0.9) shrunk = true
      }
    }

    const updateParticles = (dt) => {
      let alive = 0
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        p.age += dt
        if (p.age >= p.life) continue
        particles[alive++] = p
        if (p.attract && pointer.inHero) {
          // Attirato dal cursore, con un filo di rotazione attorno
          const dx = pointer.x - p.x
          const dy = pointer.y - p.y
          const d = Math.hypot(dx, dy) || 1
          const a = 0.00045 * dt
          p.vx += (dx / d) * a - (dy / d) * a * 0.35
          p.vy += (dy / d) * a + (dx / d) * a * 0.35
          if (d < fontSize * 0.35) p.age += dt // arrivato: si dissolve
        } else {
          p.vy -= 0.00006 * dt // l'aria calda lo porta su
        }
        // Un po' di turbolenza, poi l'attrito dell'aria
        p.vx += Math.sin(p.y * 0.045 + time * 0.0021 + p.seed) * 0.00009 * dt
        p.vy += Math.cos(p.x * 0.04 + time * 0.0017 + p.seed) * 0.00006 * dt
        const drag = Math.pow(0.986, dt / 16.67)
        p.vx *= drag
        p.vy *= drag
        p.x += p.vx * dt
        p.y += p.vy * dt
      }
      particles.length = alive
    }

    // Un puntino ritagliato dalla copia del titolo, in scala attorno al suo centro
    const drawDot = (cx, cy, sx, sy, s, k) => {
      const z = s * k
      tctx.drawImage(source, sx, sy, s * dpr, s * dpr, cx - dotC * k, cy - dotC * k, z, z)
    }

    // Lettere (con i puntini cambiati ridisegnati in scala) e puntini in volo
    const drawText = () => {
      tctx.setTransform(1, 0, 0, 1, 0, 0)
      tctx.clearRect(0, 0, textCanvas.width, textCanvas.height)
      tctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      tctx.font = font
      tctx.textBaseline = 'alphabetic'
      tctx.fillStyle = color
      tctx.globalAlpha = 1
      for (const L of letters) tctx.fillText(L.text, L.x, L.base)
      // Prima si cancellano tutte le celle cambiate, poi si ridisegnano: un
      // puntino che rimbalza oltre la misura piena sborda nella cella accanto
      tctx.globalCompositeOperation = 'destination-out'
      for (const d of dots) {
        if (d.sc !== 1) tctx.fillRect(d.x - 0.3, d.y - 0.3, d.s + 0.6, d.s + 0.6)
      }
      tctx.globalCompositeOperation = 'source-over'
      for (const d of dots) {
        if (d.sc !== 1 && d.sc > 0.02) drawDot(d.x + dotC, d.y + dotC, d.sx, d.sy, d.s, d.sc)
      }
      // Il puntino si consuma diventando fumo: rimpicciolisce e svanisce
      for (const p of particles) {
        const t = p.age / p.life
        tctx.globalAlpha = 1 - smooth(0.2, 0.95, t)
        drawDot(p.x, p.y, p.sx, p.sy, p.s, p.k0 * (1 - 0.7 * smooth(0, 1, t)))
      }
      tctx.globalAlpha = 1
    }

    // Maschera del fumo: i puntini in volo (più fumo man mano che si
    // consumano), un filo da quelli ristretti e, nel frame dell'esplosione,
    // tutte le lettere piene
    const drawMask = () => {
      if (!particles.length && !burstNow && !shrunk && maskEmpty) return
      mctx.setTransform(1, 0, 0, 1, 0, 0)
      mctx.clearRect(0, 0, mask.width, mask.height)
      mctx.setTransform(mask.width / W, 0, 0, mask.height / H, 0, 0)
      mctx.fillStyle = '#000'
      if (burstNow) {
        mctx.font = font
        mctx.textBaseline = 'alphabetic'
        for (const L of letters) mctx.fillText(L.text, L.x, L.base)
      }
      for (const p of particles) {
        const t = p.age / p.life
        mctx.globalAlpha = smooth(0, 0.3, t) * (1 - smooth(0.7, 1, t))
        const r = p.s * p.k0 * (0.6 + t)
        mctx.fillRect(p.x - r, p.y - r, r * 2, r * 2)
      }
      if (shrunk) {
        for (const d of dots) {
          if (!d.on || d.k >= 0.9) continue
          mctx.globalAlpha = (1 - d.k) * 0.2
          mctx.fillRect(d.x + dotC - d.s * 0.4, d.y + dotC - d.s * 0.4, d.s * 0.8, d.s * 0.8)
        }
      }
      mctx.globalAlpha = 1
      maskEmpty = !particles.length && !burstNow && !shrunk
      fluid.setMask(mask)
    }

    const tick = (now) => {
      const dt = Math.min(now - last, 50)
      last = now
      time += dt
      const ready = now > readyAt
      if (ready && !measured) measure()

      if (ready) {
        if (mode === 'burst' && now - modeStart > HOLD_MS) reform(now)
        else if (mode === 'reform' && dots.every((d) => d.on)) mode = 'idle'
        updateDots(now, dt)
        updateParticles(dt)
      }

      // Si passa alla canvas solo mentre qualcosa è ristretto, staccato o in volo
      const busy = particles.length > 0 || mode !== 'idle' || dots.some((d) => d.sc !== 1)
      if (busy) {
        drawText()
        if (!showing) { showing = true; title.style.color = 'transparent' }
      } else if (showing) {
        showing = false
        title.style.color = ''
        tctx.setTransform(1, 0, 0, 1, 0, 0)
        tctx.clearRect(0, 0, textCanvas.width, textCanvas.height)
      }

      if (fluid && measured) {
        drawMask()
        // La mano nel fumo: muovendo il cursore si sposta un po' d'aria
        if (pointer.moved && pointer.inHero) {
          const sp = Math.hypot(pointer.vx, pointer.vy)
          if (sp > 0.05) {
            const k = (Math.min(sp, 1.2) / sp) * 0.14
            push(pointer.x, pointer.y, pointer.vx * k, pointer.vy * k, fontSize * 0.5)
          }
        }
        fluid.step(dt / 1000, {
          time: time / 1000,
          pointer: [pointer.x / W, 1 - pointer.y / H],
          rate: RATE,
          burst: burstNow ? 3.2 : 0,
          attract: pointer.inHero ? FLUID.ATTRACT : 0,
        })
        fluid.render()
      }
      pointer.moved = false
      burstNow = false

      // Il loop si ferma quando è tutto ricomposto e il fumo è svanito
      if (busy || pointer.inside || !ready) lastActive = now
      if (now - lastActive < LINGER_MS) {
        raf = requestAnimationFrame(tick)
      } else {
        if (fluid) fluid.reset()
        raf = 0
      }
    }

    const wake = () => {
      if (raf) return
      last = performance.now()
      lastActive = last
      raf = requestAnimationFrame(tick)
    }

    const onMove = (e) => {
      if (e.pointerType !== 'mouse') return
      const hr = hero.getBoundingClientRect()
      const x = e.clientX - hr.left
      const y = e.clientY - hr.top
      const now = performance.now()
      const dtp = Math.max(now - pointer.t, 1)
      if (pointer.t && now - pointer.t < 100) {
        // Velocità smussata del cursore, in px/ms
        pointer.vx = pointer.vx * 0.5 + ((x - pointer.x) / dtp) * 0.5
        pointer.vy = pointer.vy * 0.5 + ((y - pointer.y) / dtp) * 0.5
      } else {
        pointer.vx = 0
        pointer.vy = 0
      }
      pointer.x = x
      pointer.y = y
      pointer.t = now
      pointer.moved = true
      pointer.inHero = x >= 0 && y >= 0 && x <= hr.width && y <= hr.height
      const wr = wrap.getBoundingClientRect()
      const margin = reach()
      pointer.inside =
        e.clientX > wr.left - margin && e.clientX < wr.right + margin &&
        e.clientY > wr.top - margin && e.clientY < wr.bottom + margin
      // Entrando nel titolo esplode; per la prossima volta bisogna uscirne
      const tr = title.getBoundingClientRect()
      const onText = e.clientX > tr.left && e.clientX < tr.right && e.clientY > tr.top && e.clientY < tr.bottom
      if (!onText) blocked = false
      else if (mode === 'idle' && !blocked && measured && now > readyAt) burst()
      if (pointer.inside || raf) wake()
    }

    // Il cursore fermo non mescola più il fumo
    const calm = setInterval(() => {
      if (performance.now() - pointer.t > 80) { pointer.vx *= 0.5; pointer.vy *= 0.5 }
    }, 50)

    const onLeave = () => {
      pointer.inside = false
      pointer.inHero = false
      pointer.vx = 0
      pointer.vy = 0
    }

    const onTap = (e) => {
      if (e.pointerType === 'mouse' || mode !== 'idle' || performance.now() <= readyAt) return
      // Dopo un resize a loop fermo la misura è da rifare: con il mouse la rifà
      // il movimento che sveglia il loop, al tocco va rifatta qui
      if (!measured) measure()
      burst()
      wake()
    }

    // Ascolta il cursore solo mentre il titolo è vicino allo schermo
    let listening = false
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !listening) {
        window.addEventListener('pointermove', onMove, { passive: true })
        document.addEventListener('pointerleave', onLeave)
        listening = true
      } else if (!entry.isIntersecting && listening) {
        window.removeEventListener('pointermove', onMove)
        document.removeEventListener('pointerleave', onLeave)
        listening = false
        onLeave()
      }
    }, { rootMargin: '200px' })
    io.observe(wrap)
    title.addEventListener('pointerdown', onTap)
    wake() // misura appena le parole sono entrate

    // Si rimisura quando cambia la dimensione (font caricati, resize)
    const remeasure = () => { measured = false }
    const ro = new ResizeObserver(remeasure)
    ro.observe(title)
    ro.observe(hero)
    document.fonts?.ready.then(remeasure)

    return () => {
      cancelAnimationFrame(raf)
      clearInterval(calm)
      io.disconnect()
      ro.disconnect()
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onLeave)
      title.removeEventListener('pointerdown', onTap)
      title.style.color = ''
      if (fluid) fluid.dispose()
    }
  }, [lines.join('\n')]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={wrapRef} className="relative">
      <h1 ref={titleRef} className={className} aria-label={lines.join(' ')}>
        {lines.map((line, li) => (
          <span key={line} className="block" aria-hidden="true">
            {/* Ogni parola entra con il suo ritardo; le lettere sono misurate una per una */}
            {line.split(' ').map((word, wi, words) => {
              const n = lines.slice(0, li).reduce((c, l) => c + l.split(' ').length, 0) + wi
              return (
                <React.Fragment key={wi}>
                  <span className="hero-reveal-word" style={{ animationDelay: `${n * 280}ms` }}>
                    {[...word].map((ch, ci) => (
                      <span key={ci} data-smoke className="smoke-letter">{ch}</span>
                    ))}
                  </span>
                  {wi < words.length - 1 && ' '}
                </React.Fragment>
              )
            })}
          </span>
        ))}
      </h1>
      <canvas ref={textRef} aria-hidden="true" className="pointer-events-none absolute" />
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute" />
    </div>
  )
}
