import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './lib/ThemeContext.jsx'
import Home from './pages/Home.jsx'
import './index.css'

// Home resta nel bundle principale (è la pagina di atterraggio); le altre
// route vengono scaricate solo quando servono, cosi' i visitatori della
// home non pagano il peso dell'Admin (drag&drop incluso) o delle altre pagine.
const Progetti = lazy(() => import('./pages/Progetti.jsx'))
const ProgettoDettaglio = lazy(() => import('./pages/ProgettoDettaglio.jsx'))
const Admin = lazy(() => import('./pages/Admin.jsx'))

// Sfondo di attesa coerente col tema salvato, per evitare un flash bianco
// mentre il chunk della route richiesta viene scaricato.
const initialBg = localStorage.getItem('theme') === 'silver' ? '#f5f5f7' : '#000'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
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
