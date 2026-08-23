import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

// Servizi mostrati se Supabase non è configurato o la tabella "servizi" è vuota.
// Appena popoli la tabella dall'admin, questi spariscono.
export const FALLBACK_SERVICES = [
  {
    id: 's1',
    title: 'Brand Strategy & Visual Identity',
    description: 'Sistemi di identità visiva solidi e scalabili. Dal posizionamento strategico alla progettazione dell’intero linguaggio di marca, coordinato tra supporti digitali e fisici.',
    img: null,
    cta_label: 'Esplora progetti',
    cta_link: '/progetti',
    display_order: 0,
  },
  {
    id: 's2',
    title: 'Digital Product & Web Engineering',
    description: 'Progettazione e sviluppo di interfacce web moderne, veloci e orientate alla conversione. Esperienze digitali su misura che uniscono cura estetica, usabilità e rigore tecnico.',
    img: null,
    cta_label: 'Esplora progetti',
    cta_link: '/progetti',
    display_order: 1,
  },
  {
    id: 's3',
    title: '3D Design & Motion Graphics',
    description: 'Visual e animazioni tridimensionali progettati per catturare l’attenzione e valorizzare prodotti o concetti complessi con un forte impatto scenico ed emotivo.',
    img: null,
    cta_label: 'Esplora progetti',
    cta_link: '/progetti',
    display_order: 2,
  },
  {
    id: 's4',
    title: 'Art Direction & Visual Production',
    description: 'Regia visiva e produzione multimediale end-to-end. Dalla fotografia alla post-produzione audio-video, curando la coerenza di ogni singolo touchpoint.',
    img: null,
    cta_label: 'Esplora progetti',
    cta_link: '/progetti',
    display_order: 3,
  },
]

export function useServices() {
  const [services, setServices] = useState(FALLBACK_SERVICES)
  const [loading, setLoading] = useState(true)
  const [usingFallback, setUsingFallback] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    if (!supabase) {
      setUsingFallback(true)
      setLoading(false)
      return
    }
    const { data, error } = await supabase
      .from('servizi')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (!error && data && data.length > 0) {
      setServices(data)
      setUsingFallback(false)
    } else {
      setUsingFallback(true)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { services, loading, usingFallback, reload: load }
}
