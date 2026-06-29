import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Sun, Moon, ArrowUpRight, Loader2, Instagram } from 'lucide-react'
import { useTheme } from '../lib/ThemeContext.jsx'
import { getTokens } from '../lib/tokens.js'
import { supabase, isSupabaseReady } from '../lib/supabase.js'
import { FALLBACK_PROJECTS } from '../lib/useProjects.js'

export default function ProgettoDettaglio() {
  const { slug } = useParams()
  const { toggleTheme, isDark } = useTheme()
  const navigate = useNavigate()
  const t = getTokens(isDark)
  const { cBgMain, cBgSec, cTextMain, cTextMuted, cBorder, cCard, cGlass } = t

  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setNotFound(false)

      if (!isSupabaseReady) {
        const p = FALLBACK_PROJECTS.find((x) => x.slug === slug || x.id === slug)
        if (!active) return
        if (p) setProject(p)
        else setNotFound(true)
        setLoading(false)
        return
      }

      // prima per slug, poi (fallback) per id
      let { data } = await supabase.from('progetti').select('*').eq('slug', slug).limit(1)
      if ((!data || data.length === 0) && /^[0-9a-f-]{36}$/i.test(slug)) {
        const res = await supabase.from('progetti').select('*').eq('id', slug).limit(1)
        data = res.data
      }
      if (!active) return
      if (data && data.length) setProject(data[0])
      else setNotFound(true)
      setLoading(false)
    }
    load()
    return () => { active = false }
  }, [slug])

  useEffect(() => {
    if (project) document.title = `${project.title} — Matteo Masia`
    return () => { document.title = 'Matteo Masia | Visual Designer' }
  }, [project])

  const media = project && Array.isArray(project.media) && project.media.length
    ? project.media
    : project && project.img
      ? [{ url: project.img, type: 'image' }]
      : []

  return (
    <div className={`min-h-screen w-full ${cBgMain} ${cTextMain} font-sans selection:bg-blue-500 selection:text-white`}>
      <header className={`sticky top-0 z-50 ${cGlass} backdrop-blur-xl border-b ${cBorder}`}>
        <div className="max-w-[980px] mx-auto px-6 py-4 flex items-center justify-between">
          <button onClick={() => navigate('/progetti')} className={`group flex items-center gap-2 text-sm font-medium ${cTextMuted} ${isDark ? 'hover:text-white' : 'hover:text-black'} transition-colors active:scale-95`}>
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> Progetti
          </button>
          <button onClick={toggleTheme} className={`p-2 rounded-full ${isDark ? 'hover:bg-white/10 text-white' : 'hover:bg-black/10 text-black'} transition-colors active:scale-90`}>
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center mt-32"><Loader2 size={28} className={`animate-spin ${cTextMuted}`} /></div>
      ) : notFound ? (
        <div className="max-w-[980px] mx-auto px-6 py-32 text-center">
          <h1 className="text-3xl font-semibold mb-3">Progetto non trovato.</h1>
          <p className={`${cTextMuted} mb-8`}>Forse è stato rimosso o l'indirizzo non è corretto.</p>
          <button onClick={() => navigate('/progetti')} className={`px-6 py-3 rounded-full border ${cBorder} ${isDark ? 'hover:bg-white hover:text-black' : 'hover:bg-black hover:text-white'} transition-all active:scale-95`}>
            Torna alla galleria
          </button>
        </div>
      ) : (
        <article className="max-w-[980px] mx-auto px-6 pb-32 md:pb-24">
          {/* HERO */}
          <header className="pt-14 md:pt-24 pb-10 md:pb-16">
            <p className={`text-xs md:text-sm font-semibold uppercase tracking-widest ${cTextMuted} mb-4`}>{project.category}</p>
            <h1 className="text-4xl md:text-7xl font-semibold tracking-tighter mb-6">{project.title}</h1>
            {project.description && (
              <p className={`text-lg md:text-2xl font-medium ${cTextMuted} leading-snug max-w-2xl tracking-tight`}>
                {project.description}
              </p>
            )}
            {project.instagram_url && (
              <a href={project.instagram_url} target="_blank" rel="noopener noreferrer"
                className={`mt-8 inline-flex items-center gap-2 px-5 py-3 rounded-full border ${cBorder} text-sm font-medium ${isDark ? 'hover:bg-white hover:text-black' : 'hover:bg-black hover:text-white'} transition-all active:scale-95`}>
                <Instagram size={16} /> Vedi su Instagram <ArrowUpRight size={14} />
              </a>
            )}
          </header>

          {/* GALLERIA MEDIA */}
          {media.length === 0 ? (
            <div className={`aspect-video rounded-[2rem] ${cCard} border ${cBorder} flex items-center justify-center ${cTextMuted}`}>
              Nessun media per questo progetto.
            </div>
          ) : (
            <div className="flex flex-col gap-4 md:gap-6">
              {media.map((m, i) => (
                <div key={i} className={`w-full rounded-2xl md:rounded-[2rem] overflow-hidden ${cCard} border ${cBorder} shadow-sm`}>
                  {m.type === 'video' ? (
                    <video src={m.url} controls playsInline muted loop className="w-full h-auto block" />
                  ) : (
                    <img src={m.url} alt={`${project.title} ${i + 1}`} loading={i === 0 ? 'eager' : 'lazy'} className="w-full h-auto block" />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* CTA finale */}
          <div className={`mt-16 md:mt-24 pt-10 border-t ${cBorder} flex flex-col md:flex-row items-center justify-between gap-6`}>
            <p className={`text-xl md:text-2xl font-semibold tracking-tight text-center md:text-left`}>Ti piace questo lavoro?</p>
            <button onClick={() => navigate('/#contact')} className={`px-8 py-4 rounded-full ${isDark ? 'bg-white text-black' : 'bg-[#1d1d1f] text-white'} font-semibold tracking-tight active:scale-95 hover:scale-105 transition-all`}>
              Parliamone
            </button>
          </div>
        </article>
      )}
    </div>
  )
}
