import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowUpRight, Copy, Check, MessageCircle, Clapperboard } from 'lucide-react'
import {
  TbBrandAdobePhotoshop,
  TbBrandAdobeIllustrator,
  TbBrandAdobeIndesign,
  TbBrandAdobePremiere,
  TbBrandFigma,
  TbBrandFramer,
  TbBrandBlender,
  TbBrandVscode,
} from 'react-icons/tb'
import { useTheme } from '../lib/ThemeContext.jsx'
import { getTokens } from '../lib/tokens.js'
import { useProjects } from '../lib/useProjects.js'
import { useServices } from '../lib/useServices.js'
import { useLocalTime } from '../lib/useLocalTime.js'
import { supabase, isSupabaseReady } from '../lib/supabase.js'
import ClothCarousel from '../components/ClothCarousel.jsx'
import SmokeTitle from '../components/SmokeTitle.jsx'
import HeroFluid from '../components/HeroFluid.jsx'
import ServicesSection from '../components/ServicesSection.jsx'
import AboutSection from '../components/AboutSection.jsx'
import Navbar from '../components/Navbar.jsx'
import { scrollToTarget } from '../lib/smoothScroll.js'

// --- COMPONENTE ANIMAZIONE REVEAL ---
const FadeIn = ({ children, delay = 0, direction = 'up', className = '' }) => {
  const [isVisible, setIsVisible] = useState(false)
  const domRef = useRef()

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true)
            observer.unobserve(entry.target)
          }
        })
      },
      { rootMargin: '0px 0px -30px 0px' }
    )

    if (domRef.current) observer.observe(domRef.current)
    return () => {
      if (domRef.current) observer.unobserve(domRef.current)
    }
  }, [])

  const getTransform = () => {
    if (isVisible) return 'translateY(0)'
    if (direction === 'up') return 'translateY(18px)'
    if (direction === 'scale') return 'scale(0.99)'
    return 'translateY(0)'
  }

  // Si animano solo opacity e transform. will-change serve finché l'elemento
  // aspetta di comparire: dopo resterebbe un livello GPU fisso per ogni blocco
  return (
    <div
      ref={domRef}
      className={`transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${className}`}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: getTransform(),
        transitionDelay: `${delay}ms`,
        willChange: isVisible ? 'auto' : 'opacity, transform',
      }}
    >
      {children}
    </div>
  )
}

