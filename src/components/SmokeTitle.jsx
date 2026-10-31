import React, { useEffect, useRef } from 'react'
import { createSmokeFluid, FLUID } from '../lib/smokeFluid.js'

// --- TITOLO CHE SI SBRICIOLA IN FUMO ---
// Le lettere non si muovono e non sbiadiscono: avvicinando il cursore si
// sbriciolano. Il font (Doto) è fatto di quadratini su una griglia: dai glifi
// se ne staccano alcuni, che volano verso il cursore e diventano fumo strada
// facendo; più ci si avvicina, più la lettera si consuma. Entrando nel titolo
// tutto esplode in una nube e poi le lettere si ricompongono un quadratino
// alla volta. Allontanando il cursore i quadratini tornano al loro posto.
// Su touch basta un tocco per l'esplosione.
//
// Come funziona: finché l'effetto è fermo si vede il testo vero. Appena serve,
// il titolo viene ridisegnato identico su una canvas (stessa font, stesse
// posizioni) e il testo vero diventa trasparente: sulla canvas si possono
// spegnere i singoli quadratini. Ogni quadratino staccato è una particella e
// disegna una maschera da cui la simulazione di fluido (src/lib/smokeFluid.js)
// fa uscire il fumo. Quando tutto è tornato a posto si torna al testo vero.

const HOLD_MS = 900 // quanto resta la nube prima che il titolo si ricomponga
const REFORM_MS = 1800
const LINGER_MS = 7000 // dopo l'ultimo quadratino, il tempo perché il fumo svanisca
const RATE = 11 // fumo rilasciato al secondo da un quadratino in volo
const MASK_SCALE = 0.5 // risoluzione della maschera rispetto al fumo
const MAX_ERODE = 0.6 // quanta parte di una lettera si sbriciola prima di entrarci
const CRUMBLE_PER_MS = 0.03 // quadratini al ms per lettera, al massimo
const MAX_PARTICLES = 900

