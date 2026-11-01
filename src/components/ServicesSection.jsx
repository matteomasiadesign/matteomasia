import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import SmartImage from './SmartImage.jsx'
import { setScrollLocked } from '../lib/smoothScroll.js'

// --- SERVIZI, STILE "DIGITAL PUNK" ---
// Fondo rosso come la hero, elenco a righe spesse; un clic su una riga apre
// un pannello laterale nero con l'approfondimento del servizio.

const pad = (n) => String(n).padStart(2, '0')

// Deliverables per ciascuna area di servizio
const getServiceDeliverables = (service, idx) => {
  if (Array.isArray(service?.deliverables) && service.deliverables.length > 0) {
    return service.deliverables
  }
  const title = (service?.title || '').toLowerCase()
  if (title.includes('brand') || title.includes('identity')) {
    return ['Brand System', 'Guidelines', 'Packaging', 'Typography']
  }
  if (title.includes('web') || title.includes('digital') || title.includes('product') || title.includes('engineering') || title.includes('code')) {
    return ['UI/UX Design', 'React & Tailwind', 'Design System', 'SEO']
  }
  if (title.includes('3d') || title.includes('motion')) {
    return ['Blender 3D', 'CGI Visuals', 'Product Mockup', 'Animation']
  }
  if (title.includes('art') || title.includes('production') || title.includes('video') || title.includes('foto')) {
    return ['Fotografia', 'Video Editing', 'Multi-Channel Adv', 'Color Grading']
  }
  const list = [
    ['Brand System', 'Guidelines', 'Packaging', 'Typography'],
    ['UI/UX Design', 'React & Tailwind', 'Design System', 'SEO'],
    ['Blender 3D', 'CGI Visuals', 'Product Mockup', 'Animation'],
    ['Fotografia', 'Video Editing', 'Multi-Channel Adv', 'Color Grading'],
  ]
  return list[idx % list.length]
}

export default function ServicesSection({ services, onCta, onContact }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
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

  const marqueeItems = Array.from({ length: 10 })

  return (
    <section id="services" className="relative z-10">
      {/* Fascia nera con la scritta che scorre: lo stacco netto dal nero dei progetti */}
      <div aria-hidden="true" className="bg-black text-[#ff2b1c] overflow-hidden py-3 md:py-4 select-none">
        <div className="punk-marquee flex w-max">
          {[0, 1].map((k) => (
            <div key={k} className="flex shrink-0">
              {marqueeItems.map((_, i) => (
                <span key={i} className="font-display text-2xl md:text-3xl px-5 md:px-7 whitespace-nowrap">Servizi ✶</span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div data-nav-surface="red" className="punk-red text-black section-y">
        <div className="wrap">
          {/* Testata */}
          <div className="flex items-end justify-between gap-6">
            <div>
              <span className="block text-xs font-semibold uppercase tracking-widest mb-4">// Skills</span>
              <h2 className="text-5xl md:text-8xl leading-[0.9]">What I do.</h2>
              <p className="mt-5 text-base md:text-lg font-medium max-w-md">
                {count} aree per una comunicazione visiva e digitale completa.
              </p>
            </div>
            <span className="hidden md:block shrink-0 text-xs font-semibold uppercase tracking-widest tabular-nums">
              {pad(count)} areas · {new Date().getFullYear()}<span className="punk-blink">_</span>
            </span>
          </div>

          {/* Elenco */}
          <ul className="mt-14 md:mt-20 border-t-[3px] border-black">
            {services.map((s, i) => {
              const tags = getServiceDeliverables(s, i)
              return (
                <li key={s.id} className="border-b-[3px] border-black">
                  <button
                    ref={(el) => { rowRefs.current[i] = el }}
                    onClick={() => open(i)}
                    aria-haspopup="dialog"
                    className="punk-row group w-full flex items-center gap-4 md:gap-8 px-2 md:px-4 py-6 md:py-8 text-left"
                  >
                    <span className="shrink-0 text-xs md:text-sm font-semibold tabular-nums">[{pad(i + 1)}]</span>
                    <span className="punk-row-title font-display flex-1 text-2xl md:text-5xl leading-[0.95] uppercase">{s.title}</span>
                    <span className="hidden lg:block shrink-0 max-w-[220px] text-right text-[11px] font-semibold uppercase tracking-widest opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-200">
                      {tags.slice(0, 3).join(' · ')}
                    </span>
                    <span className="shrink-0 text-sm md:text-base font-semibold" aria-hidden="true">
                      [<span className="group-hover:hidden group-focus-visible:hidden">+</span><span className="hidden group-hover:inline group-focus-visible:inline">→</span>]
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="flex justify-center mt-14 md:mt-20">
            <button
              onClick={onContact}
              className="rounded-full hero-btn punk-shadow group flex items-center gap-3 px-8 py-4 border-[3px] border-black bg-transparent text-black font-semibold text-base md:text-lg active:scale-95 transition-colors duration-200"
            >
              Start a project
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
                    className="rounded-full hero-btn-red w-11 h-11 border-[3px] border-[#ff2b1c] text-[#ff2b1c] flex items-center justify-center transition-colors duration-200"
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

                  <span className="block mt-10 mb-3 text-xs font-semibold uppercase tracking-widest text-[#ff2b1c]">// Deliverables</span>
                  <ul className="flex flex-wrap gap-2">
                    {deliverables.map((item) => (
                      <li key={item} className="px-3 py-1.5 border-2 border-[#ff2b1c] text-xs font-semibold uppercase tracking-wider">
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
                        className="rounded-full punk-btn-fill group flex items-center gap-2 px-6 py-3 border-[3px] border-[#ff2b1c] bg-[#ff2b1c] text-black font-semibold text-sm md:text-base active:scale-95 transition-colors duration-200"
                      >
                        {service.cta_label || 'Explore work'}
                        <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                      </button>
                    )}
                    <button
                      onClick={() => { close(); onContact() }}
                      className="rounded-full hero-btn-red px-6 py-3 border-[3px] border-[#ff2b1c] text-[#ff2b1c] font-semibold text-sm md:text-base active:scale-95 transition-colors duration-200"
                    >
                      Let's talk
                    </button>
                  </div>

                  {count > 1 && (
                    <div className="mt-12 pt-5 border-t border-[#ff2b1c]/40 flex justify-between text-xs font-semibold uppercase tracking-widest">
                      <button onClick={() => step(-1)} className="flex items-center gap-2 py-3 hover:text-[#ff2b1c] transition-colors">
                        <ArrowLeft size={14} /> Previous
                      </button>
                      <button onClick={() => step(1)} className="flex items-center gap-2 py-3 hover:text-[#ff2b1c] transition-colors">
                        Next <ArrowRight size={14} />
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
