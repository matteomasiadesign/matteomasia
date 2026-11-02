import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import SmartImage from './SmartImage.jsx'
import SmokeVideo from './SmokeVideo.jsx'
import { addWheelSnap, setScrollLocked } from '../lib/smoothScroll.js'

// --- SERVIZI, STILE "DIGITAL PUNK" ---
// Fondo rosso come la hero, attraversato da uccelli di fumo (tools/birds/) come
// la hero dagli elefanti; elenco a righe spesse; un clic su una riga apre
// un pannello laterale nero con l'approfondimento del servizio.
// Dai progetti si arriva con un solo gesto della rotella, come il sipario di Chi sono.

const pad = (n) => String(n).padStart(2, '0')

// Deliverables per ciascuna area: solo cose che il cliente riceve (non
// strumenti né discipline), in inglese come le altre etichette, quattro per area.
// Il 3D e il motion stanno in fondo alla produzione: ci sono, ma non sono il centro.
const DELIVERABLES = [
  { keys: ['brand', 'identity', 'identità'], items: ['Logo & Visual Identity', 'Brand Guidelines', 'Brand Positioning', 'Print & Packaging'] },
  { keys: ['web', 'digital', 'engineering', 'code', 'sito'], items: ['Websites & Landing Pages', 'UI/UX Design', 'React Front-End', 'SEO & Performance'] },
  { keys: ['content', 'communication', 'comunicazione', 'social', 'campaign'], items: ['Social Media Content', 'Ad Campaigns', 'Editorial Plans', 'Event Communication'] },
  { keys: ['photo', 'foto', 'video', 'production', 'art direction', '3d', 'motion'], items: ['Photography', 'Video & Reels', 'Post-Production & Color', '3D & Motion'] },
]

const getServiceDeliverables = (service, idx) => {
  if (Array.isArray(service?.deliverables) && service.deliverables.length > 0) {
    return service.deliverables
  }
  const title = (service?.title || '').toLowerCase()
  const match = DELIVERABLES.find(({ keys }) => keys.some((k) => title.includes(k)))
  return (match || DELIVERABLES[idx % DELIVERABLES.length]).items
}

