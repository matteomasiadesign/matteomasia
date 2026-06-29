import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Sun, Moon, Plus, Pencil, Trash2, LogOut, X, Save, Upload, Loader2,
  AlertTriangle, Star, Film, GripVertical, Inbox, FolderOpen, Mail, MailOpen, Reply,
} from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
  rectSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useTheme } from '../lib/ThemeContext.jsx'
import { getTokens, inputClass } from '../lib/tokens.js'
import { supabase, isSupabaseReady } from '../lib/supabase.js'
import { uploadMediaFile, deleteMediaPaths, pathFromUrl, slugify, ensureUniqueSlug, MAX_VIDEO_MB } from '../lib/media.js'

const CATEGORIES = ['Branding', 'Web Design', 'Print', 'Art Direction', 'UI/UX', 'Fotografia', '3D']

const EMPTY_FORM = {
  id: null, title: '', category: 'Branding', instagram_url: '',
  description: '', display_order: 0, media: [], cover: '',
}

export default function Admin() {
  const { toggleTheme, isDark } = useTheme()
  const navigate = useNavigate()
  const t = getTokens(isDark)
  const { cBgMain, cBgSec, cTextMain, cTextMuted, cBorder, cCard, cBtnBgPrimary } = t
  const inp = inputClass(isDark)

  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [view, setView] = useState('progetti')

  const [projects, setProjects] = useState([])
  const [listLoading, setListLoading] = useState(false)
  const [messages, setMessages] = useState([])
  const [msgLoading, setMsgLoading] = useState(false)

  const [form, setForm] = useState(EMPTY_FORM)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  const [pendingPaths, setPendingPaths] = useState([])
  const [removedPaths, setRemovedPaths] = useState([])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // --- AUTH ---
  useEffect(() => {
    if (!isSupabaseReady) { setAuthLoading(false); return }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthLoading(false) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const loadProjects = useCallback(async () => {
    if (!isSupabaseReady) return
    setListLoading(true)
    const { data, error } = await supabase.from('progetti').select('*')
      .order('display_order', { ascending: true }).order('created_at', { ascending: false })
    if (error) setError(error.message); else setProjects(data || [])
    setListLoading(false)
  }, [])

  const loadMessages = useCallback(async () => {
    if (!isSupabaseReady) return
    setMsgLoading(true)
    const { data, error } = await supabase.from('messaggi').select('*').order('created_at', { ascending: false })
    if (error) setError(error.message); else setMessages(data || [])
    setMsgLoading(false)
  }, [])

  useEffect(() => {
    if (session) { loadProjects(); loadMessages() }
  }, [session, loadProjects, loadMessages])

  const handleLogin = async (e) => {
    e.preventDefault(); setError(null); setLoggingIn(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoggingIn(false)
  }
  const handleLogout = async () => { await supabase.auth.signOut(); setProjects([]); setMessages([]) }

  // --- FORM ---
  const openNew = () => {
    setForm({ ...EMPTY_FORM, display_order: projects.length })
    setPendingPaths([]); setRemovedPaths([]); setError(null); setShowForm(true)
  }
  const openEdit = (p) => {
    const media = Array.isArray(p.media) && p.media.length ? p.media
      : p.img ? [{ url: p.img, path: pathFromUrl(p.img), type: 'image' }] : []
    setForm({
      id: p.id, title: p.title || '', category: p.category || 'Branding',
      instagram_url: p.instagram_url || '', description: p.description || '',
      display_order: p.display_order ?? 0, media,
      cover: p.img || (media.find((m) => m.type === 'image')?.url ?? ''),
    })
    setPendingPaths([]); setRemovedPaths([]); setError(null); setShowForm(true)
  }
  const closeForm = async () => {
    if (pendingPaths.length) await deleteMediaPaths(pendingPaths)
    setPendingPaths([]); setRemovedPaths([]); setForm(EMPTY_FORM); setShowForm(false)
  }

  // --- MEDIA ---
  const handleUpload = async (files) => {
    if (!files || !files.length) return
    setError(null); setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const item = await uploadMediaFile(file)
        setPendingPaths((p) => [...p, item.path])
        setForm((f) => {
          const media = [...f.media, item]
          const cover = f.cover || (item.type === 'image' ? item.url : f.cover)
          return { ...f, media, cover }
        })
      }
    } catch (err) { setError(err.message) } finally { setUploading(false) }
  }
  const removeMedia = (item) => {
    setForm((f) => {
      const media = f.media.filter((m) => m.url !== item.url)
      let cover = f.cover
      if (f.cover === item.url) cover = media.find((m) => m.type === 'image')?.url || ''
      return { ...f, media, cover }
    })
    if (item.path) {
      if (pendingPaths.includes(item.path)) {
        deleteMediaPaths([item.path]); setPendingPaths((p) => p.filter((x) => x !== item.path))
      } else { setRemovedPaths((p) => [...p, item.path]) }
    }
  }
  const setCover = (item) => { if (item.type === 'image') setForm((f) => ({ ...f, cover: item.url })) }

  const onMediaDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setForm((f) => {
      const oldIndex = f.media.findIndex((m) => m.url === active.id)
      const newIndex = f.media.findIndex((m) => m.url === over.id)
      return { ...f, media: arrayMove(f.media, oldIndex, newIndex) }
    })
  }

  // --- SAVE ---
  const handleSave = async (e) => {
    e.preventDefault(); setError(null)
    if (!form.title.trim()) { setError('Il titolo è obbligatorio.'); return }
    setSaving(true)
    try {
      const slug = await ensureUniqueSlug(slugify(form.title), form.id)
      const cover = form.cover || form.media.find((m) => m.type === 'image')?.url || null
      const payload = {
        title: form.title.trim(), category: form.category, slug, img: cover,
        instagram_url: form.instagram_url.trim() || null,
        description: form.description.trim() || null,
        display_order: Number(form.display_order) || 0, media: form.media,
      }
      let res
      if (form.id) res = await supabase.from('progetti').update(payload).eq('id', form.id)
      else res = await supabase.from('progetti').insert(payload)
      if (res.error) throw new Error(res.error.message)
      if (removedPaths.length) await deleteMediaPaths(removedPaths)
      setPendingPaths([]); setRemovedPaths([]); setForm(EMPTY_FORM); setShowForm(false); loadProjects()
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  // --- DELETE PROGETTO ---
  const handleDelete = async (p) => {
    if (!window.confirm(`Eliminare "${p.title}"? L'azione è definitiva.`)) return
    setError(null)
    const paths = new Set()
    if (Array.isArray(p.media)) p.media.forEach((m) => m.path && paths.add(m.path))
    const coverPath = pathFromUrl(p.img); if (coverPath) paths.add(coverPath)
    if (paths.size) await deleteMediaPaths([...paths])
    const { error } = await supabase.from('progetti').delete().eq('id', p.id)
    if (error) setError(error.message); else loadProjects()
  }

  // --- RIORDINO PROGETTI ---
  const onProjectsDragEnd = async (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = projects.findIndex((p) => p.id === active.id)
    const newIndex = projects.findIndex((p) => p.id === over.id)
    const reordered = arrayMove(projects, oldIndex, newIndex)
    setProjects(reordered) // ottimistico
    // persisti il nuovo display_order
    for (let i = 0; i < reordered.length; i++) {
      if (reordered[i].display_order !== i) {
        const { error } = await supabase.from('progetti').update({ display_order: i }).eq('id', reordered[i].id)
        if (error) { setError('Riordino non salvato: ' + error.message); loadProjects(); return }
      }
    }
  }

  // --- MESSAGGI ---
  const toggleRead = async (m) => {
    const { error } = await supabase.from('messaggi').update({ letto: !m.letto }).eq('id', m.id)
    if (!error) setMessages((arr) => arr.map((x) => (x.id === m.id ? { ...x, letto: !x.letto } : x)))
  }
  const deleteMessage = async (m) => {
    if (!window.confirm('Eliminare questo messaggio?')) return
    const { error } = await supabase.from('messaggi').delete().eq('id', m.id)
    if (!error) setMessages((arr) => arr.filter((x) => x.id !== m.id))
  }
  const unreadCount = messages.filter((m) => !m.letto).length

  // --- GUARDIE ---
  if (!isSupabaseReady) {
    return (
      <Shell {...{ isDark, t, navigate, toggleTheme }} title="Admin">
        <div className={`max-w-md mx-auto mt-20 p-8 rounded-3xl ${cCard} border ${cBorder} text-center`}>
          <AlertTriangle size={40} className="mx-auto mb-4 text-amber-500" />
          <h2 className={`text-xl font-semibold mb-2 ${cTextMain}`}>Supabase non configurato</h2>
          <p className={`text-sm ${cTextMuted}`}>Imposta <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code>.</p>
        </div>
      </Shell>
    )
  }
  if (authLoading) {
    return <Shell {...{ isDark, t, navigate, toggleTheme }} title="Admin"><div className="flex justify-center mt-24"><Loader2 size={28} className={`animate-spin ${cTextMuted}`} /></div></Shell>
  }
  if (!session) {
    return (
      <Shell {...{ isDark, t, navigate, toggleTheme }} title="Admin">
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

  // --- DASHBOARD ---
  return (
    <Shell {...{ isDark, t, navigate, toggleTheme }} title="Admin" onLogout={handleLogout}>
      {/* Switch vista */}
      <div className={`inline-flex p-1 rounded-full ${cCard} border ${cBorder} mb-8`}>
        <TabBtn active={view === 'progetti'} onClick={() => setView('progetti')} isDark={isDark}><FolderOpen size={16} /> Progetti</TabBtn>
        <TabBtn active={view === 'messaggi'} onClick={() => setView('messaggi')} isDark={isDark}>
          <Inbox size={16} /> Messaggi
          {unreadCount > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">{unreadCount}</span>}
        </TabBtn>
      </div>

      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      {view === 'progetti' ? (
        <>
          <div className="flex items-center justify-between mb-6">
            <p className={`${cTextMuted} text-sm`}>{projects.length} progetti · trascina <GripVertical size={13} className="inline" /> per riordinare</p>
            <button onClick={openNew} className={`flex items-center gap-2 px-5 py-3 rounded-full ${cBtnBgPrimary} font-semibold active:scale-95 transition-all`}>
              <Plus size={18} /> Nuovo
            </button>
          </div>

          {listLoading ? (
            <div className="flex justify-center py-16"><Loader2 size={24} className={`animate-spin ${cTextMuted}`} /></div>
          ) : projects.length === 0 ? (
            <div className={`text-center py-16 ${cTextMuted}`}><p className="font-medium">Nessun progetto.</p><p className="text-sm">Premi “Nuovo” per iniziare.</p></div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onProjectsDragEnd}>
              <SortableContext items={projects.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-3">
                  {projects.map((p) => (
                    <SortableProject key={p.id} id={p.id} p={p} t={t} isDark={isDark} onEdit={() => openEdit(p)} onDelete={() => handleDelete(p)} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </>
      ) : (
        <>
          <p className={`${cTextMuted} text-sm mb-6`}>{messages.length} messaggi · {unreadCount} da leggere</p>
          {msgLoading ? (
            <div className="flex justify-center py-16"><Loader2 size={24} className={`animate-spin ${cTextMuted}`} /></div>
          ) : messages.length === 0 ? (
            <div className={`text-center py-16 ${cTextMuted}`}><p className="font-medium">Nessun messaggio.</p><p className="text-sm">Le richieste dal form contatti appariranno qui.</p></div>
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((m) => (
                <div key={m.id} className={`p-4 rounded-2xl border ${cBorder} ${m.letto ? cCard : (isDark ? 'bg-white/[0.07]' : 'bg-black/[0.03]')}`}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {!m.letto && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
                        <h3 className={`font-semibold truncate ${cTextMain}`}>{m.nome}</h3>
                      </div>
                      <p className={`text-sm ${cTextMuted} truncate`}>{m.email}{m.oggetto ? ` · ${m.oggetto}` : ''}</p>
                    </div>
                    <span className={`text-xs ${cTextMuted} shrink-0`}>{new Date(m.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}</span>
                  </div>
                  <p className={`text-sm ${cTextMain} whitespace-pre-wrap mb-3`}>{m.messaggio}</p>
                  <div className="flex items-center gap-2">
                    <a href={`mailto:${m.email}?subject=${encodeURIComponent('Re: ' + (m.oggetto || 'la tua richiesta'))}`}
                      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-full ${cBtnBgPrimary} active:scale-95 transition-all`}>
                      <Reply size={13} /> Rispondi
                    </a>
                    <button onClick={() => toggleRead(m)} className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-full border ${cBorder} ${cTextMuted} ${isDark ? 'hover:text-white' : 'hover:text-black'} active:scale-95 transition-all`}>
                      {m.letto ? <><Mail size={13} /> Non letto</> : <><MailOpen size={13} /> Letto</>}
                    </button>
                    <button onClick={() => deleteMessage(m)} className="ml-auto p-2 rounded-full hover:bg-red-500/10 text-red-500 transition-colors active:scale-90">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* --- FORM MODALE PROGETTO --- */}
      {showForm && (
        <div className="fixed inset-0 z-[80] flex items-end md:items-center justify-center p-0 md:p-6">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeForm} />
          <form onSubmit={handleSave} className={`relative w-full md:max-w-lg ${cBgSec} rounded-t-3xl md:rounded-3xl p-6 md:p-8 border ${cBorder} max-h-[90vh] overflow-y-auto flex flex-col gap-4`}>
            <div className="flex items-center justify-between">
              <h2 className={`text-xl font-semibold ${cTextMain}`}>{form.id ? 'Modifica progetto' : 'Nuovo progetto'}</h2>
              <button type="button" onClick={closeForm} className={`p-2 rounded-full ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'} ${cTextMain}`}><X size={20} /></button>
            </div>

            {/* MEDIA */}
            <div>
              <label className={`text-xs font-semibold uppercase tracking-wider ${cTextMuted} block mb-2`}>
                Media — foto, GIF o video (max {MAX_VIDEO_MB}MB l'uno)
              </label>

              {form.media.length > 0 && (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onMediaDragEnd}>
                  <SortableContext items={form.media.map((m) => m.url)} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {form.media.map((m) => (
                        <SortableMedia key={m.url} m={m} isCover={m.url === form.cover} cBorder={cBorder}
                          onRemove={() => removeMedia(m)} onCover={() => setCover(m)} />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}

              <label className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed ${cBorder} ${cTextMuted} cursor-pointer ${isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'} transition-colors`}>
                {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                {uploading ? 'Caricamento...' : 'Carica file (anche più di uno)'}
                <input type="file" accept="image/*,video/*" multiple className="hidden" disabled={uploading} onChange={(e) => { handleUpload(e.target.files); e.target.value = '' }} />
              </label>
              <p className={`text-[11px] ${cTextMuted} mt-1.5`}>
                Immagini compresse in automatico, video già a 720p. Trascina per ordinare · <Star size={10} className="inline" /> imposta la copertina.
              </p>
            </div>

            <Field label="Titolo *"><input type="text" value={form.title} required onChange={(e) => setForm({ ...form, title: e.target.value })} className={inp} /></Field>
            <Field label="Categoria">
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inp}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Link Instagram (opzionale)"><input type="url" placeholder="https://instagram.com/p/..." value={form.instagram_url} onChange={(e) => setForm({ ...form, instagram_url: e.target.value })} className={inp} /></Field>
            <Field label="Descrizione (opzionale)"><textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${inp} resize-none`} /></Field>

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

// --- Riga progetto ordinabile ---
function SortableProject({ id, p, t, isDark, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const { cBgSec, cTextMain, cTextMuted, cBorder, cCard } = t
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  const count = Array.isArray(p.media) ? p.media.length : (p.img ? 1 : 0)
  return (
    <div ref={setNodeRef} style={style} className={`flex items-center gap-3 p-3 rounded-2xl ${cCard} border ${cBorder}`}>
      <button type="button" {...attributes} {...listeners} className={`p-1 rounded-md cursor-grab active:cursor-grabbing touch-none ${cTextMuted}`} aria-label="Trascina per riordinare">
        <GripVertical size={18} />
      </button>
      <div className={`w-14 h-14 rounded-xl overflow-hidden ${cBgSec} shrink-0 border ${cBorder}`}>
        {p.img ? <img src={p.img} alt={p.title} className="w-full h-full object-cover" /> : null}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className={`font-semibold truncate ${cTextMain}`}>{p.title}</h3>
        <p className={`text-sm ${cTextMuted} truncate`}>{p.category} · {count} media</p>
      </div>
      <button onClick={onEdit} className={`p-2.5 rounded-full ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'} ${cTextMain} transition-colors active:scale-90`}><Pencil size={18} /></button>
      <button onClick={onDelete} className="p-2.5 rounded-full hover:bg-red-500/10 text-red-500 transition-colors active:scale-90"><Trash2 size={18} /></button>
    </div>
  )
}

// --- Tile media ordinabile ---
function SortableMedia({ m, isCover, cBorder, onRemove, onCover }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: m.url })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  const stop = (e) => e.stopPropagation()
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}
      className={`relative aspect-square rounded-xl overflow-hidden border touch-none cursor-grab active:cursor-grabbing ${isCover ? 'border-green-500 ring-2 ring-green-500/30' : cBorder}`}>
      {m.type === 'video' ? (
        <>
          <video src={m.url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
          <div className="absolute bottom-1 left-1 p-1 rounded-md bg-black/60"><Film size={12} className="text-white" /></div>
        </>
      ) : (
        <img src={m.url} alt="" className="w-full h-full object-cover" />
      )}
      <button type="button" onPointerDown={stop} onClick={(e) => { stop(e); onRemove() }} className="absolute top-1 right-1 p-1 rounded-md bg-black/60 text-white hover:bg-red-500 transition-colors">
        <X size={12} />
      </button>
      {m.type === 'image' && !isCover && (
        <button type="button" onPointerDown={stop} onClick={(e) => { stop(e); onCover() }} title="Imposta come copertina" className="absolute top-1 left-1 p-1 rounded-md bg-black/60 text-white hover:bg-black/80 transition-colors">
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
}

function TabBtn({ active, onClick, isDark, children }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all active:scale-95 ${
      active ? (isDark ? 'bg-white text-black' : 'bg-black text-white') : (isDark ? 'text-white/60 hover:text-white' : 'text-black/50 hover:text-black')
    }`}>{children}</button>
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
            {onLogout && <button onClick={onLogout} className={`p-2 rounded-full ${isDark ? 'hover:bg-white/10 text-white' : 'hover:bg-black/10 text-black'} transition-colors active:scale-90`}><LogOut size={20} /></button>}
          </div>
        </div>
      </header>
      <main className="max-w-[820px] mx-auto px-6 py-10 md:py-16">{children}</main>
    </div>
  )
}

function Field({ label, children }) {
  return (<div><label className="text-xs font-semibold uppercase tracking-wider text-[#86868b] block mb-2">{label}</label>{children}</div>)
}
