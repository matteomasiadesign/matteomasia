import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, ArrowRight, ArrowLeft, Menu, X, CheckCircle2, Copy, Check, MessageCircle, Sun, Moon } from 'lucide-react'
import { useTheme } from '../lib/ThemeContext.jsx'
import { getTokens } from '../lib/tokens.js'
import { useProjects } from '../lib/useProjects.js'
import { useServices } from '../lib/useServices.js'
import { supabase, isSupabaseReady } from '../lib/supabase.js'

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
      { rootMargin: '0px 0px -10% 0px' }
    )

    if (domRef.current) observer.observe(domRef.current)
    return () => {
      if (domRef.current) observer.unobserve(domRef.current)
    }
  }, [])

  const getTransform = () => {
    if (isVisible) return 'translateY(0) scale(1)'
    if (direction === 'up') return 'translateY(40px) scale(0.98)'
    if (direction === 'scale') return 'translateY(0) scale(0.95)'
    return 'translateY(0)'
  }

  return (
    <div
      ref={domRef}
      className={`transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${className}`}
      style={{ opacity: isVisible ? 1 : 0, transform: getTransform(), transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

// --- COMPONENTE ONDE ANIMATE (ADATTIVE AL TEMA) ---
const AnimatedNeonWaves = ({ theme }) => {
  const isDark = theme === 'dark'

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none z-0 ${isDark ? 'opacity-70 mix-blend-screen' : 'opacity-40 mix-blend-multiply'}`}>
      <div className={`absolute inset-0 bg-gradient-to-b ${isDark ? 'from-black via-transparent to-black' : 'from-[#f5f5f7] via-transparent to-[#f5f5f7]'} z-10`}></div>

      <div className="absolute top-[10%] md:top-[5%] left-0 w-[200%] h-[80vh] blur-[40px] md:blur-[60px]">
        <svg className="absolute w-full h-full animate-[wave-slide_12s_linear_infinite]" viewBox="0 0 200 100" preserveAspectRatio="none">
          <path d="M 0 50 C 25 10, 25 90, 50 50 C 75 10, 75 90, 100 50 C 125 10, 125 90, 150 50 C 175 10, 175 90, 200 50"
            fill="none" stroke="url(#gradMagenta)" strokeWidth={isDark ? '4' : '6'} className="animate-[wave-breathe_8s_ease-in-out_infinite]" />
        </svg>
        <svg className="absolute w-full h-full animate-[wave-slide_16s_linear_infinite_reverse]" viewBox="0 0 200 100" preserveAspectRatio="none">
          <path d="M 0 50 C 25 80, 25 20, 50 50 C 75 80, 75 20, 100 50 C 125 80, 125 20, 150 50 C 175 80, 175 20, 200 50"
            fill="none" stroke="url(#gradCyan)" strokeWidth={isDark ? '6' : '8'} className="animate-[wave-breathe_10s_ease-in-out_infinite_reverse]" />
        </svg>
        <svg className="absolute w-full h-full animate-[wave-slide_20s_linear_infinite]" viewBox="0 0 200 100" preserveAspectRatio="none">
          <path d="M 0 50 C 20 30, 30 70, 50 50 C 70 30, 80 70, 100 50 C 120 30, 130 70, 150 50 C 170 30, 180 70, 200 50"
            fill="none" stroke="url(#gradPurple)" strokeWidth={isDark ? '3' : '5'} className="animate-[wave-breathe_12s_ease-in-out_infinite]" />
        </svg>

        <svg className="w-0 h-0 absolute">
          <defs>
            <linearGradient id="gradMagenta" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={isDark ? '#ff0844' : '#ff4b72'} />
              <stop offset="50%" stopColor={isDark ? '#ffb199' : '#ff7e5f'} />
              <stop offset="100%" stopColor={isDark ? '#ff0844' : '#ff4b72'} />
            </linearGradient>
            <linearGradient id="gradCyan" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={isDark ? '#4facfe' : '#00c6ff'} />
              <stop offset="50%" stopColor={isDark ? '#00f2fe' : '#0072ff'} />
              <stop offset="100%" stopColor={isDark ? '#4facfe' : '#00c6ff'} />
            </linearGradient>
            <linearGradient id="gradPurple" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={isDark ? '#a18cd1' : '#8e2de2'} />
              <stop offset="50%" stopColor={isDark ? '#fbc2eb' : '#4a00e0'} />
              <stop offset="100%" stopColor={isDark ? '#a18cd1' : '#8e2de2'} />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  )
}

export default function Home() {
  const { theme, toggleTheme, isDark } = useTheme()
  const navigate = useNavigate()
  const { projects } = useProjects()
  const { services } = useServices()

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [showFloatingNav, setShowFloatingNav] = useState(true)
  const [formStatus, setFormStatus] = useState('idle')
  const [formData, setFormData] = useState({ nome: '', email: '', oggetto: '', messaggio: '' })
  const [formError, setFormError] = useState(null)
  const [copiedData, setCopiedData] = useState(null)
  const [activeProjectIndex, setActiveProjectIndex] = useState(0)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const carouselRef = useRef(null)
  const lastScrollY = useRef(0)

  // Se si arriva con un hash (es. /#contact dalla pagina dettaglio), scrolla lì
  useEffect(() => {
    if (window.location.hash) {
      const id = window.location.hash.slice(1)
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 300)
    }
  }, [])

  // Mostra al massimo i primi 4 progetti nel carosello della home
  const featured = projects.slice(0, 4)

  // Aggiorna lo stato delle frecce del carosello desktop in base allo scroll corrente
  const updateCarouselArrows = () => {
    const el = carouselRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
  }

  useEffect(() => {
    updateCarouselArrows()
    window.addEventListener('resize', updateCarouselArrows)
    return () => window.removeEventListener('resize', updateCarouselArrows)
  }, [featured.length])

  const scrollCarousel = (direction) => {
    const el = carouselRef.current
    if (!el) return
    const amount = Math.min(el.clientWidth * 0.9, 632)
    el.scrollBy({ left: direction * amount, behavior: 'smooth' })
  }

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      setScrolled(currentScrollY > 20)

      if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
        setShowFloatingNav(false)
      } else {
        setShowFloatingNav(true)
      }
      lastScrollY.current = currentScrollY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleCarouselScroll = () => {
    if (carouselRef.current) {
      const scrollPos = carouselRef.current.scrollLeft
      const cardWidth = window.innerWidth * 0.85
      const index = Math.round(scrollPos / cardWidth)
      setActiveProjectIndex(index)
    }
    updateCarouselArrows()
  }

  const scrollToSection = (id) => {
    setIsMenuOpen(false)
    setTimeout(() => {
      const element = document.getElementById(id)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' })
      }
    }, 400)
  }

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

  const handleCopy = (text, type) => {
    const el = document.createElement('textarea')
    el.value = text
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
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
    { name: 'Archivio', id: 'projects' },
    { name: 'Servizi', id: 'services' },
    { name: 'Chi sono', id: 'bio' },
    { name: 'Lavora con me', id: 'contact' },
  ]

  const t = getTokens(isDark)
  const { cBgRoot, cBgMain, cBgSec, cTextMain, cTextMuted, cBorder, cCard, cBtnBgPrimary, cBtnBgSecondary, cGlass } = t

  return (
    <div className={`min-h-screen w-full ${cBgRoot} font-sans selection:bg-blue-500 selection:text-white relative overflow-hidden`}>
      <style>{`
        .apple-gradient-text {
          background: ${isDark ? 'linear-gradient(135deg, #fff 0%, #86868b 100%)' : 'linear-gradient(135deg, #1d1d1f 0%, #86868b 100%)'};
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .apple-input {
          width: 100%;
          background: ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)'};
          border: 1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'};
          border-radius: 12px;
          padding: 16px 20px;
          color: ${isDark ? 'white' : 'black'};
          font-size: 16px;
          transition: all 0.3s ease;
        }
        .apple-input:focus {
          outline: none;
          background: ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)'};
          border-color: ${isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'};
          box-shadow: 0 0 0 4px ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'};
        }
        .apple-input::placeholder { color: #86868b; }
        @keyframes glow-pulse {
          0%, 100% { box-shadow: var(--glow-rest); transform: scale(1); }
          50% { box-shadow: var(--glow-peak); transform: scale(1.25); }
        }
        .glow-dot {
          animation: glow-pulse 2.6s ease-in-out infinite;
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .card-glow {
          animation: spin-slow 6s linear infinite;
        }
      `}</style>

      {/* --- DESKTOP NAVBAR --- */}
      <header className={`hidden md:block fixed top-0 left-0 w-full z-50 transition-all duration-500 ${scrolled ? `${cGlass} backdrop-blur-xl border-b py-3` : 'bg-transparent py-6'}`}>
        <div className="max-w-[980px] mx-auto px-6 flex justify-between items-center">
          <div onClick={() => scrollToSection('home')} className={`text-xl font-semibold tracking-tight cursor-pointer hover:opacity-70 transition-opacity active:scale-[0.98] ${cTextMain}`}>
            Matteo Masia.
          </div>
          <nav className={`flex gap-8 text-sm font-medium ${cTextMuted}`}>
            {menuItems.map((item) => (
              <button key={item.id} onClick={() => scrollToSection(item.id)} className={`hover:${isDark ? 'text-white' : 'text-black'} transition-colors active:scale-95`}>
                {item.name}
              </button>
            ))}
            <button onClick={() => navigate('/progetti')} className={`hover:${isDark ? 'text-white' : 'text-black'} transition-colors active:scale-95`}>
              Progetti
            </button>
          </nav>
          <button onClick={toggleTheme} className={`p-2 rounded-full ${isDark ? 'hover:bg-white/10 text-white' : 'hover:bg-black/10 text-black'} transition-colors active:scale-90`}>
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>

      {/* --- MOBILE: TOP LOGO ONLY --- */}
      <header className={`md:hidden fixed top-0 left-0 w-full z-40 transition-all duration-500 ${scrolled ? `${cGlass} backdrop-blur-md border-b py-3` : 'bg-transparent py-5'}`}>
        <div className="px-5">
          <div onClick={() => scrollToSection('home')} className={`text-xl font-semibold tracking-tight cursor-pointer active:scale-95 ${cTextMain}`}>
            M. Masia
          </div>
        </div>
      </header>

      {/* --- MOBILE: SMART FLOATING ACTION ISLAND --- */}
      <div className={`md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 p-2 rounded-full ${cGlass} backdrop-blur-2xl shadow-[0_10px_40px_rgba(0,0,0,0.3)] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${showFloatingNav ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-24 opacity-0 scale-90 pointer-events-none'}`}>
        <button onClick={() => setIsMenuOpen(true)} className={`p-3 rounded-full ${isDark ? 'bg-white/10 text-white' : 'bg-black/5 text-black'} active:scale-90 transition-transform`}>
          <Menu size={22} />
        </button>
        <button onClick={toggleTheme} className={`p-3 rounded-full ${isDark ? 'bg-white/10 text-white' : 'bg-black/5 text-black'} active:scale-90 transition-transform`}>
          {isDark ? <Sun size={22} /> : <Moon size={22} />}
        </button>
        <a href="https://wa.me/393495862375" target="_blank" rel="noopener noreferrer" className="p-3 rounded-full bg-[#25D366] text-white active:scale-90 transition-transform shadow-[0_0_15px_rgba(37,211,102,0.4)]">
          <MessageCircle size={22} />
        </a>
      </div>

      {/* --- MOBILE: BOTTOM SHEET MENU --- */}
      <div className={`md:hidden fixed inset-0 z-[70] transition-opacity duration-300 ${isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0" onClick={() => setIsMenuOpen(false)}></div>

        <div className={`absolute bottom-0 left-0 w-full rounded-t-3xl ${cBgSec} p-6 pb-12 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isMenuOpen ? 'translate-y-0 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]' : 'translate-y-full'}`}>
          <div className="w-12 h-1.5 rounded-full bg-gray-400/30 mx-auto mb-6"></div>

          <div className="flex justify-between items-center mb-6">
            <h3 className={`text-xl font-semibold ${cTextMain}`}>Navigazione</h3>
            <button onClick={() => setIsMenuOpen(false)} className={`p-2 rounded-full ${isDark ? 'bg-white/10 text-white' : 'bg-black/5 text-black'} active:scale-90 transition-transform`}>
              <X size={20} />
            </button>
          </div>
          <ul className="flex flex-col gap-2">
            {menuItems.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => scrollToSection(item.id)}
                  className={`w-full text-left py-4 px-4 rounded-xl text-2xl font-medium active:scale-[0.98] transition-all ${cTextMain} ${isDark ? 'hover:bg-white/5 active:bg-white/10' : 'hover:bg-black/5 active:bg-black/10'}`}
                >
                  {item.name}
                </button>
              </li>
            ))}
            <li>
              <button
                onClick={() => navigate('/progetti')}
                className={`w-full text-left py-4 px-4 rounded-xl text-2xl font-medium active:scale-[0.98] transition-all ${cTextMain} ${isDark ? 'hover:bg-white/5 active:bg-white/10' : 'hover:bg-black/5 active:bg-black/10'}`}
              >
                Progetti
              </button>
            </li>
          </ul>
        </div>
      </div>

      {/* --- APP CONTENT WRAPPER (Recede / Scale Down) --- */}
      <div id="home" className={`w-full min-h-screen ${cBgMain} ${cTextMain} transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] transform origin-top ${isMenuOpen ? 'scale-[0.93] rounded-[2rem] overflow-hidden opacity-40 brightness-75 pointer-events-none shadow-2xl' : 'scale-100 rounded-none opacity-100 brightness-100'}`}>
        {/* --- HERO SECTION --- */}
        <main className="min-h-screen flex flex-col justify-center items-center px-4 md:px-10 relative overflow-hidden">
          <AnimatedNeonWaves theme={theme} />

          <div className="max-w-[980px] mx-auto w-full flex flex-col items-center text-center z-10 relative mt-10 md:mt-0">
            <h1 className="text-[14vw] md:text-[6rem] lg:text-[8rem] font-semibold tracking-tighter leading-[1.05] apple-gradient-text mb-3 md:mb-4">
              {['Matteo', 'Masia.'].map((word, i) => (
                <React.Fragment key={word}>
                  {i > 0 && ' '}
                  <span className="apple-gradient-text hero-reveal-word" style={{ animationDelay: `${i * 180}ms` }}>{word}</span>
                </React.Fragment>
              ))}
            </h1>

            <FadeIn delay={450}>
              <p className={`text-xl md:text-3xl font-medium ${cTextMuted} max-w-2xl mx-auto tracking-tight leading-tight mb-10 md:mb-14 ${isDark ? 'drop-shadow-md' : ''}`}>
                Visual & Digital Product Designer — Comunicazione visiva per imprese, progetti ed eventi.
              </p>
            </FadeIn>

            <FadeIn delay={650}>
              <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto px-4 md:px-0">
                <button
                  onClick={() => scrollToSection('contact')}
                  className={`w-full md:w-auto px-8 py-4 rounded-full ${cBtnBgPrimary} font-semibold tracking-tight text-lg active:scale-95 hover:scale-105 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-[0_5px_20px_rgba(0,0,0,0.1)]`}
                >
                  Lavora con me
                </button>
                <button
                  onClick={() => scrollToSection('projects')}
                  className={`w-full md:w-auto px-8 py-4 rounded-full ${cBtnBgSecondary} font-semibold tracking-tight text-lg hover:opacity-80 active:scale-95 transition-all duration-300 border ${cBorder}`}
                >
                  Archivio
                </button>
              </div>
            </FadeIn>
          </div>
        </main>

        {/* --- GALLERIA PROGETTI (featured) --- */}
        <section id="projects" className={`pt-16 pb-24 md:pt-20 md:pb-40 w-full overflow-hidden relative z-10 ${cBgMain} transition-colors duration-700`}>
          <div className="max-w-[980px] mx-auto px-6 mb-10 md:mb-16">
            <FadeIn>
              <h2 className="text-3xl md:text-5xl font-semibold tracking-tight mb-3">Lavori recenti.</h2>
              <p className={`${cTextMuted} text-lg md:text-xl font-medium tracking-tight`}>Esplora l'archivio dei progetti selezionati.</p>
            </FadeIn>
          </div>

          {/* Wrapper relativo per posizionare le ombre */}
          <div className="relative w-full">
            
            {/* Ombra Sinistra (Solo Desktop) */}
            <div className={`hidden md:block absolute top-0 left-0 bottom-0 w-[calc((100vw-980px)/2+40px)] z-20 pointer-events-none bg-gradient-to-r ${isDark ? 'from-black via-black/90' : 'from-[#f5f5f7] via-[#f5f5f7]/90'} to-transparent`}></div>
            
            {/* Ombra Destra (Solo Desktop) */}
            <div className={`hidden md:block absolute top-0 right-0 bottom-0 w-[10vw] z-20 pointer-events-none bg-gradient-to-l ${isDark ? 'from-black via-black/80' : 'from-[#f5f5f7] via-[#f5f5f7]/80'} to-transparent`}></div>

            {/* Frecce di navigazione (Solo Desktop) */}
            <button
              type="button"
              onClick={() => scrollCarousel(-1)}
              aria-label="Progetto precedente"
              className={`hidden md:flex absolute left-4 lg:left-8 top-[42%] -translate-y-1/2 z-30 w-12 h-12 rounded-full items-center justify-center border ${cBorder} ${cCard} shadow-lg transition-all duration-300 ${canScrollLeft ? `opacity-100 hover:scale-110 active:scale-95 ${isDark ? 'hover:bg-white hover:text-black' : 'hover:bg-black hover:text-white'}` : 'opacity-0 pointer-events-none'}`}
            >
              <ArrowLeft size={20} />
            </button>
            <button
              type="button"
              onClick={() => scrollCarousel(1)}
              aria-label="Progetto successivo"
              className={`hidden md:flex absolute right-4 lg:right-8 top-[42%] -translate-y-1/2 z-30 w-12 h-12 rounded-full items-center justify-center border ${cBorder} ${cCard} shadow-lg transition-all duration-300 ${canScrollRight ? `opacity-100 hover:scale-110 active:scale-95 ${isDark ? 'hover:bg-white hover:text-black' : 'hover:bg-black hover:text-white'}` : 'opacity-0 pointer-events-none'}`}
            >
              <ArrowRight size={20} />
            </button>

            <div
              ref={carouselRef}
              onScroll={handleCarouselScroll}
              className="w-full px-6 md:px-0 md:pl-[calc((100vw-980px)/2)] flex flex-col md:flex-row overflow-y-visible md:overflow-x-auto hide-scrollbar md:snap-x md:snap-mandatory gap-8 pb-4 md:pr-10"
            >
              {featured.map((project, index) => {
                const card = (
                  <div className={`w-full aspect-[4/3] md:aspect-[16/10] rounded-2xl md:rounded-[2rem] overflow-hidden ${cCard} mb-5 relative border ${cBorder} shadow-sm group`}>
                    <img
                      src={project.img}
                      alt={project.title}
                      className="w-full h-full object-cover transition-transform duration-[1.5s] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
                    />
                    <div className="absolute top-4 left-4 md:top-6 md:left-6 px-4 py-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10">
                      <span className="text-xs font-semibold tracking-widest uppercase text-white">{project.category}</span>
                    </div>
                  </div>
                )
                return (
                  <FadeIn key={project.id} delay={index * 50} direction="scale" className="w-full md:flex-none md:w-[600px] md:snap-start group cursor-pointer active:scale-[0.98] transition-transform duration-300">
                    <div onClick={() => navigate(`/progetti/${project.slug || project.id}`)}>
                      {card}
                      <div className="flex justify-between items-start px-1">
                        <div>
                          <h3 className="text-xl md:text-2xl font-semibold tracking-tight mb-1">{project.title}</h3>
                          <p className={`${cTextMuted} text-sm md:text-base font-medium`}>{project.category}</p>
                        </div>
                        <div className={`w-10 h-10 rounded-full ${cCard} border ${cBorder} flex items-center justify-center ${isDark ? 'group-hover:bg-white group-hover:text-black' : 'group-hover:bg-black group-hover:text-white'} transition-colors duration-300`}>
                          <ArrowUpRight size={18} />
                        </div>
                      </div>
                    </div>
                  </FadeIn>
                )
              })}
            </div>
          </div>

          <div className="max-w-[980px] mx-auto px-6 flex justify-center mt-12 md:mt-16">
            <FadeIn delay={200}>
              <button
                onClick={() => navigate('/progetti')}
                className={`group flex items-center gap-3 px-8 py-4 rounded-full bg-transparent border ${cBorder} font-medium tracking-tight ${isDark ? 'hover:bg-white hover:text-black' : 'hover:bg-black hover:text-white'} active:scale-95 transition-all duration-300`}
              >
                Visita la galleria completa
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </FadeIn>
          </div>
        </section>

        {/* --- SERVIZI (CARD) --- */}
        <section id="services" className={`py-24 md:py-40 ${cBgSec} px-6 transition-colors duration-700`}>
          <div className="max-w-[980px] mx-auto">
            <FadeIn>
              <div className="mb-10 md:mb-16">
                <span className={`block text-xs font-semibold uppercase tracking-widest ${cTextMuted} mb-3`}>Competenze</span>
                <h2 className="text-3xl md:text-5xl font-semibold tracking-tight mb-3">Servizi.</h2>
                <p className={`${cTextMuted} text-lg md:text-xl font-medium tracking-tight max-w-xl`}>Quattro aree in cui posso aiutarti per una comunicazione a 360°</p>
              </div>
            </FadeIn>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              {services.map((service, idx) => (
                <FadeIn key={service.id} delay={idx * 100} direction="scale">
                  <div className="group relative h-full rounded-2xl md:rounded-[2rem]">
                    <div
                      aria-hidden="true"
                      className={`card-glow pointer-events-none absolute -inset-0.5 rounded-2xl md:rounded-[2rem] blur-md opacity-0 transition-opacity duration-500 ${isDark ? 'group-hover:opacity-80' : 'group-hover:opacity-50'}`}
                      style={{ background: 'conic-gradient(from 0deg, #ff0844, #4facfe, #a18cd1, #ff0844)' }}
                    />
                    <div className={`relative z-10 flex flex-col h-full rounded-2xl md:rounded-[2rem] overflow-hidden ${cCard} border ${cBorder} shadow-sm`}>
                      <div className={`aspect-[16/10] overflow-hidden ${cBgMain} relative`}>
                        {service.img ? (
                          <img
                            src={service.img}
                            alt={service.title}
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform duration-[1.5s] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
                          />
                        ) : (
                          <div className={`w-full h-full flex items-center justify-center px-6 text-center ${cTextMuted}`}>
                            <span className="text-sm font-medium">{service.title}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col flex-1 p-6 md:p-8">
                        <h3 className="text-xl md:text-2xl font-semibold tracking-tight mb-2">{service.title}</h3>
                        {service.description && (
                          <p className={`${cTextMuted} text-sm md:text-base leading-relaxed mb-6 flex-1`}>{service.description}</p>
                        )}
                        {service.cta_link && (
                          <button
                            onClick={() => handleServiceCta(service.cta_link)}
                            className={`group/cta mt-auto self-start flex items-center gap-2 text-sm font-semibold ${cTextMain} ${isDark ? 'hover:text-white' : 'hover:text-black'} active:scale-95 transition-all`}
                          >
                            {service.cta_label || 'Scopri di più'}
                            <ArrowUpRight size={16} className="group-hover/cta:translate-x-0.5 group-hover/cta:-translate-y-0.5 transition-transform" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* --- BIO --- */}
        <section id="bio" className={`py-24 md:py-40 px-6 ${cBgMain} relative z-10 transition-colors duration-700`}>
          <div className="max-w-[980px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-24 md:items-start">
            <div className="md:col-span-5 md:sticky md:top-28">
              <FadeIn>
                <span className={`block text-xs font-semibold uppercase tracking-widest ${cTextMuted} mb-3`}>Chi sono</span>
                <h2 className="text-4xl md:text-6xl font-semibold tracking-tighter leading-tight mb-4">
                  Il mio<br /><span className={cTextMuted}>percorso.</span>
                </h2>
                <p className={`text-base md:text-lg ${cTextMuted} max-w-xs`}>Dalla fotografia alla produzione audio, fino al design digitale.</p>
              </FadeIn>
            </div>

            <div className="md:col-span-7 relative">
              {/* Linea verticale del percorso */}
              <div className={`absolute left-[7px] top-2 bottom-2 w-px ${isDark ? 'bg-white/10' : 'bg-black/10'}`} />

              <div className="flex flex-col gap-8 md:gap-10">
                <FadeIn delay={100}>
                  <div className="relative pl-8">
                    <span className="glow-dot absolute left-0 top-[2px] w-[15px] h-[15px] rounded-full bg-[#ff2d6b]/20" style={{ '--glow-rest': '0 0 2px 0px rgba(255,45,107,0.1)', '--glow-peak': '0 0 16px 5px rgba(255,45,107,0.55)', animationDelay: '0s' }} />
                    <span className={`block text-xs font-semibold uppercase tracking-widest ${cTextMuted} mb-2`}>Fotografia</span>
                    <p className={`text-lg md:text-2xl font-medium tracking-tight ${cTextMuted} leading-snug`}>
                      Visual e Web Designer, classe '97, nato in <strong className={cTextMain}>Sardegna</strong>. Inizio il mio percorso nelle arti visive con la fotografia.
                    </p>
                  </div>
                </FadeIn>
                <FadeIn delay={200}>
                  <div className="relative pl-8">
                    <span className="glow-dot absolute left-0 top-[2px] w-[15px] h-[15px] rounded-full bg-[#ff2d6b]/35" style={{ '--glow-rest': '0 0 3px 0px rgba(255,45,107,0.15)', '--glow-peak': '0 0 22px 6px rgba(255,45,107,0.65)', animationDelay: '0.4s' }} />
                    <span className={`block text-xs font-semibold uppercase tracking-widest ${cTextMuted} mb-2`}>Nuovi linguaggi</span>
                    <p className={`text-lg md:text-2xl font-medium tracking-tight ${cTextMuted} leading-snug`}>
                      Espando il mio linguaggio collaborando con altri artisti, sviluppando competenze in videomaking, editing e grafica vettoriale.
                    </p>
                  </div>
                </FadeIn>
                <FadeIn delay={300}>
                  <div className="relative pl-8">
                    <span className="glow-dot absolute left-0 top-[2px] w-[15px] h-[15px] rounded-full bg-[#ff2d6b]/50" style={{ '--glow-rest': '0 0 4px 0px rgba(255,45,107,0.2)', '--glow-peak': '0 0 28px 7px rgba(255,45,107,0.75)', animationDelay: '0.8s' }} />
                    <span className={`block text-xs font-semibold uppercase tracking-widest ${cTextMuted} mb-2`}>Produzione audio</span>
                    <p className={`text-lg md:text-2xl font-medium tracking-tight ${cTextMuted} leading-snug`}>
                      Mi dedico alla produzione audio, realizzando oltre 100 strumentali ed entrando nella sezione producer di <strong className={cTextMain}>HONIRO</strong>.
                    </p>
                  </div>
                </FadeIn>
                <FadeIn delay={400}>
                  <div className="relative pl-8">
                    <span className="glow-dot absolute left-0 top-[2px] w-[15px] h-[15px] rounded-full bg-[#ff2d6b]/65" style={{ '--glow-rest': '0 0 5px 1px rgba(255,45,107,0.25)', '--glow-peak': '0 0 34px 8px rgba(255,45,107,0.85)', animationDelay: '1.2s' }} />
                    <span className={`block text-xs font-semibold uppercase tracking-widest ${cTextMuted} mb-2`}>Nuova direzione</span>
                    <p className={`text-lg md:text-2xl font-medium tracking-tight ${cTextMuted} leading-snug`}>
                      Mi laureo in economia e management, per poi tornare alle arti visive con un approccio più strutturato: modellazione, compositing 3D e web design.
                    </p>
                  </div>
                </FadeIn>
                <FadeIn delay={500}>
                  <div className="relative pl-8">
                    <span className={`glow-dot absolute left-0 top-[-1px] w-[18px] h-[18px] rounded-full ${isDark ? 'bg-white' : 'bg-black'}`} style={{ '--glow-rest': '0 0 8px 2px rgba(255,45,107,0.4)', '--glow-peak': '0 0 46px 12px rgba(255,45,107,1)', animationDelay: '1.6s' }} />
                    <span className={`block text-xs font-semibold uppercase tracking-widest ${cTextMuted} mb-2`}>Oggi</span>
                    <div className={`p-8 md:p-12 rounded-[2rem] ${cCard} border ${cBorder} relative overflow-hidden shadow-sm`}>
                      <p className={`text-xl md:text-3xl ${cTextMain} font-semibold mb-4 md:mb-6 leading-tight tracking-tight`}>Unisco tutto questo in un sistema compatto: visione, tecnica e direzione.</p>
                      <p className={`text-base md:text-lg ${cTextMuted}`}>Un mix diretto, progettato per comunicare. Posso aiutarti a strutturare una comunicazione efficace e multi-piattaforma per il tuo business, progetto o evento.</p>
                    </div>
                  </div>
                </FadeIn>
              </div>
            </div>
          </div>
        </section>

        {/* --- SEZIONE CONTATTI --- */}
        <section id="contact" className={`py-24 md:py-40 ${cBgSec} px-6 border-t ${cBorder} relative z-10 transition-colors duration-700`}>
          <div className="max-w-[980px] mx-auto pb-10 md:pb-0">
            <FadeIn>
              <div className="flex items-center gap-3 mb-4">
                <div className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </div>
                <span className={`text-sm font-medium ${cTextMuted} uppercase tracking-wider`}>Disponibile</span>
              </div>
              <h2 className="text-4xl md:text-6xl font-semibold tracking-tighter mb-12 md:mb-24">Parliamone.</h2>
            </FadeIn>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-24">
              <div className="flex flex-col gap-10">
                <FadeIn delay={100}>
                  <p className={`text-xl md:text-2xl font-medium ${cTextMuted} leading-snug mb-2`}>
                    Vuoi propormi una collaborazione, richiedere un preventivo o scambiare due chiacchiere?
                  </p>
                  <p className={`text-sm font-medium ${cTextMuted} opacity-70`}>Rispondo di solito entro 24h.</p>
                </FadeIn>

                <FadeIn delay={200} className="flex flex-col gap-8">
                  <div>
                    <h4 className={`text-xs font-semibold ${cTextMain} uppercase tracking-widest mb-3 opacity-60`}>Email</h4>
                    <button onClick={() => handleCopy('matteomasiadesign@gmail.com', 'email')} className={`group flex items-center gap-3 text-lg md:text-2xl font-medium ${cTextMuted} ${isDark ? 'hover:text-white' : 'hover:text-black'} active:scale-95 transition-all text-left`}>
                      matteomasiadesign<br className="md:hidden" />@gmail.com
                      {copiedData === 'email' ? (
                        <span className="flex items-center gap-1 text-xs text-green-600 bg-green-500/10 px-2 py-1 rounded-md shrink-0"><Check size={12} /> Copiato</span>
                      ) : (
                        <Copy size={16} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      )}
                    </button>
                  </div>
                  <div>
                    <h4 className={`text-xs font-semibold ${cTextMain} uppercase tracking-widest mb-3 opacity-60`}>Telefono</h4>
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                      <button onClick={() => handleCopy('+393495862375', 'phone')} className={`group flex items-center gap-3 text-lg md:text-2xl font-medium ${cTextMuted} ${isDark ? 'hover:text-white' : 'hover:text-black'} active:scale-95 transition-all shrink-0`}>
                        +39 349 586 2375
                        {copiedData === 'phone' ? (
                          <span className="flex items-center gap-1 text-xs text-green-600 bg-green-500/10 px-2 py-1 rounded-md"><Check size={12} /> Copiato</span>
                        ) : (
                          <Copy size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </button>
                      <a href="https://wa.me/393495862375" target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-white bg-[#25D366] px-4 py-2 rounded-full hover:bg-[#25D366]/90 active:scale-95 transition-all w-fit flex items-center gap-2 shrink-0 shadow-sm">
                        <MessageCircle size={14} /> WhatsApp
                      </a>
                    </div>
                  </div>
                  <div>
                    <h4 className={`text-xs font-semibold ${cTextMain} uppercase tracking-widest mb-3 opacity-60`}>Social & Portfolio</h4>
                    <div className="flex flex-col gap-3">
                      <a href="https://instagram.com/matteomasiadesign" target="_blank" rel="noopener noreferrer" className={`text-base md:text-xl font-medium ${cTextMuted} ${isDark ? 'hover:text-white' : 'hover:text-black'} transition-colors group flex items-center gap-2 w-fit`}>
                        Instagram <ArrowUpRight size={16} className="opacity-0 group-hover:opacity-50 transition-opacity" />
                      </a>
                      <a href="https://flickr.com/matteomasiaphotography" target="_blank" rel="noopener noreferrer" className={`text-base md:text-xl font-medium ${cTextMuted} ${isDark ? 'hover:text-white' : 'hover:text-black'} transition-colors group flex items-center gap-2 w-fit`}>
                        Flickr (Fotografia) <ArrowUpRight size={16} className="opacity-0 group-hover:opacity-50 transition-opacity" />
                      </a>
                    </div>
                  </div>
                  <div>
                    <h4 className={`text-xs font-semibold ${cTextMain} uppercase tracking-widest mb-2 opacity-60`}>Base Operativa</h4>
                    <p className={`text-base md:text-xl font-medium ${cTextMuted}`}>Porto Torres, Sardegna</p>
                  </div>
                </FadeIn>
              </div>

              <FadeIn delay={300}>
                <form onSubmit={handleFormSubmit} className={`flex flex-col gap-4 ${isDark ? 'bg-white/5' : 'bg-black/5'} p-6 md:p-10 rounded-[2rem] border ${cBorder} shadow-sm`}>
                  <h3 className="text-xl md:text-2xl font-semibold mb-4 md:mb-6">Invia un messaggio</h3>

                  {formStatus === 'success' ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center gap-4 animate-in fade-in zoom-in duration-500">
                      <CheckCircle2 size={48} className="text-green-500" />
                      <p className="text-xl font-medium">Messaggio inviato.</p>
                      <p className={`text-sm ${cTextMuted}`}>Ti risponderò a breve.</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input type="text" placeholder="Nome" required disabled={formStatus === 'submitting'} className="apple-input"
                          value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} />
                        <input type="email" placeholder="Email" required disabled={formStatus === 'submitting'} className="apple-input"
                          value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                      </div>
                      <input type="text" placeholder="Oggetto" disabled={formStatus === 'submitting'} className="apple-input"
                        value={formData.oggetto} onChange={(e) => setFormData({ ...formData, oggetto: e.target.value })} />
                      <textarea placeholder="Il tuo messaggio..." required disabled={formStatus === 'submitting'} rows={4} className="apple-input resize-none"
                        value={formData.messaggio} onChange={(e) => setFormData({ ...formData, messaggio: e.target.value })}></textarea>

                      {formError && <p className="text-sm text-red-500">{formError}</p>}

                      <button type="submit" disabled={formStatus === 'submitting'} className={`mt-2 w-full py-4 rounded-xl ${cBtnBgPrimary} font-semibold tracking-tight text-base hover:opacity-80 active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2`}>
                        {formStatus === 'submitting' ? (
                          <><div className={`w-5 h-5 border-2 ${isDark ? 'border-black/20 border-t-black' : 'border-white/20 border-t-white'} rounded-full animate-spin`}></div> Invio...</>
                        ) : 'Invia Richiesta'}
                      </button>
                    </>
                  )}
                </form>
              </FadeIn>
            </div>
          </div>
        </section>

        {/* --- FOOTER --- */}
        <footer className={`w-full py-8 px-6 ${cBgMain} border-t ${cBorder} relative z-10 pb-24 md:pb-8 transition-colors duration-700`}>
          <div className={`max-w-[980px] mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-medium ${cTextMuted}`}>
            <p>Matteo Masia © {new Date().getFullYear()}</p>
            <p>P.IVA 03062630904</p>
          </div>
        </footer>
      </div>
    </div>
  )
}
