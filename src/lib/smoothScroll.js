import Lenis from 'lenis'
import 'lenis/dist/lenis.css'

// Scorrimento morbido di tutto il sito (Lenis). Chi ha "Riduci movimento"
// attivo resta sullo scroll nativo del browser.
let lenis = null

// --- Scatti con la rotella ---
// Una sezione registra una funzione che, dato il gesto, dice dove portare la
// pagina (px) o null per lasciare lo scroll libero (es. Chi sono: un gesto apre
// il sipario). Durante lo scatto la rotella è ferma; dopo si scarta solo la coda
// d'inerzia del trackpad (in calo), mai le tacche nuove della rotella del mouse.
const SNAP_S = 0.8 // durata dello scatto, in secondi
const TAIL_MS = 400 // oltre questo tempo dalla fine dello scatto non si scarta più niente
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const snaps = new Set()
let snapping = false
let swallowing = false // la coda d'inerzia del gesto che ha fatto scattare
let snapEnd = 0
let lastWheel = 0
let lastAbs = 0

const interceptWheel = ({ deltaY, event }) => {
  if (!snaps.size || !event.type.includes('wheel') || event.ctrlKey || !deltaY) return false
  // Coda d'inerzia: arriva a raffica e cala (il mouse invece manda tacche uguali)
  const now = performance.now()
  const abs = Math.abs(deltaY)
  const tail = now - lastWheel <= 160 && (abs < lastAbs || abs <= 3) && now - snapEnd < TAIL_MS
  lastWheel = now
  lastAbs = abs
  if (snapping || (swallowing && tail)) { event.preventDefault(); return true }
  swallowing = false
  const pos = lenis.animatedScroll
  const next = lenis.targetScroll + deltaY
  for (const resolve of snaps) {
    const to = resolve(deltaY, pos, next)
    if (to === null) continue
    event.preventDefault()
    snapping = true
    swallowing = true
    lenis.scrollTo(to, {
      // Uno scatto corto (es. dai contatti alla stanza) dura poco: non tiene ferma la rotella
      duration: Math.min(SNAP_S, 0.25 + (Math.abs(to - pos) / window.innerHeight) * 0.6),
      easing: easeInOutCubic,
      lock: true,
      force: true,
      onComplete: () => { snapping = false; snapEnd = performance.now() },
    })
    return true
  }
  return false
}

export function startSmoothScroll() {
  if (lenis || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  lenis = new Lenis({
    lerp: 0.1,
    smoothWheel: true,
    virtualScroll: (data) => !interceptWheel(data),
  })
  const raf = (time) => {
    lenis.raf(time)
    requestAnimationFrame(raf)
  }
  requestAnimationFrame(raf)
}

// resolve(deltaY, pos, next) → px di arrivo o null. Restituisce la funzione per toglierlo
export function addWheelSnap(resolve) {
  snaps.add(resolve)
  return () => snaps.delete(resolve)
}

// null se lo scroll morbido è spento (Riduci movimento)
export function getLenis() {
  return lenis
}

// Blocca lo scroll della pagina (es. con un pannello aperto). Gli elementi con
// data-lenis-prevent continuano a scorrere per conto loro.
export function setScrollLocked(locked) {
  if (lenis) {
    if (locked) lenis.stop()
    else lenis.start()
  } else {
    document.documentElement.style.overflow = locked ? 'hidden' : ''
  }
}

// Scorre fino a un elemento o a una posizione in px, passando da Lenis se attivo.
// immediate: salto secco, senza animazione (es. cambio di pagina)
export function scrollToTarget(target, { immediate = false } = {}) {
  if (lenis) {
    lenis.scrollTo(target, immediate ? { immediate: true, force: true } : { duration: 1.4, force: true })
  } else if (typeof target === 'number') {
    window.scrollTo({ top: target, behavior: immediate ? 'auto' : 'smooth' })
  } else {
    target?.scrollIntoView({ behavior: immediate ? 'auto' : 'smooth' })
  }
}
