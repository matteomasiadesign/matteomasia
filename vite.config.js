import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

// Indirizzo pubblico del sito: un solo punto da cambiare. Finisce in canonical
// e Open Graph (index.html) e in robots.txt / sitemap.xml (al posto di
// TUO-DOMINIO). Si può anche passare da fuori: SITE_URL=https://... npm run build
// TODO: mettere il dominio vero quando c'è
const SITE_URL = (process.env.SITE_URL || 'https://TUO-DOMINIO.vercel.app').replace(/\/$/, '')

const siteUrl = () => ({
  name: 'site-url',
  // 'pre': prima che Vite legga gli href (con il segnaposto non sarebbero URL validi)
  transformIndexHtml: { order: 'pre', handler: (html) => html.replaceAll('%SITE_URL%', SITE_URL) },
  closeBundle() {
    for (const f of ['robots.txt', 'sitemap.xml']) {
      const p = resolve('dist', f)
      if (existsSync(p)) writeFileSync(p, readFileSync(p, 'utf8').replaceAll('https://TUO-DOMINIO.vercel.app', SITE_URL))
    }
  },
})

export default defineConfig({
  plugins: [react(), siteUrl()],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
