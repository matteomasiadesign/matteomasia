import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

// Progetti mostrati se Supabase non è ancora configurato o se la tabella è vuota.
// Appena popoli la tabella "progetti" dall'admin, questi spariscono.
export const FALLBACK_PROJECTS = [
  { id: 'f1', title: 'Materia', category: 'Branding', img: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop', instagram_url: null, description: null },
  { id: 'f2', title: 'Aura', category: 'Web Design', img: 'https://images.unsplash.com/photo-1604871000636-074fa5117945?q=80&w=2487&auto=format&fit=crop', instagram_url: null, description: null },
  { id: 'f3', title: 'Kroma', category: 'Print', img: 'https://images.unsplash.com/photo-1557672172-298e090bd0f1?q=80&w=2487&auto=format&fit=crop', instagram_url: null, description: null },
  { id: 'f4', title: 'Void', category: 'Art Direction', img: 'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?q=80&w=2670&auto=format&fit=crop', instagram_url: null, description: null },
]

export function useProjects() {
  const [projects, setProjects] = useState(FALLBACK_PROJECTS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [usingFallback, setUsingFallback] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    if (!supabase) {
      setUsingFallback(true)
      setLoading(false)
      return
    }
    const { data, error } = await supabase
      .from('progetti')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
      setUsingFallback(true)
    } else if (data && data.length > 0) {
      setProjects(data)
      setUsingFallback(false)
    } else {
      setUsingFallback(true)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { projects, loading, error, usingFallback, reload: load }
}
