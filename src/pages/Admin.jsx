import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Sun, Moon, Plus, Pencil, Trash2, LogOut, X, Save, Upload, Loader2, AlertTriangle, Star, Film } from 'lucide-react'
import { useTheme } from '../lib/ThemeContext.jsx'
import { getTokens, inputClass } from '../lib/tokens.js'
import { supabase, isSupabaseReady } from '../lib/supabase.js'
import { uploadMediaFile, deleteMediaPaths, pathFromUrl, slugify, ensureUniqueSlug, MAX_VIDEO_MB } from '../lib/media.js'

const CATEGORIES = ['Branding', 'Web Design', 'Print', 'Art Direction', 'UI/UX', 'Fotografia', '3D']

const EMPTY_FORM = {
  id: null,
  title: '',
  category: 'Branding',
  instagram_url: '',
  description: '',
  display_order: 0,
  media: [],   // [{ url, path, type }]
  cover: '',   // url della copertina (un'immagine fra i media)
}

export default function Admin() {
  const { toggleTheme, isDark } = useTheme()
  const navigate = useNavigate()
  const t = getTokens(isDark)
  const { cBgMain, cBgSec, cTextMain, cTextMuted, cBorder, cCard, cBtnBgPrimary, cGlass } = t
  const inp = inputClass(isDark)

  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [projects, setProjects] = useState([])
  const [listLoading, setListLoading] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  // Path da ripulire: caricati ora ma non ancora salvati (cleanup se annulli),
  // e media esistenti rimossi (cleanup al salvataggio).
  const [pendingPaths, setPendingPaths] = useState([])
  const [removedPaths, setRemovedPaths] = useState([])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)

  // --- AUTH ---
  useEffect(() => {
    if (!isSupabaseReady) {
      setAuthLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const loadProjects = useCallback(async () => {
    if (!isSupabaseReady) return
    setListLoading(true)
    const { data, error } = await supabase
      .from('progetti')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setProjects(data || [])
    setListLoading(false)
  }, [])

  useEffect(() => {
    if (session) loadProjects()
  }, [session, loadProjects])

  const handleLogin = async (e) => {
    e.preventDefault()
    setError(null)
    setLoggingIn(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoggingIn(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setProjects([])
  }

  // --- FORM OPEN/CLOSE ---
  const openNew = () => {
    setForm({ ...EMPTY_FORM, display_order: projects.length })
    setPendingPaths([])
    setRemovedPaths([])
    setError(null)
    setShowForm(true)
  }

  const openEdit = (p) => {
    const media = Array.isArray(p.media) && p.media.length
      ? p.media
      : p.img
        ? [{ url: p.img, path: pathFromUrl(p.img), type: 'image' }]
        : []
    setForm({
      id: p.id,
      title: p.title || '',
      category: p.category || 'Branding',
      instagram_url: p.instagram_url || '',
      description: p.description || '',
      display_order: p.display_order ?? 0,
      media,
      cover: p.img || (media.find((m) => m.type === 'image')?.url ?? ''),
    })
    setPendingPaths([])
    setRemovedPaths([])
    setError(null)
    setShowForm(true)
  }

  const closeForm = async () => {
    // I file caricati in questa sessione ma non salvati vanno rimossi dallo Storage
    if (pendingPaths.length) await deleteMediaPaths(pendingPaths)
    setPendingPaths([])
    setRemovedPaths([])
    setForm(EMPTY_FORM)
    setShowForm(false)
  }

  // --- MEDIA ---
  const handleUpload = async (files) => {
    if (!files || !files.length) return
    setError(null)
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const item = await uploadMediaFile(file)
        setPendingPaths((p) => [...p, item.path])
        setForm((f) => {
          const media = [...f.media, item]
          // se non c'è ancora una copertina e questa è un'immagine, impostala
          const cover = f.cover || (item.type === 'image' ? item.url : f.cover)
          return { ...f, media, cover }
        })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const removeMedia = (item) => {
    setForm((f) => {
      const media = f.media.filter((m) => m.url !== item.url)
      let cover = f.cover
      if (f.cover === item.url) {
        cover = media.find((m) => m.type === 'image')?.url || ''
      }
      return { ...f, media, cover }
    })
    if (item.path) {
      if (pendingPaths.includes(item.path)) {
        // caricato ora e non salvato: elimina subito
        deleteMediaPaths([item.path])
        setPendingPaths((p) => p.filter((x) => x !== item.path))
      } else {
        // già salvato: elimina al salvataggio
        setRemovedPaths((p) => [...p, item.path])
      }
    }
  }

  const setCover = (item) => {
    if (item.type !== 'image') return
    setForm((f) => ({ ...f, cover: item.url }))
  }

  // --- SAVE ---
  const handleSave = async (e) => {
    e.preventDefault()
    setError(null)
    if (!form.title.trim()) {
      setError('Il titolo è obbligatorio.')
      return
    }
    setSaving(true)
    try {
      const slug = await ensureUniqueSlug(slugify(form.title), form.id)
      const cover = form.cover || form.media.find((m) => m.type === 'image')?.url || null
      const payload = {
        title: form.title.trim(),
        category: form.category,
        slug,
        img: cover,
        instagram_url: form.instagram_url.trim() || null,
        description: form.description.trim() || null,
        display_order: Number(form.display_order) || 0,
        media: form.media,
      }

      let res
      if (form.id) res = await supabase.from('progetti').update(payload).eq('id', form.id)
      else res = await supabase.from('progetti').insert(payload)
      if (res.error) throw new Error(res.error.message)

      // ora che è salvato, rimuovi dallo Storage i media tolti
      if (removedPaths.length) await deleteMediaPaths(removedPaths)

      setPendingPaths([])
      setRemovedPaths([])
      setForm(EMPTY_FORM)
      setShowForm(false)
      loadProjects()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // --- DELETE (con pulizia di TUTTI i media del progetto) ---
  const handleDelete = async (p) => {
    if (!window.confirm(`Eliminare "${p.title}"? L'azione è definitiva.`)) return
    setError(null)
    const paths = new Set()
    if (Array.isArray(p.media)) p.media.forEach((m) => m.path && paths.add(m.path))
    const coverPath = pathFromUrl(p.img)
    if (coverPath) paths.add(coverPath)
    if (paths.size) await deleteMediaPaths([...paths])

    const { error } = await supabase.from('progetti').delete().eq('id', p.id)
    if (error) setError(error.message)
    else loadProjects()
  }

  // --- RENDER: Supabase non configurato ---
  if (!isSupabaseReady) {
    return (
      <Shell isDark={isDark} t={t} navigate={navigate} toggleTheme={toggleTheme} title="Admin">
        <div className={`max-w-md mx-auto mt-20 p-8 rounded-3xl ${cCard} border ${cBorder} text-center`}>
          <AlertTriangle size={40} className="mx-auto mb-4 text-amber-500" />
          <h2 className={`text-xl font-semibold mb-2 ${cTextMain}`}>Supabase non configurato</h2>
          <p className={`text-sm ${cTextMuted}`}>
            Imposta <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> nelle Environment Variables.
          </p>
        </div>
      </Shell>
    )
  }

  if (authLoading) {
    return (
      <Shell isDark={isDark} t={t} navigate={navigate} toggleTheme={toggleTheme} title="Admin">
        <div className="flex justify-center mt-24"><Loader2 size={28} className={`animate-spin ${cTextMuted}`} /></div>
      </Shell>
    )
  }

  // --- RENDER: Login ---
  if (!session) {
    return (
      <Shell isDark={isDark} t={t} navigate={navigate} toggleTheme={toggleTheme} title="Admin">
        <form onSubmit={handleLogin} className={`max-w-sm mx-auto mt-20 p-8 rounded-3xl ${cCard} border ${cBorder} flex flex-col gap-4`}>
          <h2 className={`text-2xl font-semibold ${cTextMain} mb-2`}>Accesso</h2>
          <input type="email" placeholder="Email" value={email} required onChange={(e) => setEmail(e.target.value)} className={inp} />
          <input type="password" placeholder="Password" value={password} required onChange={(e) => setPassword(e.target.value)} className={inp} />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button type="submit" disabled={loggingIn} className={`mt-2 py-3 rounded-xl ${cBtnBgPrimary} font-semibold active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2`}>
            {loggingIn ? <Loader2 size={18} className="animate-spin" /> : 'Entra'}
          </button>
        </form>
      </Shell>
    )
  }

  // --- RENDER: Dashboard ---
  return (
    <Shell isDark={isDark} t={t} navigate={navigate} toggleTheme={toggleTheme} title="Admin" onLogout={handleLogout}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className={`text-3xl md:text-4xl font-semibold tracking-tight ${cTextMain}`}>Progetti</h1>
          <p className={`${cTextMuted} text-sm mt-1`}>{projects.length} elementi</p>
        </div>
        <button onClick={openNew} className={`flex items-center gap-2 px-5 py-3 rounded-full ${cBtnBgPrimary} font-semibold active:scale-95 transition-all`}>
          <Plus size={18} /> Nuovo
        </button>
      </div>

      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      {listLoading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className={`animate-spin ${cTextMuted}`} /></div>
      ) : projects.length === 0 ? (
        <div className={`text-center py-16 ${cTextMuted}`}>
          <p className="font-medium">Nessun progetto.</p>
          <p className="text-sm">Premi “Nuovo” per aggiungere il primo.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {projects.map((p) => {
            const count = Array.isArray(p.media) ? p.media.length : (p.img ? 1 : 0)
            return (
              <div key={p.id} className={`flex items-center gap-4 p-3 rounded-2xl ${cCard} border ${cBorder}`}>
                <div className={`w-16 h-16 rounded-xl overflow-hidden ${cBgSec} shrink-0 border ${cBorder}`}>
                  {p.img ? <img src={p.img} alt={p.title} className="w-full h-full object-cover" /> : null}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={`font-semibold truncate ${cTextMain}`}>{p.title}</h3>
                  <p className={`text-sm ${cTextMuted} truncate`}>{p.category} · {count} media · ordine {p.display_order}</p>
                </div>
                <button onClick={() => openEdit(p)} className={`p-2.5 rounded-full ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'} ${cTextMain} transition-colors active:scale-90`}>
                  <Pencil size={18} />
                </button>
                <button onClick={() => handleDelete(p)} className="p-2.5 rounded-full hover:bg-red-500/10 text-red-500 transition-colors active:scale-90">
                  <Trash2 size={18} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* --- FORM MODALE --- */}
      {showForm && (
        <div className="fixed inset-0 z-[80] flex items-end md:items-center justify-center p-0 md:p-6">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeForm} />
          <form onSubmit={handleSave} className={`relative w-full md:max-w-lg ${cBgSec} rounded-t-3xl md:rounded-3xl p-6 md:p-8 border ${cBorder} max-h-[90vh] overflow-y-auto flex flex-col gap-4`}>
            <div className="flex items-center justify-between">
              <h2 className={`text-xl font-semibold ${cTextMain}`}>{form.id ? 'Modifica progetto' : 'Nuovo progetto'}</h2>
              <button type="button" onClick={closeForm} className={`p-2 rounded-full ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'} ${cTextMain}`}>
                <X size={20} />
              </button>
            </div>

            {/* MEDIA */}
            <div>
              <label className={`text-xs font-semibold uppercase tracking-wider ${cTextMuted} block mb-2`}>
                Media — foto, GIF o video (max {MAX_VIDEO_MB}MB l'uno)
              </label>

              {form.media.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {form.media.map((m) => {
                    const isCover = m.url === form.cover
                    return (
                      <div key={m.url} className={`relative aspect-square rounded-xl overflow-hidden border ${isCover ? 'border-green-500 ring-2 ring-green-500/30' : cBorder}`}>
                        {m.type === 'video' ? (
                          <>
                            <video src={m.url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                            <div className="absolute bottom-1 left-1 p-1 rounded-md bg-black/60"><Film size={12} className="text-white" /></div>
                          </>
                        ) : (
                          <img src={m.url} alt="" className="w-full h-full object-cover" />
                        )}

                        {/* azioni */}
                        <button type="button" onClick={() => removeMedia(m)} className="absolute top-1 right-1 p-1 rounded-md bg-black/60 text-white hover:bg-red-500 transition-colors">
                          <X size={12} />
                        </button>
                        {m.type === 'image' && !isCover && (
                          <button type="button" onClick={() => setCover(m)} title="Imposta come copertina" className="absolute top-1 left-1 p-1 rounded-md bg-black/60 text-white hover:bg-black/80 transition-colors">
                            <Star size={12} />
                          </button>
                        )}
                        {isCover && (
                          <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-green-500 text-white text-[9px] font-bold flex items-center gap-0.5">
                            <Star size={9} className="fill-white" /> COVER
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              <label className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed ${cBorder} ${cTextMuted} cursor-pointer ${isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'} transition-colors`}>
                {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                {uploading ? 'Caricamento...' : 'Carica file (puoi sceglierne più di uno)'}
                <input type="file" accept="image/*,video/*" multiple className="hidden" disabled={uploading} onChange={(e) => { handleUpload(e.target.files); e.target.value = '' }} />
              </label>
              <p className={`text-[11px] ${cTextMuted} mt-1.5`}>
                Le immagini vengono compresse in automatico. I video caricali già a 720p. Il pallino <Star size={10} className="inline" /> imposta la copertina.
              </p>
            </div>

            <Field label="Titolo *">
              <input type="text" value={form.title} required onChange={(e) => setForm({ ...form, title: e.target.value })} className={inp} />
            </Field>

            <Field label="Categoria">
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inp}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>

            <Field label="Link Instagram (opzionale)">
              <input type="url" placeholder="https://instagram.com/p/..." value={form.instagram_url} onChange={(e) => setForm({ ...form, instagram_url: e.target.value })} className={inp} />
            </Field>

            <Field label="Descrizione (opzionale)">
              <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${inp} resize-none`} />
            </Field>

            <Field label="Ordine di visualizzazione">
              <input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: e.target.value })} className={inp} />
            </Field>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button type="submit" disabled={saving || uploading} className={`mt-2 py-3 rounded-xl ${cBtnBgPrimary} font-semibold active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2`}>
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              {form.id ? 'Salva modifiche' : 'Crea progetto'}
            </button>
          </form>
        </div>
      )}
    </Shell>
  )
}

function Shell({ children, isDark, t, navigate, toggleTheme, title, onLogout }) {
  const { cBgMain, cTextMain, cTextMuted, cBorder, cGlass } = t
  return (
    <div className={`min-h-screen w-full ${cBgMain} ${cTextMain} font-sans`}>
      <header className={`sticky top-0 z-50 ${cGlass} backdrop-blur-xl border-b ${cBorder}`}>
        <div className="max-w-[820px] mx-auto px-6 py-4 flex items-center justify-between">
          <button onClick={() => navigate('/')} className={`group flex items-center gap-2 text-sm font-medium ${cTextMuted} ${isDark ? 'hover:text-white' : 'hover:text-black'} transition-colors active:scale-95`}>
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> Home
          </button>
          <div className="text-lg font-semibold tracking-tight">{title}</div>
          <div className="flex items-center gap-1">
            <button onClick={toggleTheme} className={`p-2 rounded-full ${isDark ? 'hover:bg-white/10 text-white' : 'hover:bg-black/10 text-black'} transition-colors active:scale-90`}>
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            {onLogout && (
              <button onClick={onLogout} className={`p-2 rounded-full ${isDark ? 'hover:bg-white/10 text-white' : 'hover:bg-black/10 text-black'} transition-colors active:scale-90`}>
                <LogOut size={20} />
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-[820px] mx-auto px-6 py-10 md:py-16">{children}</main>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wider text-[#86868b] block mb-2">{label}</label>
      {children}
    </div>
  )
}
