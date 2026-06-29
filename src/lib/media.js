import { supabase } from './supabase'

export const STORAGE_BUCKET = 'progetti'
export const MAX_VIDEO_MB = 25
export const MAX_GIF_MB = 8

// Genera uno slug pulito da un titolo: "Logo Café 2024" -> "logo-cafe-2024"
export function slugify(str) {
  return (str || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Compressione immagini lato client: max 1600px, JPEG ~0.82
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

// Carica un singolo file e restituisce { url, path, type }.
// Immagini: compresse. GIF: intatte. Video: come sono, con limite di dimensione.
export async function uploadMediaFile(file) {
  const isGif = file.type === 'image/gif'
  const isVideo = file.type.startsWith('video/')
  const isImage = file.type.startsWith('image/')

  let blob = file
  let ext
  let type = 'image'
  let contentType = file.type

  if (isVideo) {
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      throw new Error(`Video troppo grande (max ${MAX_VIDEO_MB}MB). Esportalo a 720p e riprova.`)
    }
    type = 'video'
    ext = (file.name.split('.').pop() || 'mp4').toLowerCase()
    contentType = file.type || 'video/mp4'
  } else if (isGif) {
    if (file.size > MAX_GIF_MB * 1024 * 1024) {
      throw new Error(`GIF troppo grande (max ${MAX_GIF_MB}MB).`)
    }
    ext = 'gif'
    contentType = 'image/gif'
  } else if (isImage) {
    blob = await compressImage(file)
    ext = 'jpg'
    contentType = 'image/jpeg'
  } else {
    throw new Error('Formato non supportato. Usa immagini, GIF o video.')
  }

  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(fileName, blob, {
    contentType,
    cacheControl: '3600',
  })
  if (error) throw error
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(fileName)
  return { url: data.publicUrl, path: fileName, type }
}

// Elimina file dallo Storage dato un elenco di path.
export async function deleteMediaPaths(paths) {
  const clean = (paths || []).filter(Boolean)
  if (clean.length === 0) return
  await supabase.storage.from(STORAGE_BUCKET).remove(clean)
}

// Ricava il path Storage da un URL pubblico (per il cleanup di vecchi record).
export function pathFromUrl(url) {
  if (!url) return null
  const marker = `/${STORAGE_BUCKET}/`
  return url.includes(marker) ? url.split(marker)[1] : null
}

// Garantisce uno slug unico nel DB (aggiunge -2, -3... in caso di collisione).
export async function ensureUniqueSlug(base, currentId) {
  const root = base || 'progetto'
  let n = 1
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const candidate = n === 1 ? root : `${root}-${n}`
    const { data } = await supabase.from('progetti').select('id').eq('slug', candidate).limit(1)
    if (!data || data.length === 0 || (currentId && data[0].id === currentId)) return candidate
    n++
    if (n > 50) return `${root}-${Date.now().toString(36)}`
  }
}
