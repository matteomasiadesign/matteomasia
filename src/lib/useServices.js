import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

// Servizi mostrati se Supabase non è configurato o la tabella "servizi" è vuota.
// Appena popoli la tabella dall'admin, questi spariscono.
export const FALLBACK_SERVICES = [
  {
    id: 's2', title: 'Grafica digitale',
    description: 'Asset 2D e 3D per social media, campagne adv digitali e contenuti multimediali ottimizzati per la conversione.',
    img: null, cta_label: 'Vedi progetti', cta_link: '/progetti',
  },
  {
    id: 's1', title: 'Grafica per la stampa',
    description: 'Campagne pubblicitarie offline, brand collateral, cataloghi e riviste, banner ed espositori fieristici.',
    img: null, cta_label: 'Vedi progetti', cta_link: '/progetti',
  },
  {
    id: 's3', title: 'Branding & Identità visiva',
    description: 'Naming, logo design, palette cromatiche, mockup applicativi e strategia di posizionamento.',
    img: null, cta_label: 'Vedi progetti', cta_link: '/progetti',
  },
  {
    id: 's4', title: 'Web design & UI/UX',
    description: 'Interfacce interattive lead-oriented, studiate per massimizzare le conversioni e garantire una navigazione fluida.',
    img: null, cta_label: 'Vedi progetti', cta_link: '/progetti',
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
