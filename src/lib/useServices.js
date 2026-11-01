import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

// Servizi mostrati se Supabase non è configurato o la tabella "servizi" è vuota.
// Appena popoli la tabella dall'admin, questi spariscono.
export const FALLBACK_SERVICES = [
  {
    id: 's1',
    title: 'Brand Identity & Strategy',
    description: 'Identità di marca costruite partendo dal posizionamento: logo, sistema visivo e linee guida. Un linguaggio riconoscibile che funziona allo stesso modo sul web, sui social e sulla carta.',
    img: null,
    cta_label: 'Esplora progetti',
    cta_link: '/progetti',
    display_order: 0,
  },
  {
    id: 's2',
    title: 'Web Design & Development',
    description: 'Siti e landing page progettati e sviluppati su misura: veloci, curati nei dettagli e pensati per portare contatti. Dal design dell’interfaccia al codice, senza passaggi di mano.',
    img: null,
    cta_label: 'Esplora progetti',
    cta_link: '/progetti',
    display_order: 1,
  },
  {
    id: 's3',
    title: 'Content & Communication',
    description: 'Contenuti e campagne per i canali digitali di un business, un progetto o un evento. Un piano chiaro e uno stile coerente su ogni piattaforma, dal primo post al lancio.',
    img: null,
    cta_label: 'Esplora progetti',
    cta_link: '/progetti',
    display_order: 2,
  },
  {
    id: 's4',
    title: 'Photo & Video Production',
    description: 'Fotografia e video dallo shooting alla post-produzione: riprese, montaggio, reel e color grading. Quando il progetto lo chiede, anche visual 3D e motion graphics.',
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