const rand = (a, b) => a + Math.random() * (b - a)
const clamp01 = (v) => Math.min(Math.max(v, 0), 1)
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t) }

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
    const letterEls = [...title.querySelectorAll('[data-smoke]')]
    // Prima che le parole abbiano finito di entrare l'effetto resta spento
    const words = title.querySelectorAll('.hero-reveal-word').length
    const readyAt = performance.now() + words * 280 + 1500

    // Lettera: { text, x, y, w, h, base, dots, eroded }
    // Quadratino: { x, y, s, on, a, healAt, kind } (a = quanto è visibile, 0..1)
    let letters = []
    let particles = []
    let W = 1
    let H = 1
    let dpr = 1
    let pxPerCell = 8
    let fontSize = 100
    let font = ''
    let color = '#000'
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
    // Cursore in px CSS rispetto alla hero
    const pointer = { x: -1e4, y: -1e4, vx: 0, vy: 0, t: 0, inside: false, inHero: false, moved: false }

    // Dimensioni della hero, posizione delle lettere e quadratini di ogni glifo
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
      rects.forEach((r, i) => {
        g.fillText(letterEls[i].textContent, r.left - wr.left, r.top - wr.top + (r.height - (asc + desc)) / 2 + asc)
      })
      const data = g.getImageData(0, 0, gw, gh).data
      const alpha = (x, y) => {
        const xi = Math.round(x)
        const yi = Math.round(y)
        return xi >= 0 && yi >= 0 && xi < gw && yi < gh ? data[(yi * gw + xi) * 4 + 3] : 0
      }
      const ox = wr.left - hr.left
      const oy = wr.top - hr.top

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
        const dots = []
        if (Number.isFinite(left)) {
          for (let cy = top; cy < y1; cy += pitch) {
            for (let cx = left; cx < x1; cx += pitch) {
              if (alpha(cx + pitch / 2, cy + pitch / 2) > 120) {
                dots.push({ x: cx + ox, y: cy + oy, s: pitch, on: true, a: 1, healAt: Infinity, kind: '' })
              }
            }
          }
        }
        const x = r.left - hr.left
        const y = r.top - hr.top
        return {
          text: letterEls[i].textContent,
          x, y, w: r.width, h: r.height,
          base: y + (r.height - (asc + desc)) / 2 + asc,
          dots,
          eroded: [], // quadratini staccati dal cursore, dal più vecchio
        }
      })
      particles = []
      maskEmpty = false
      measured = true
    }

    const addParticle = (p) => { if (particles.length < MAX_PARTICLES) particles.push(p) }

    // Un quadratino si stacca e diventa particella; con toCursor vola verso
    // il cursore, altrimenti sale con l'aria calda
    const detach = (d, toCursor, burstFrom) => {
      d.on = false
      d.a = 0
      const x = d.x + d.s / 2
      const y = d.y + d.s / 2
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
        s: d.s, seed: Math.random() * 100,
        attract: !!toCursor,
      })
    }

    // Il quadratino acceso più vicino al cursore, con un po' di caso
    const pickDot = (L) => {
      let best = null
      let bestScore = Infinity
      for (let k = 0; k < 7; k++) {
        const d = L.dots[(Math.random() * L.dots.length) | 0]
        if (!d || !d.on || d.healAt !== Infinity) continue
        const score = Math.hypot(d.x - pointer.x, d.y - pointer.y) * rand(0.6, 1.4)
        if (score < bestScore) { bestScore = score; best = d }
      }
      return best
    }

    // Esplosione: tutti i quadratini volano via in una nube di fumo, spinti in
    // fuori dal centro del titolo
    const burst = () => {
      mode = 'burst'
      modeStart = performance.now()
      burstNow = true
      blocked = true
      const cx = letters.reduce((s, L) => s + L.x + L.w / 2, 0) / letters.length
      const cy = letters.reduce((s, L) => s + L.y + L.h / 2, 0) / letters.length
      for (const L of letters) {
        L.eroded = []
        for (const d of L.dots) {
          d.healAt = Infinity
          if (d.on || d.a > 0) detach(d, false, { x: cx, y: cy })
        }
        if (!fluid) continue
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

    // Ricomposizione: i quadratini riappaiono uno alla volta, in ordine sparso
    const reform = (now) => {
      mode = 'reform'
      modeStart = now
      letters.forEach((L, i) => {
        for (const d of L.dots) {
          d.kind = 'reform'
          d.healAt = now + i * 60 + rand(0, REFORM_MS * 0.75)
        }
      })
    }

    // Spinta nel fluido in px/ms del cursore, convertita in celle al secondo
    const push = (x, y, vx, vy, radiusPx) => {
      const k = 1000 / pxPerCell
      fluid.splat(x / W, 1 - y / H, vx * k, -vy * k, 0, (radiusPx / H) ** 2, false)
    }

    // Da quanto lontano il cursore comincia a sbriciolare le lettere
    const reach = () => Math.max(fontSize * 3.2, 200)

    // Distanza del cursore dal riquadro di una lettera
    const distTo = (L) => {
      const dx = Math.max(L.x - pointer.x, 0, pointer.x - (L.x + L.w))
      const dy = Math.max(L.y - pointer.y, 0, pointer.y - (L.y + L.h))
      return Math.hypot(dx, dy)
    }

    const updateLetters = (now, dt) => {
      const R = reach()
      for (const L of letters) {
        if (mode === 'idle' && L.dots.length) {
          // Quanto deve essere consumata la lettera: niente lontano, fino a
          // MAX_ERODE quando il cursore la sfiora
          const target = pointer.inside ? MAX_ERODE * Math.pow(1 - smooth(0, R, distTo(L)), 1.1) : 0
          const want = Math.round(target * L.dots.length)
          L.acc = Math.min((L.acc || 0) + dt * CRUMBLE_PER_MS, 4)
          while (L.acc >= 1 && L.eroded.length < want) {
            const d = pickDot(L)
            if (!d) break
            L.acc -= 1
            d.kind = 'erode'
            detach(d, pointer.inHero)
            L.eroded.push(d)
          }
          // Il cursore si allontana: i quadratini staccati per primi tornano
          while (L.acc >= 1 && L.eroded.length > want) {
            L.acc -= 1
            L.eroded.shift().healAt = now + rand(0, 250)
          }
        }
        // I quadratini che devono tornare riappaiono sfumando
        for (const d of L.dots) {
          if (!d.on && now > d.healAt) {
            d.a += dt / (d.kind === 'reform' ? 320 : 450)
            if (d.a >= 1) {
              d.a = 1
              d.on = true
              d.healAt = Infinity
              d.kind = ''
            }
          }
        }
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

    // Lettere (meno i quadratini spenti) e quadratini in volo
    const drawText = () => {
      tctx.setTransform(1, 0, 0, 1, 0, 0)
      tctx.clearRect(0, 0, textCanvas.width, textCanvas.height)
      tctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      tctx.font = font
      tctx.textBaseline = 'alphabetic'
      tctx.fillStyle = color
      tctx.globalAlpha = 1
      for (const L of letters) tctx.fillText(L.text, L.x, L.base)
      tctx.globalCompositeOperation = 'destination-out'
      for (const L of letters) {
        for (const d of L.dots) {
          if (d.a >= 1) continue
          tctx.globalAlpha = 1 - d.a
          tctx.fillRect(d.x - 0.3, d.y - 0.3, d.s + 0.6, d.s + 0.6)
        }
      }
      tctx.globalCompositeOperation = 'source-over'
      // Il quadratino si consuma diventando fumo: rimpicciolisce e svanisce
      for (const p of particles) {
        const t = p.age / p.life
        const s = p.s * (1 - 0.65 * t)
        tctx.globalAlpha = 1 - smooth(0.25, 1, t)
        tctx.fillRect(p.x - s / 2, p.y - s / 2, s, s)
      }
      tctx.globalAlpha = 1
    }

    // Maschera del fumo: i quadratini in volo (più fumo man mano che si
    // consumano) e, nel frame dell'esplosione, tutte le lettere piene
    const drawMask = () => {
      if (!particles.length && !burstNow && maskEmpty) return
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
        const r = p.s * (0.6 + t)
        mctx.fillRect(p.x - r, p.y - r, r * 2, r * 2)
      }
      mctx.globalAlpha = 1
      maskEmpty = !particles.length && !burstNow
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
        else if (mode === 'reform' && letters.every((L) => L.dots.every((d) => d.on))) mode = 'idle'
        updateLetters(now, dt)
        updateParticles(dt)
      }

      // Si passa alla canvas solo mentre qualcosa è staccato o in volo
      const busy = particles.length > 0 || mode !== 'idle' || letters.some((L) => L.dots.some((d) => !d.on))
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
      if (e.pointerType === 'mouse' || mode !== 'idle' || !measured) return
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
