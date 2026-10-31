import { createContext, useContext } from 'react'

// Il sito ha un solo tema, scuro. Il context resta perché tutte le pagine
// leggono `isDark` per scegliere i colori.
const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  return (
    <ThemeContext.Provider value={{ theme: 'dark', isDark: true }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme deve essere usato dentro <ThemeProvider>')
  return ctx
}
