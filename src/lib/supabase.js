import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// Se le variabili non sono configurate, supabase resta null:
// il sito funziona comunque mostrando i progetti di fallback.
export const supabase = url && key ? createClient(url, key) : null

export const isSupabaseReady = Boolean(supabase)