export default function ServicesSection({ services, onCta, onContact }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const sectionRef = useRef(null)
  const rowRefs = useRef([])
  const closeRef = useRef(null)

  const count = services.length
  const service = services[activeIndex]
  const deliverables = service ? getServiceDeliverables(service, activeIndex) : []

  const open = (i) => {
    setActiveIndex(i)
    setIsOpen(true)
  }
  const close = () => setIsOpen(false)
  const step = (dir) => setActiveIndex((i) => (i + dir + count) % count)

  // Pagina ferma sotto il pannello, tastiera (Esc, frecce) e focus
  useEffect(() => {
    if (!isOpen) return
    setScrollLocked(true)
    closeRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight') step(1)
      else if (e.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      setScrollLocked(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Alla chiusura il focus torna sulla riga del servizio che si stava leggendo
  const wasOpen = useRef(false)
  useEffect(() => {
    if (wasOpen.current && !isOpen) rowRefs.current[activeIndex]?.focus({ preventScroll: true })
    wasOpen.current = isOpen
  }, [isOpen, activeIndex])

  // Dall'ultima card dei progetti un gesto porta i servizi in cima allo schermo;
  // risalendo dalla cima dei servizi si torna all'ultima card
  useEffect(() => {
    const section = sectionRef.current
    return addWheelSnap((deltaY, pos, next) => {
      const top = section.getBoundingClientRect().top + window.scrollY
      const from = top - window.innerHeight // progetti finiti, servizi appena sotto lo schermo
      if (deltaY > 0 && pos < top - 2 && next > from) return top
      if (deltaY < 0 && pos > from + 2 && next < top) return from
      return null
    })
  }, [])

  const marqueeItems = Array.from({ length: 10 })

  return (
    // Alta almeno uno schermo: dopo lo scatto si vede la sezione intera, non tagliata
    <section ref={sectionRef} id="services" className="relative z-10 min-h-[100svh] flex flex-col">
      {/* Fascia nera con la scritta che scorre: lo stacco netto dal nero dei progetti */}
      <div aria-hidden="true" className="bg-black text-[#ff2b1c] overflow-hidden py-3 md:py-4 select-none">
        <div className="punk-marquee flex w-max">
          {[0, 1].map((k) => (
            <div key={k} className="flex shrink-0">
              {marqueeItems.map((_, i) => (
                <span key={i} className="font-display text-2xl md:text-3xl px-5 md:px-7 whitespace-nowrap">What I do ✶</span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div data-nav-surface="red" className="punk-red text-black section-y flex-1 flex flex-col justify-center relative overflow-hidden">
        {/* Uccelli di fumo che passano dietro, come gli elefanti nella hero */}
        <SmokeVideo name="birds" />
        {/* Da desktop due colonne: testata e invito a sinistra, con il vuoto in mezzo
            che fa respirare la sezione; l'elenco a destra. Su mobile una sotto l'altra */}
        <div className="wrap grid-12 lg:grid-rows-[auto_1fr] relative">
          {/* Testata */}
          <div className="col-span-12 lg:col-span-4">
            <span className="block text-xs font-semibold uppercase tracking-widest mb-4">// Competenze</span>
            <h2 className="text-5xl md:text-7xl xl:text-8xl leading-[0.9]">
              What <span className="lg:block">I do.</span>
            </h2>
            <p className="mt-5 lg:mt-7 text-base md:text-lg font-medium max-w-[19rem] text-balance">
              {count} aree per una comunicazione visiva e digitale completa.
            </p>
          </div>

          {/* Elenco */}
          <ul className="col-span-12 lg:col-span-8 lg:col-start-5 lg:row-span-2 lg:self-center mt-12 lg:mt-0 border-t-[3px] border-black">
            {services.map((s, i) => {
              return (
                <li key={s.id} className="border-b-[3px] border-black">
                  <button
                    ref={(el) => { rowRefs.current[i] = el }}
                    onClick={() => open(i)}
                    aria-haspopup="dialog"
                    className="punk-row group w-full flex items-center gap-4 md:gap-6 px-2 md:px-4 py-5 md:py-6 text-left"
                  >
                    <span className="shrink-0 text-xs md:text-sm font-semibold tabular-nums">[{pad(i + 1)}]</span>
                    <span className="punk-row-title font-display flex-1 text-2xl md:text-3xl xl:text-4xl leading-[0.95] uppercase">{s.title}</span>
                    <span className="shrink-0 text-sm md:text-base font-semibold" aria-hidden="true">
                      [<span className="group-hover:hidden group-focus-visible:hidden">+</span><span className="hidden group-hover:inline group-focus-visible:inline">→</span>]
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          {/* Invito: a sinistra, lontano dal "+" in basso a destra; da desktop in fondo alla colonna */}
          <div className="col-span-12 lg:col-span-4 lg:row-start-2 lg:self-end flex mt-12 lg:mt-10">
            <button
              onClick={onContact}
              className="rounded-full hero-btn punk-shadow group flex items-center gap-3 whitespace-nowrap px-7 py-3.5 md:px-8 md:py-4 border-2 border-black bg-transparent text-black font-semibold text-base md:text-lg active:scale-95 transition-colors duration-200"
            >
              Inizia un progetto
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      {/* Pannello laterale: nel body, così nessun contenitore trasformato lo sposta */}
      {createPortal(
        <div
          className={`fixed inset-0 z-[80] ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
          aria-hidden={!isOpen}
          {...(!isOpen && { inert: '' })}
        >
          <div
            onClick={close}
            className={`absolute inset-0 bg-black/60 transition-opacity duration-500 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="service-panel-title"
            data-lenis-prevent
            className={`punk-panel absolute right-0 top-0 h-full w-full md:w-[560px] bg-black text-white border-t-[3px] md:border-t-0 md:border-l-[3px] border-[#ff2b1c] overflow-y-auto overscroll-contain ${isOpen ? 'translate-x-0 translate-y-0' : 'translate-y-full md:translate-y-0 md:translate-x-full'}`}
          >
            {service && (
              <>
                <div className="sticky top-0 z-10 bg-black flex items-center justify-between px-6 md:px-10 py-5 border-b border-[#ff2b1c]/40">
                  <span className="text-xs font-semibold uppercase tracking-widest text-[#ff2b1c] tabular-nums">
                    [{pad(activeIndex + 1)}/{pad(count)}]
                  </span>
                  <button
                    ref={closeRef}
                    onClick={close}
                    aria-label="Chiudi"
                    className="rounded-full hero-btn-red w-11 h-11 border-2 border-[#ff2b1c] text-[#ff2b1c] flex items-center justify-center transition-colors duration-200"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div key={service.id} className="slides-swap px-6 md:px-10 py-8 md:py-10">
                  <h3 id="service-panel-title" className="text-4xl md:text-5xl leading-[0.95] uppercase text-[#ff2b1c]">
                    {service.title}
                  </h3>

                  {service.description && (
                    <p className="mt-6 pt-6 border-t border-[#ff2b1c]/40 text-base md:text-lg leading-relaxed text-white/85">
                      {service.description}
                    </p>
                  )}

                  <span className="block mt-10 mb-3 text-xs font-semibold uppercase tracking-widest text-[#ff2b1c]">// Cosa include</span>
                  <ul className="flex flex-wrap gap-2">
                    {deliverables.map((item) => (
                      <li key={item} className="rounded-full px-3.5 py-1.5 border-2 border-[#ff2b1c] text-xs font-semibold uppercase tracking-wider">
                        {item}
                      </li>
                    ))}
                  </ul>

                  {service.img && (
                    <div className="mt-10 aspect-[16/10] border-[3px] border-[#ff2b1c] overflow-hidden">
                      <SmartImage src={service.img} alt={service.title} loading="lazy" isDark className="w-full h-full" />
                    </div>
                  )}

                  <div className="mt-10 flex flex-wrap gap-3">
                    {service.cta_link && (
                      <button
                        onClick={() => { close(); onCta(service.cta_link) }}
                        className="rounded-full punk-btn-fill group flex items-center gap-2 px-6 py-3 border-2 border-[#ff2b1c] bg-[#ff2b1c] text-black font-semibold text-sm md:text-base active:scale-95 transition-colors duration-200"
                      >
                        {service.cta_label || 'Vedi i lavori'}
                        <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                      </button>
                    )}
                    <button
                      onClick={() => { close(); onContact() }}
                      className="rounded-full hero-btn-red px-6 py-3 border-2 border-[#ff2b1c] text-[#ff2b1c] font-semibold text-sm md:text-base active:scale-95 transition-colors duration-200"
                    >
                      Parliamone
                    </button>
                  </div>

                  {count > 1 && (
                    <div className="mt-12 pt-5 border-t border-[#ff2b1c]/40 flex justify-between text-xs font-semibold uppercase tracking-widest">
                      <button onClick={() => step(-1)} className="flex items-center gap-2 py-3 hover:text-[#ff2b1c] transition-colors">
                        <ArrowLeft size={14} /> Precedente
                      </button>
                      <button onClick={() => step(1)} className="flex items-center gap-2 py-3 hover:text-[#ff2b1c] transition-colors">
                        Successivo <ArrowRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </aside>
        </div>,
        document.body
      )}
    </section>
  )
}
