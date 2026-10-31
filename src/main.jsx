import React, { Suspense, lazy, useLayoutEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { ThemeProvider } from './lib/ThemeContext.jsx'
import { startSmoothScroll, scrollToTarget } from './lib/smoothScroll.js'
import Home from './pages/Home.jsx'
import './index.css'

startSmoothScroll()

// Home resta nel bundle principale (è la pagina di atterraggio); le altre
// route vengono scaricate solo quando servono, cosi' i visitatori della
// home non pagano il peso dell'Admin (drag&drop incluso) o delle altre pagine.
const Progetti = lazy(() => import('./pages/Progetti.jsx'))
const ProgettoDettaglio = lazy(() => import('./pages/ProgettoDettaglio.jsx'))
const Admin = lazy(() => import('./pages/Admin.jsx'))

// Sfondo di attesa nero come il tema, per evitare un flash bianco
// mentre il chunk della route richiesta viene scaricato.
const initialBg = '#000'

// A ogni cambio di pagina si riparte dall'alto (con un #ancora ci pensa la pagina)
function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useLayoutEffect(() => {
    if (!hash) scrollToTarget(0, { immediate: true })
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Suspense fallback={<div style={{ minHeight: '100vh', background: initialBg }} />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/progetti" element={<Progetti />} />
            <Route path="/progetti/:slug" element={<ProgettoDettaglio />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>,
)
