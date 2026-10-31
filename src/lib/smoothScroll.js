import Lenis from 'lenis'
import 'lenis/dist/lenis.css'

// Scorrimento morbido di tutto il sito (Lenis). Chi ha "Riduci movimento"
// attivo resta sullo scroll nativo del browser.
let lenis = null

// Una sezione può prendersi la rotella (es. Chi sono, che scatta da una scena
// all'altra): se la funzione restituisce true l'evento è suo e Lenis lo ignora
let wheelInterceptor = null

export function startSmoothScroll() {
  if (lenis || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  lenis = new Lenis({
    lerp: 0.1,
    smoothWheel: true,
    virtualScroll: (data) => !(wheelInterceptor && wheelInterceptor(data)),
  })
  const raf = (time) => {
    lenis.raf(time)
    requestAnimationFrame(raf)
  }
  requestAnimationFrame(raf)
}

export function setWheelInterceptor(fn) {
  wheelInterceptor = fn
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
