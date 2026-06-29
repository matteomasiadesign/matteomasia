import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, Sun, Moon, Instagram } from 'lucide-react'
import { useTheme } from '../lib/ThemeContext.jsx'
import { getTokens } from '../lib/tokens.js'
import { useProjects } from '../lib/useProjects.js'

export default function Progetti() {
  const { toggleTheme, isDark } = useTheme()
  const navigate = useNavigate()
  const { projects, loading } = useProjects()

  const t = getTokens(isDark)
  const { cBgMain, cTextMain, cTextMuted, cBorder, cCard, cGlass } = t

  return (
    <div className={`min-h-screen w-full ${cBgMain} ${cTextMain} font-sans selection:bg-blue-500 selection:text-white`}>
      {/* --- HEADER --- */}
      <header className={`sticky top-0 z-50 ${cGlass} backdrop-blur-xl border-b ${cBorder}`}>
        <div className="max-w-[980px] mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className={`group flex items-center gap-2 text-sm font-medium ${cTextMuted} ${isDark ? 'hover:text-white' : 'hover:text-black'} transition-colors active:scale-95`}
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            Home
          </button>
          <div className="text-lg font-semibold tracking-tight">Progetti</div>
          <button onClick={toggleTheme} className={`p-2 rounded-full ${isDark ? 'hover:bg-white/10 text-white' : 'hover:bg-black/10 text-black'} transition-colors active:scale-90`}>
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>

      {/* --- TITOLO --- */}
      <section className="max-w-[980px] mx-auto px-6 pt-16 md:pt-24 pb-10 md:pb-16">
        <h1 className="text-4xl md:text-7xl font-semibold tracking-tighter mb-3">Archivio completo.</h1>
        <p className={`${cTextMuted} text-lg md:text-2xl font-medium tracking-tight`}>
          Tutti i progetti selezionati. Branding, web design, art direction e print.
        </p>
      </section>

      {/* --- GRIGLIA PROGETTI --- */}
      <section className="max-w-[980px] mx-auto px-6 pb-32 md:pb-24">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={`aspect-[4/3] rounded-2xl md:rounded-[2rem] ${cCard} border ${cBorder} animate-pulse`} />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className={`flex flex-col items-center justify-center py-24 text-center gap-3 ${cTextMuted}`}>
            <p className="text-xl font-medium">Nessun progetto ancora.</p>
            <p className="text-sm">Aggiungi i primi progetti dalla pagina admin.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {projects.map((project) => (
              <article
                key={project.id}
                className="group cursor-pointer active:scale-[0.99] transition-transform duration-300"
                onClick={() => project.instagram_url && window.open(project.instagram_url, '_blank', 'noopener')}
              >
                <div className={`w-full aspect-[4/3] rounded-2xl md:rounded-[2rem] overflow-hidden ${cCard} mb-5 relative border ${cBorder} shadow-sm`}>
                  {project.img ? (
                    <img
                      src={project.img}
                      alt={project.title}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-[1.5s] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center ${cTextMuted} text-sm`}>Nessuna immagine</div>
                  )}
                  <div className="absolute top-4 left-4 md:top-6 md:left-6 px-4 py-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    <span className="text-xs font-semibold tracking-widest uppercase text-white">{project.category}</span>
                  </div>
                  {project.instagram_url && (
                    <div className="absolute top-4 right-4 md:top-6 md:right-6 p-2.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                      <Instagram size={16} className="text-white" />
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-start px-1">
                  <div className="pr-4">
                    <h3 className="text-xl md:text-2xl font-semibold tracking-tight mb-1">{project.title}</h3>
                    <p className={`${cTextMuted} text-sm md:text-base font-medium`}>{project.category}</p>
                    {project.description && (
                      <p className={`${cTextMuted} text-sm mt-2 leading-relaxed max-w-md`}>{project.description}</p>
                    )}
                  </div>
                  {project.instagram_url && (
                    <div className={`w-10 h-10 rounded-full ${cCard} border ${cBorder} flex items-center justify-center shrink-0 ${isDark ? 'group-hover:bg-white group-hover:text-black' : 'group-hover:bg-black group-hover:text-white'} transition-colors duration-300`}>
                      <ArrowUpRight size={18} />
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
