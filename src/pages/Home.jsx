import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Copy, Check, Clapperboard } from 'lucide-react'
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
import HeroElephants from '../components/HeroElephants.jsx'
import ServicesSection from '../components/ServicesSection.jsx'
import AboutSection from '../components/AboutSection.jsx'
import SmokeVideo from '../components/SmokeVideo.jsx'
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

// Senza punto: in Doto il punto è una crocetta che sposta il nome fuori asse
const HERO_LINES = ['Matteo Masia']
const EMAIL = 'matteomasiadesign@gmail.com'
const PHONE = '+393495862375'

// Recapiti della sezione contatti; "copy" aggiunge il pulsante per copiare
const CONTACTS = [
  { label: 'Email', value: EMAIL, href: `mailto:${EMAIL}`, copy: EMAIL },
  { label: 'WhatsApp', value: '+39 349 586 2375', href: 'https://wa.me/393495862375', external: true, copy: PHONE },
  { label: 'Instagram', value: '@matteomasiadesign', href: 'https://instagram.com/matteomasiadesign', external: true },
  { label: 'Flickr', value: 'matteomasiaphotography', href: 'https://flickr.com/matteomasiaphotography', external: true },
]

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
const field = 'field w-full bg-transparent rounded-none border-0 border-b-[3px] border-black/25 px-0 py-3 text-base md:text-lg text-black placeholder:text-black/40 focus:border-black transition-colors disabled:opacity-50'

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
    { name: 'What I do', id: 'services' },
    { name: 'About', id: 'bio' },
    { name: 'Contact', id: 'contact' },
  ]

  const t = getTokens(isDark)
  const { cBgMain, cTextMain, cTextMuted } = t
  const submitting = formStatus === 'submitting'

  return (
    <div className="min-h-screen w-full bg-black font-sans selection:bg-[#ff2b1c] selection:text-black relative overflow-x-clip">
      {/* --- NAVIGAZIONE: riga in alto nella hero, poi il "+" in basso a destra --- */}
      <Navbar menuItems={menuItems} onSection={scrollToSection} />

      <main id="home" className={`w-full min-h-screen ${cBgMain} ${cTextMain}`}>
        {/* --- HERO SECTION --- */}
        {/* Desktop: tutto il blocco al centro, pb-[12vh] lo porta al centro ottico e fuori dalla sfumatura.
            Mobile: nome al centro dello spazio libero, bottoni in fondo sulla riga del "+" */}
        <section aria-label="Intro" className="hero-red min-h-[100svh] flex flex-col md:justify-center md:items-center md:pb-[12vh] relative overflow-hidden text-black">
          {/* Rosso e nero che si muovono lenti come un fluido */}
          <HeroFluid />
          {/* Elefanti di Dalí che attraversano lo sfondo, sotto la sfumatura */}
          <HeroElephants />
          {/* Sfumatura dal rosso allo sfondo della pagina, verso i progetti */}
          <div aria-hidden="true" className="hero-fade pointer-events-none absolute inset-x-0 bottom-0 h-[38vh]" />
          {/* Grana di pellicola, la stessa della stanza rossa */}
          <div aria-hidden="true" className="lynch-grain hero-grain absolute pointer-events-none" />
          {/* Parte ancora rossa della hero (il fondo sfumato conta già come scuro per la navigazione) */}
          <div aria-hidden="true" data-nav-surface="red" className="pointer-events-none absolute inset-x-0 top-0 bottom-[25vh]" />
          {/* Anno in alto, sulla stessa altezza della riga di navigazione: al centro su
              mobile, a sinistra su desktop dove il centro è occupato dal menu */}
          <div className="absolute top-0 inset-x-0 z-10 pt-[env(safe-area-inset-top)]">
            <div className="wrap h-14 md:h-[76px] flex items-center justify-center md:justify-start text-sm font-medium">
              <p>2026 ©</p>
            </div>
          </div>
          <div className="wrap flex-1 md:flex-none flex flex-col items-center text-center z-10 relative pb-[calc(28px+env(safe-area-inset-bottom))] md:pb-0">
            {/* pb-[16svh]: su mobile il nome resta sopra la metà, lontano dalla sfumatura
                scura, così attorno a lui l'alone di rosso pieno resta intero */}
            <div className="my-auto pb-[16svh] md:my-0 md:pb-0 flex flex-col items-center">
              {/* Il nome cresce con lo schermo restando su una riga: Doto rende meglio grande */}
              <SmokeTitle lines={HERO_LINES} className="text-[clamp(2.25rem,10.5vw,8rem)] font-bold leading-none whitespace-nowrap mb-0.5 md:mb-1" />

              {/* Il ruolo come etichetta sotto il nome: il nome resta l'unica cosa grande */}
              <FadeIn delay={500}>
                <p className="text-xs md:text-sm font-semibold uppercase tracking-widest md:mb-12">
                  Digital Designer
                </p>
              </FadeIn>
            </div>

            {/* Un'azione principale piena e una secondaria a cornice. Su mobile stanno in
                fondo, sulla sfumatura scura: rosse come i bottoni delle sezioni nere, alte
                come il "+" (h-12 centrato sui suoi 56px) e con spazio a destra per lui */}
            <FadeIn delay={1050} className="self-stretch ml-2 mr-[72px] md:self-auto md:mx-0">
              <div className="flex gap-2 md:gap-4">
                <a {...anchor('contact')} className="rounded-full hero-btn-red group flex-1 md:flex-none inline-flex items-center justify-center gap-2 whitespace-nowrap h-12 md:h-auto px-3 md:px-7 md:py-3 md:min-w-[13rem] border-2 border-[#ff2b1c] bg-[#ff2b1c] text-black md:border-black md:bg-black md:text-[#ff2b1c] font-semibold text-sm md:text-base active:scale-95 transition-all duration-200">
                  Work with me
                  <ArrowRight size={18} className="hidden md:block group-hover:translate-x-1 transition-transform" />
                </a>
                <a {...anchor('projects')} className="rounded-full hero-btn flex-1 md:flex-none inline-flex items-center justify-center whitespace-nowrap h-12 md:h-auto px-3 md:px-7 md:py-3 md:min-w-[13rem] border-2 border-[#ff2b1c] bg-transparent text-[#ff2b1c] md:border-black md:text-black font-semibold text-sm md:text-base active:scale-95 transition-all duration-200">
                  Archive
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
        <AboutSection />

        {/* --- CONTATTI --- */}
        {/* Stessa impaginazione di "What I do": testata a sinistra, elenco a righe a destra */}
        <section id="contact" data-nav-surface="red" className="punk-red text-black relative z-10 section-y">
          <div className="wrap grid-12 lg:grid-rows-[auto_1fr]">
            {/* Testata */}
            <FadeIn className="col-span-12 lg:col-span-4">
              <span className="block text-xs font-semibold uppercase tracking-widest mb-4">// Contact</span>
              <h2 className="text-5xl md:text-7xl xl:text-8xl leading-[0.9]">
                Let's <span className="lg:block">talk.</span>
              </h2>
              <p className="mt-5 lg:mt-7 text-base md:text-lg font-medium max-w-[19rem] text-balance">
                Una collaborazione, un preventivo o due chiacchiere: rispondo entro 24 ore.
              </p>
            </FadeIn>

            <div className="col-span-12 lg:col-span-8 lg:col-start-5 lg:row-span-2 mt-12 lg:mt-0">
              {/* Recapiti: righe come l'elenco dei servizi, la copia accanto */}
              <FadeIn delay={100}>
                <ul className="border-t-[3px] border-black">
                  {CONTACTS.map((c, i) => (
                    <li key={c.label} className="border-b-[3px] border-black flex">
                      <a
                        href={c.href}
                        {...(c.external && { target: '_blank', rel: 'noopener noreferrer' })}
                        className="punk-row group flex-1 min-w-0 flex items-center gap-4 md:gap-6 px-2 md:px-4 py-5 md:py-6"
                      >
                        <span className="shrink-0 text-xs md:text-sm font-semibold tabular-nums">[{String(i + 1).padStart(2, '0')}]</span>
                        <span className="flex-1 min-w-0 flex flex-col md:flex-row md:items-baseline md:justify-between gap-1.5 md:gap-6">
                          <span className="punk-row-title font-display text-2xl md:text-3xl xl:text-4xl leading-[0.95] uppercase">{c.label}</span>
                          <span className="text-sm md:text-base font-semibold truncate">{c.value}</span>
                        </span>
                        {/* Su mobile niente freccia: lo spazio serve all'email intera */}
                        <span className="hidden md:inline shrink-0 text-base font-semibold" aria-hidden="true">[{c.external ? '↗' : '→'}]</span>
                      </a>
                      {c.copy && (
                        <button
                          onClick={() => handleCopy(c.copy, c.label)}
                          aria-label={`Copia ${c.label === 'Email' ? "l'indirizzo email" : 'il numero'}`}
                          className="punk-row shrink-0 w-14 md:w-16 flex items-center justify-center border-l-[3px] border-black"
                        >
                          {copiedData === c.label ? <Check size={18} /> : <Copy size={18} />}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                <p aria-live="polite" className="sr-only">{copiedData ? 'Copiato negli appunti' : ''}</p>
              </FadeIn>

              {/* Form: stesse righe sottili, nessun titolo grande */}
              <FadeIn delay={200}>
                <form onSubmit={handleFormSubmit} noValidate className="mt-16 md:mt-20 flex flex-col gap-8">
                  <span className={label}>// Or write here</span>

                  <div aria-live="polite">
                    {formStatus === 'success' && (
                      <div className="border-[3px] border-black p-6 flex items-start gap-4">
                        <Check size={24} className="shrink-0" />
                        <div>
                          <p className="text-lg font-semibold">Message sent.</p>
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
                        <textarea id="f-messaggio" name="messaggio" required disabled={submitting} rows={3} className={`${field} resize-none`}
                          value={formData.messaggio} onChange={(e) => setFormData({ ...formData, messaggio: e.target.value })} />
                      </div>

                      {formError && <p id="form-error" role="alert" className="text-sm font-semibold bg-black text-[#ff2b1c] px-3 py-2 w-fit">{formError}</p>}

                      {/* Stesso bottone di "Start a project" */}
                      <button
                        type="submit"
                        disabled={submitting}
                        className="rounded-full hero-btn punk-shadow group self-start flex items-center gap-3 whitespace-nowrap px-7 py-3.5 md:px-8 md:py-4 border-2 border-black bg-transparent text-black font-semibold text-base md:text-lg active:scale-95 transition-colors duration-200 disabled:opacity-60"
                      >
                        {submitting ? (
                          <><span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" /> Sending…</>
                        ) : (
                          <>Send message <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>
                        )}
                      </button>
                    </>
                  )}
                </form>
              </FadeIn>
            </div>

            {/* Ora locale: in fondo alla colonna sinistra, dove nei servizi sta l'invito */}
            <p className={`${label} col-span-12 lg:col-span-4 lg:row-start-2 lg:self-end mt-12 lg:mt-10 flex items-center gap-2`}>
              Porto Torres · <LocalTime />
            </p>
          </div>
        </section>
      </main>

      {/* --- FOOTER --- */}
      {/* Continua il rosso dei contatti e sfuma nel nero; la riga finale sta sul nero.
          Il "+" resta nero finché il fondo è ancora rosso, poi diventa rosso */}
      <footer className="contact-fade text-[#ff2b1c] relative z-10">
        {/* Il corvo di fumo sul ramo (tools/crow/), in una striscia: il formato
            verticale del video è quello quasi quadrato dei telefoni */}
        <div data-nav-surface="red" className="relative h-[clamp(18rem,30vw,30rem)]">
          <SmokeVideo name="crow" portraitBelow={2} />
        </div>
        {/* Margine sotto: la riga finale resta sopra il "+" */}
        <div className="wrap pt-6 md:pt-10 pb-[calc(7rem+env(safe-area-inset-bottom,0px))]">
          <div className="pt-5 border-t border-[#ff2b1c]/40 grid-12 gap-y-4 text-xs font-semibold uppercase tracking-widest">
            <p className="col-span-12 md:col-span-4">© {new Date().getFullYear()} Matteo Masia · P.IVA 03062630904</p>
            <nav aria-label="Footer" className="col-span-12 md:col-span-5 flex flex-wrap gap-x-6 gap-y-2">
              <Link to="/progetti" className="hover:text-white transition-colors">Archive</Link>
              <a href="https://instagram.com/matteomasiadesign" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Instagram</a>
              <a href="https://flickr.com/matteomasiaphotography" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Flickr</a>
            </nav>
            <a {...anchor('home')} className="col-span-12 md:col-span-3 md:justify-self-end hover:text-white transition-colors">Back to top ↑</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