// Icona "Lr" per Lightroom, disegnata nello stesso stile badge delle icone
// Adobe di Tabler (non esiste nel set ufficiale della libreria).
const TbBrandAdobeLightroom = ({ size = 24, className = '', ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M3 12c0 -4.243 0 -6.364 1.318 -7.682s3.44 -1.318 7.682 -1.318s6.364 0 7.682 1.318s1.318 3.44 1.318 7.682s0 6.364 -1.318 7.682s-3.44 1.318 -7.682 1.318s-6.364 0 -7.682 -1.318s-1.318 -3.44 -1.318 -7.682" />
    <path d="M7.263 8.684v7.106h3.5" />
    <path d="M13.895 10.579v1.895m0 0v3.315m0 -3.315c.531 -.709 1.026 -1.592 1.894 -1.832q .22 -.062 .474 -.063" />
  </svg>
)

// --- SOFTWARE UTILIZZATI (per il ticker) ---
const TOOLS = [
  { name: 'Photoshop', Icon: TbBrandAdobePhotoshop },
  { name: 'Illustrator', Icon: TbBrandAdobeIllustrator },
  { name: 'InDesign', Icon: TbBrandAdobeIndesign },
  { name: 'Premiere', Icon: TbBrandAdobePremiere },
  { name: 'Lightroom', Icon: TbBrandAdobeLightroom },
  { name: 'CapCut', Icon: Clapperboard },
  { name: 'Figma', Icon: TbBrandFigma },
  { name: 'Framer', Icon: TbBrandFramer },
  { name: 'Blender 3D', Icon: TbBrandBlender },
  { name: 'VS Code', Icon: TbBrandVscode },
]

// --- COMPONENTE TICKER SOFTWARE (scorrimento infinito, sfondo trasparente) ---
const ToolsTicker = ({ cTextMuted }) => {
  // Duplichiamo la lista per ottenere un loop visivo continuo
  const items = [...TOOLS, ...TOOLS]

  return (
    <div className="relative w-full overflow-hidden py-10 md:py-14 select-none">
      {/* Sfumature ai bordi per un ingresso/uscita morbida delle icone */}
      <div className={`pointer-events-none absolute inset-y-0 left-0 w-16 md:w-40 z-10 bg-gradient-to-r from-black to-transparent`} />
      <div className={`pointer-events-none absolute inset-y-0 right-0 w-16 md:w-40 z-10 bg-gradient-to-l from-black to-transparent`} />

      <div className="ticker-scroll-track flex w-max animate-[ticker-scroll_32s_linear_infinite] hover:[animation-play-state:paused]">
        {items.map(({ name, Icon }, i) => (
          <div key={`${name}-${i}`} className="flex items-center gap-3 shrink-0 px-8 md:px-12">
            <Icon size={30} className={`${cTextMuted} opacity-70 shrink-0`} />
            <span className={`text-sm md:text-base font-medium tracking-tight whitespace-nowrap ${cTextMuted} opacity-70`}>{name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Ora locale in un componente a sé: l'aggiornamento di ogni minuto ridisegna
// solo questo testo, non tutta la home
const LocalTime = () => <time className="tabular-nums">{useLocalTime()}</time>

const HERO_LINES = ['Matteo Masia.']
const EMAIL = 'matteomasiadesign@gmail.com'
const PHONE = '+393495862375'

// Copia negli appunti, con il vecchio metodo come riserva (http, browser datati)
const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const el = document.createElement('textarea')
    el.value = text
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
  }
}

const label = 'block text-xs font-semibold uppercase tracking-widest'
const field = 'field w-full bg-transparent rounded-none border-0 border-b-[3px] border-black/25 px-0 py-3 text-lg text-black placeholder:text-black/40 focus:border-black transition-colors disabled:opacity-50'

export default function Home() {
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const { projects } = useProjects()
  const { services } = useServices()

  const [formStatus, setFormStatus] = useState('idle')
  const [formData, setFormData] = useState({ nome: '', email: '', oggetto: '', messaggio: '' })
  const [formError, setFormError] = useState(null)
  const [copiedData, setCopiedData] = useState(null)

  // Se si arriva con un hash (es. /#contact dalla pagina dettaglio), scrolla lì
  useEffect(() => {
    if (window.location.hash) {
      const id = window.location.hash.slice(1)
      setTimeout(() => scrollToTarget(document.getElementById(id)), 300)
    }
  }, [])

  // Le card della home: al massimo 8 progetti. useMemo: un array nuovo a ogni
  // render farebbe ricostruire da zero la scena WebGL del carosello (contesto,
  // foto, shader) a ogni tasto premuto nel form
  const featured = useMemo(() => projects.slice(0, 8), [projects])

  const scrollToSection = (id) => {
    if (id === 'home') return scrollToTarget(0)
    const element = document.getElementById(id)
    if (element) scrollToTarget(element)
  }

  // Link a un'ancora: resta un vero link (tastiera, "apri in nuova scheda"),
  // ma lo scorrimento lo fa Lenis
  const anchor = (id) => ({
    href: `#${id}`,
    onClick: (e) => {
      e.preventDefault()
      scrollToSection(id)
    },
  })

  const handleFormSubmit = async (e) => {
    e.preventDefault()
    setFormError(null)

    // Controllo formato email: blocca "asd", "test@test", spazi, ecc.
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(formData.email.trim())
    if (!emailOk) {
      setFormError('Inserisci un indirizzo email valido (es. nome@dominio.it).')
      return
    }

    // Modalità demo se Supabase non è configurato
    if (!isSupabaseReady) {
      setFormStatus('submitting')
      setTimeout(() => {
        setFormStatus('success')
        setTimeout(() => setFormStatus('idle'), 3000)
      }, 1000)
      return
    }

    setFormStatus('submitting')
    const { error } = await supabase.from('messaggi').insert({
      nome: formData.nome.trim(),
      email: formData.email.trim(),
      oggetto: formData.oggetto.trim() || null,
      messaggio: formData.messaggio.trim(),
    })
    if (error) {
      setFormError('Invio non riuscito. Riprova, o scrivimi direttamente via email.')
      setFormStatus('idle')
      return
    }
    setFormData({ nome: '', email: '', oggetto: '', messaggio: '' })
    setFormStatus('success')
    setTimeout(() => setFormStatus('idle'), 4000)
  }

  const handleCopy = async (text, type) => {
    await copyText(text)
    setCopiedData(type)
    setTimeout(() => setCopiedData(null), 2500)
  }

  // CTA delle card servizi: link interno (/...), ancora (#...) o URL esterno.
  const handleServiceCta = (link) => {
    if (!link) return
    if (link.startsWith('#')) scrollToSection(link.slice(1))
    else if (link.startsWith('/')) navigate(link)
    else window.open(link, '_blank', 'noopener,noreferrer')
  }

  const menuItems = [
    { name: 'Work', id: 'projects' },
    { name: 'Services', id: 'services' },
    { name: 'About', id: 'bio' },
    { name: 'Contact', id: 'contact' },
  ]

  const t = getTokens(isDark)
  const { cBgMain, cTextMain, cTextMuted } = t
  const submitting = formStatus === 'submitting'

  const CopiedBadge = () => (
    <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-widest bg-black text-[#ff2b1c] px-2 py-1 shrink-0">
      <Check size={12} /> Copied
    </span>
  )

  return (
    <div className="min-h-screen w-full bg-black font-sans selection:bg-[#ff2b1c] selection:text-black relative overflow-x-clip">
      {/* --- NAVIGAZIONE: riga in alto nella hero, poi il "+" in basso a destra --- */}
      <Navbar menuItems={menuItems} onSection={scrollToSection} />

      <main id="home" className={`w-full min-h-screen ${cBgMain} ${cTextMain}`}>
        {/* --- HERO SECTION --- */}
        <section aria-label="Intro" className="hero-red min-h-screen flex flex-col justify-center items-center px-4 md:px-10 relative overflow-hidden text-black">
          {/* Rosso e nero che si muovono lenti come un fluido */}
          <HeroFluid />
          {/* Sfumatura dal rosso allo sfondo della pagina, verso i progetti */}
          <div aria-hidden="true" className="hero-fade pointer-events-none absolute inset-x-0 bottom-0 h-[55vh]" />
          {/* Grana di pellicola, la stessa della stanza rossa */}
          <div aria-hidden="true" className="lynch-grain hero-grain absolute pointer-events-none" />
          {/* Parte ancora rossa della hero (il fondo sfumato conta già come scuro per la navigazione) */}
          <div aria-hidden="true" data-nav-surface="red" className="pointer-events-none absolute inset-x-0 top-0 bottom-[25vh]" />
          <div className="max-w-[980px] mx-auto w-full flex flex-col items-center text-center z-10 relative mt-10 md:mt-0">
            <SmokeTitle lines={HERO_LINES} className="text-[7.5vw] md:text-[3.5rem] lg:text-[4.5rem] font-bold leading-none whitespace-nowrap mb-3" />

            <FadeIn delay={750}>
              <div className="max-w-2xl mx-auto mb-8 md:mb-9 flex flex-col items-center">
                <p className="text-lg md:text-2xl font-bold leading-tight mb-1">
                  Digital Designer
                </p>
                <p className="text-sm md:text-lg max-w-lg mx-auto leading-snug [text-wrap:balance]">
                  Esperienze digitali e Comunicazione
                </p>
              </div>
            </FadeIn>

            <FadeIn delay={1050}>
              <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto px-4 md:px-0">
                <a {...anchor('contact')} className="hero-btn w-full md:w-auto px-8 py-4 border-[3px] border-black bg-transparent text-black font-semibold text-base md:text-lg active:scale-95 transition-all duration-200">
                  Lavora con me
                </a>
                <a {...anchor('projects')} className="hero-btn w-full md:w-auto px-8 py-4 border-[3px] border-black bg-transparent text-black font-semibold text-base md:text-lg active:scale-95 transition-all duration-200">
                  Archivio
                </a>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* --- TICKER SOFTWARE (scorrimento infinito) --- */}
        <ToolsTicker cTextMuted={cTextMuted} />

        {/* --- PROGETTI: CARD IN TESSUTO (WEBGL) --- */}
        <ClothCarousel projects={featured} isDark={isDark} cTextMain={cTextMain} cTextMuted={cTextMuted} />

        {/* --- SERVIZI (ELENCO "DIGITAL PUNK" + PANNELLO LATERALE) --- */}
        <ServicesSection services={services} onCta={handleServiceCta} onContact={() => scrollToSection('contact')} />

        {/* --- CHI SONO (LA STANZA ROSSA) --- */}
        <AboutSection onContact={() => scrollToSection('contact')} />

        {/* --- CONTATTI --- */}
        <section id="contact" data-nav-surface="red" className="punk-red text-black relative z-10 section-y">
          <div className="wrap">
            <FadeIn>
              <p className={`${label} flex items-center gap-2`}>
                Local time · Porto Torres <LocalTime />
              </p>
              <h2 className="mt-4 text-[clamp(3.5rem,12vw,11rem)] leading-[0.85] uppercase">Let's talk.</h2>
            </FadeIn>

            <div className="grid-12 gap-y-14 mt-14 md:mt-20">
              <div className="col-span-12 md:col-span-5 flex flex-col gap-10">
                <FadeIn delay={100}>
                  <p className="text-xl md:text-2xl font-medium leading-snug [text-wrap:pretty]">
                    Vuoi propormi una collaborazione, richiedere un preventivo o scambiare due chiacchiere?
                  </p>
                  <p className="mt-3 text-sm font-semibold">Rispondo di solito entro 24 ore.</p>
                </FadeIn>

                <FadeIn delay={200}>
                  <dl className="border-t-[3px] border-black">
                    <div className="py-5 border-b-[3px] border-black">
                      <dt className={`${label} mb-2`}>Email</dt>
                      <dd className="flex flex-wrap items-center gap-3">
                        <a href={`mailto:${EMAIL}`} className="text-lg md:text-xl font-semibold break-all hover:underline underline-offset-4 decoration-2">{EMAIL}</a>
                        <button onClick={() => handleCopy(EMAIL, 'email')} aria-label="Copia l'indirizzo email" className="w-11 h-11 flex items-center justify-center hover:bg-black hover:text-[#ff2b1c] transition-colors">
                          {copiedData === 'email' ? <CopiedBadge /> : <Copy size={18} />}
                        </button>
                      </dd>
                    </div>
                    <div className="py-5 border-b-[3px] border-black">
                      <dt className={`${label} mb-2`}>Phone</dt>
                      <dd className="flex flex-wrap items-center gap-3">
                        <a href={`tel:${PHONE}`} className="text-lg md:text-xl font-semibold hover:underline underline-offset-4 decoration-2">+39 349 586 2375</a>
                        <button onClick={() => handleCopy(PHONE, 'phone')} aria-label="Copia il numero di telefono" className="w-11 h-11 flex items-center justify-center hover:bg-black hover:text-[#ff2b1c] transition-colors">
                          {copiedData === 'phone' ? <CopiedBadge /> : <Copy size={18} />}
                        </button>
                        <a href="https://wa.me/393495862375" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-3 bg-black text-[#ff2b1c] text-sm font-semibold uppercase tracking-widest border-[3px] border-black hover:bg-transparent hover:text-black transition-colors">
                          <MessageCircle size={16} /> WhatsApp
                        </a>
                      </dd>
                    </div>
                    <div className="py-5 border-b-[3px] border-black">
                      <dt className={`${label} mb-2`}>Social</dt>
                      <dd className="flex flex-col gap-2">
                        <a href="https://instagram.com/matteomasiadesign" target="_blank" rel="noopener noreferrer" className="group inline-flex items-center gap-2 w-fit text-lg md:text-xl font-semibold hover:underline underline-offset-4 decoration-2">
                          Instagram <ArrowUpRight size={18} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </a>
                        <a href="https://flickr.com/matteomasiaphotography" target="_blank" rel="noopener noreferrer" className="group inline-flex items-center gap-2 w-fit text-lg md:text-xl font-semibold hover:underline underline-offset-4 decoration-2">
                          Flickr (fotografia) <ArrowUpRight size={18} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </a>
                      </dd>
                    </div>
                  </dl>
                </FadeIn>
              </div>

              <FadeIn delay={300} className="col-span-12 md:col-span-6 md:col-start-7">
                <form onSubmit={handleFormSubmit} noValidate className="flex flex-col gap-8">
                  <h3 className="text-3xl md:text-4xl uppercase">Send a message</h3>

                  <div aria-live="polite">
                    {formStatus === 'success' && (
                      <div className="border-[3px] border-black p-6 flex items-start gap-4">
                        <Check size={28} className="shrink-0" />
                        <div>
                          <p className="text-xl font-semibold">Message sent.</p>
                          <p className="text-sm font-medium">Ti risponderò a breve.</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {formStatus !== 'success' && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                          <label htmlFor="f-nome" className={label}>Name</label>
                          <input id="f-nome" name="nome" type="text" autoComplete="name" required disabled={submitting} className={field}
                            value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} />
                        </div>
                        <div>
                          <label htmlFor="f-email" className={label}>Email</label>
                          <input id="f-email" name="email" type="email" inputMode="email" autoComplete="email" required disabled={submitting} className={field}
                            aria-invalid={!!formError} aria-describedby={formError ? 'form-error' : undefined}
                            value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="f-oggetto" className={label}>Subject <span className="normal-case tracking-normal font-medium">(facoltativo)</span></label>
                        <input id="f-oggetto" name="oggetto" type="text" disabled={submitting} className={field}
                          value={formData.oggetto} onChange={(e) => setFormData({ ...formData, oggetto: e.target.value })} />
                      </div>
                      <div>
                        <label htmlFor="f-messaggio" className={label}>Message</label>
                        <textarea id="f-messaggio" name="messaggio" required disabled={submitting} rows={4} className={`${field} resize-none`}
                          value={formData.messaggio} onChange={(e) => setFormData({ ...formData, messaggio: e.target.value })} />
                      </div>

                      {formError && <p id="form-error" role="alert" className="text-sm font-semibold bg-black text-[#ff2b1c] px-3 py-2 w-fit">{formError}</p>}

                      <button
                        type="submit"
                        disabled={submitting}
                        className="self-start inline-flex items-center gap-3 px-10 py-4 bg-black text-[#ff2b1c] border-[3px] border-black font-semibold uppercase tracking-widest hover:bg-transparent hover:text-black active:scale-95 transition-colors duration-200 disabled:opacity-60"
                      >
                        {submitting ? (
                          <><span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" /> Sending…</>
                        ) : (
                          <>Send request <ArrowUpRight size={18} /></>
                        )}
                      </button>
                    </>
                  )}
                </form>
              </FadeIn>
            </div>
          </div>
        </section>
      </main>

      {/* --- FOOTER --- */}
      <footer data-nav-surface="red" className="punk-red text-black border-t-[3px] border-black relative z-10">
        {/* Margine sotto: la riga finale resta sopra il "+" */}
        <div className="wrap pt-16 md:pt-24 pb-[calc(7rem+env(safe-area-inset-bottom,0px))]">
          <a href={`mailto:${EMAIL}`} className="block w-fit font-display text-[clamp(1.1rem,5.1vw,5.25rem)] leading-none whitespace-nowrap hover:text-white transition-colors">
            {EMAIL}
          </a>
          <div className="mt-14 md:mt-20 pt-5 border-t-[3px] border-black grid-12 gap-y-4 text-xs font-semibold uppercase tracking-widest">
            <p className="col-span-12 md:col-span-4">© {new Date().getFullYear()} Matteo Masia · P.IVA 03062630904</p>
            <nav aria-label="Footer" className="col-span-12 md:col-span-5 flex flex-wrap gap-x-6 gap-y-2">
              <Link to="/progetti" className="hover:underline underline-offset-4 decoration-2">Archive</Link>
              <a href="https://instagram.com/matteomasiadesign" target="_blank" rel="noopener noreferrer" className="hover:underline underline-offset-4 decoration-2">Instagram</a>
              <a href="https://flickr.com/matteomasiaphotography" target="_blank" rel="noopener noreferrer" className="hover:underline underline-offset-4 decoration-2">Flickr</a>
            </nav>
            <a {...anchor('home')} className="col-span-12 md:col-span-3 md:justify-self-end hover:underline underline-offset-4 decoration-2">Back to top ↑</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
