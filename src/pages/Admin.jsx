import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Sun, Moon, Plus, Pencil, Trash2, LogOut, X, Save, Upload, Loader2, AlertTriangle } from 'lucide-react'
import { useTheme } from '../lib/ThemeContext.jsx'
import { getTokens } from '../lib/tokens.js'
import { supabase, isSupabaseReady } from '../lib/supabase.js'

const STORAGE_BUCKET = 'progetti'
const CATEGORIES = ['Branding', 'Web Design', 'Print', 'Art Direction', 'UI/UX', 'Fotografia', '3D']

const EMPTY_FORM = {
  id: null,
  title: '',
  category: 'Branding',
  img: '',
  instagram_url: '',
  description: '',
  display_order: 0,
}

// Compressione lato client: ridimensiona a max 1600px e converte in JPEG ~0.82
function compressImage(file, maxSize = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > height && width > maxSize) {
          height = Math.round((height * maxSize) / width)
          width = maxSize
        } else if (height > maxSize) {
          width = Math.round((width * maxSize) / height)
          height = maxSize
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Compressione fallita'))), 'image/jpeg', quality)
      }
      img.onerror = reject
      img.src = e.target.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function Admin() {
  const { toggleTheme, isDark } = useTheme()
  const navigate = useNavigate()
  const t = getTokens(isDark)
  const { cBgMain, cBgSec, cTextMain, cTextMuted, cBorder, cCard, cBtnBgPrimary, cGlass } = t

  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [projects, setProjects] = useState([])
  const [listLoading, setListLoading] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  // login fields
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

  // --- CRUD ---
  const openNew = () => {
    setForm({ ...EMPTY_FORM, display_order: projects.length })
    setError(null)
    setShowForm(true)
  }

  const openEdit = (p) => {
    setForm({
      id: p.id,
      title: p.title || '',
      category: p.category || 'Branding',
      img: p.img || '',
      instagram_url: p.instagram_url || '',
      description: p.description || '',
      display_order: p.display_order ?? 0,
    })
    setError(null)
    setShowForm(true)
  }

  const handleUpload = async (file) => {
    if (!file) return
    setError(null)
    setUploading(true)
    try {
      const blob = await compressImage(file)
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
      const { error: upErr } = await supabase.storage.from(STORAGE_BUCKET).upload(fileName, blob, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
      })
      if (upErr) throw upErr
      const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(fileName)
      setForm((f) => ({ ...f, img: data.publicUrl }))
    } catch (err) {
      setError('Upload fallito: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setError(null)
    if (!form.title.trim()) {
      setError('Il titolo è obbligatorio.')
      return
    }
    setSaving(true)
    const payload = {
      title: form.title.trim(),
      category: form.category,
      img: form.img.trim() || null,
      instagram_url: form.instagram_url.trim() || null,
      description: form.description.trim() || null,
      display_order: Number(form.display_order) || 0,
    }
    let res
    if (form.id) {
      res = await supabase.from('progetti').update(payload).eq('id', form.id)
    } else {
      res = await supabase.from('progetti').insert(payload)
    }
    if (res.error) {
      setError(res.error.message)
    } else {
      setShowForm(false)
      setForm(EMPTY_FORM)
      loadProjects()
    }
    setSaving(false)
  }

  const handleDelete = async (p) => {
    if (!window.confirm(`Eliminare "${p.title}"? L'azione è definitiva.`)) return
    setError(null)
    // Pulizia Storage se l'immagine è ospitata nel bucket
    if (p.img && p.img.includes(`/${STORAGE_BUCKET}/`)) {
      const path = p.img.split(`/${STORAGE_BUCKET}/`)[1]
      if (path) await supabase.storage.from(STORAGE_BUCKET).remove([path])
    }
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
            Imposta <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> nel file <code>.env.local</code> (in locale) e nelle Environment Variables di Vercel.
          </p>
        </div>
      </Shell>
    )
  }

  // --- RENDER: Loading auth ---
  if (authLoading) {
    return (
      <Shell isDark={isDark} t={t} navigate={navigate} toggleTheme={toggleTheme} title="Admin">
        <div className="flex justify-center mt-24">
          <Loader2 size={28} className={`animate-spin ${cTextMuted}`} />
        </div>
      </Shell>
    )
  }

  // --- RENDER: Login ---
  if (!session) {
    return (
      <Shell isDark={isDark} t={t} navigate={navigate} toggleTheme={toggleTheme} title="Admin">
        <form onSubmit={handleLogin} className={`max-w-sm mx-auto mt-20 p-8 rounded-3xl ${cCard} border ${cBorder} flex flex-col gap-4`}>
          <h2 className={`text-2xl font-semibold ${cTextMain} mb-2`}>Accesso</h2>
          <input
            type="email" placeholder="Email" value={email} required
            onChange={(e) => setEmail(e.target.value)}
            className={`px-4 py-3 rounded-xl border ${cBorder} ${cBgSec} ${cTextMain} outline-none focus:border-blue-500 transition-colors`}
          />
          <input
            type="password" placeholder="Password" value={password} required
            onChange={(e) => setPassword(e.target.value)}
            className={`px-4 py-3 rounded-xl border ${cBorder} ${cBgSec} ${cTextMain} outline-none focus:border-blue-500 transition-colors`}
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit" disabled={loggingIn}
            className={`mt-2 py-3 rounded-xl ${cBtnBgPrimary} font-semibold active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2`}
          >
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
        <button
          onClick={openNew}
          className={`flex items-center gap-2 px-5 py-3 rounded-full ${cBtnBgPrimary} font-semibold active:scale-95 transition-all`}
        >
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
          {projects.map((p) => (
            <div key={p.id} className={`flex items-center gap-4 p-3 rounded-2xl ${cCard} border ${cBorder}`}>
              <div className={`w-16 h-16 rounded-xl overflow-hidden ${cBgSec} shrink-0 border ${cBorder}`}>
                {p.img ? <img src={p.img} alt={p.title} className="w-full h-full object-cover" /> : null}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={`font-semibold truncate ${cTextMain}`}>{p.title}</h3>
                <p className={`text-sm ${cTextMuted} truncate`}>{p.category} · ordine {p.display_order}</p>
              </div>
              <button onClick={() => openEdit(p)} className={`p-2.5 rounded-full ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'} ${cTextMain} transition-colors active:scale-90`}>
                <Pencil size={18} />
              </button>
              <button onClick={() => handleDelete(p)} className="p-2.5 rounded-full hover:bg-red-500/10 text-red-500 transition-colors active:scale-90">
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* --- FORM MODALE --- */}
      {showForm && (
        <div className="fixed inset-0 z-[80] flex items-end md:items-center justify-center p-0 md:p-6">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <form
            onSubmit={handleSave}
            className={`relative w-full md:max-w-lg ${cBgSec} rounded-t-3xl md:rounded-3xl p-6 md:p-8 border ${cBorder} max-h-[90vh] overflow-y-auto flex flex-col gap-4`}
          >
            <div className="flex items-center justify-between">
              <h2 className={`text-xl font-semibold ${cTextMain}`}>{form.id ? 'Modifica progetto' : 'Nuovo progetto'}</h2>
              <button type="button" onClick={() => setShowForm(false)} className={`p-2 rounded-full ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'} ${cTextMain}`}>
                <X size={20} />
              </button>
            </div>

            {/* Immagine */}
            <div>
              <label className={`text-xs font-semibold uppercase tracking-wider ${cTextMuted} block mb-2`}>Immagine</label>
              {form.img && (
                <div className={`w-full aspect-video rounded-xl overflow-hidden mb-3 border ${cBorder}`}>
                  <img src={form.img} alt="preview" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <label className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed ${cBorder} ${cTextMuted} cursor-pointer ${isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'} transition-colors`}>
                  {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                  {uploading ? 'Caricamento...' : 'Carica immagine (compressa)'}
                  <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => handleUpload(e.target.files?.[0])} />
                </label>
                <input
                  type="url" placeholder="...oppure incolla un URL"
                  value={form.img} onChange={(e) => setForm({ ...form, img: e.target.value })}
                  className={`px-4 py-3 rounded-xl border ${cBorder} ${cBgMain} ${cTextMain} text-sm outline-none focus:border-blue-500`}
                />
              </div>
            </div>

            <Field label="Titolo *">
              <input type="text" value={form.title} required onChange={(e) => setForm({ ...form, title: e.target.value })}
                className={`w-full px-4 py-3 rounded-xl border ${cBorder} ${cBgMain} ${cTextMain} outline-none focus:border-blue-500`} />
            </Field>

            <Field label="Categoria">
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                className={`w-full px-4 py-3 rounded-xl border ${cBorder} ${cBgMain} ${cTextMain} outline-none focus:border-blue-500`}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>

            <Field label="Link Instagram (opzionale)">
              <input type="url" placeholder="https://instagram.com/p/..." value={form.instagram_url}
                onChange={(e) => setForm({ ...form, instagram_url: e.target.value })}
                className={`w-full px-4 py-3 rounded-xl border ${cBorder} ${cBgMain} ${cTextMain} outline-none focus:border-blue-500`} />
            </Field>

            <Field label="Descrizione (opzionale)">
              <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className={`w-full px-4 py-3 rounded-xl border ${cBorder} ${cBgMain} ${cTextMain} outline-none focus:border-blue-500 resize-none`} />
            </Field>

            <Field label="Ordine di visualizzazione">
              <input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: e.target.value })}
                className={`w-full px-4 py-3 rounded-xl border ${cBorder} ${cBgMain} ${cTextMain} outline-none focus:border-blue-500`} />
            </Field>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button type="submit" disabled={saving || uploading}
              className={`mt-2 py-3 rounded-xl ${cBtnBgPrimary} font-semibold active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2`}>
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              {form.id ? 'Salva modifiche' : 'Crea progetto'}
            </button>
          </form>
        </div>
      )}
    </Shell>
  )
}

// --- Layout condiviso ---
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
