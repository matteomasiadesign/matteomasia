# Portfolio — Matteo Masia

Landing page (Apple-style) + galleria progetti dinamica + pannello admin, costruita con Vite + React + Tailwind + Supabase, pronta per il deploy su Vercel.

## Struttura

```
portfolio/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── vercel.json              ← rewrite per il routing SPA (necessario per /progetti e /admin)
├── .env.example
├── supabase-setup.sql       ← schema DB + RLS + storage (eseguilo su Supabase)
└── src/
    ├── main.jsx             ← router (/, /progetti, /admin)
    ├── index.css
    ├── lib/
    │   ├── supabase.js      ← client (null se le env mancano → fallback)
    │   ├── ThemeContext.jsx ← tema dark/light condiviso tra le pagine
    │   ├── tokens.js        ← colori centralizzati
    │   └── useProjects.js   ← legge i progetti da Supabase
    └── pages/
        ├── Home.jsx         ← landing
        ├── Progetti.jsx     ← galleria completa (/progetti)
        └── Admin.jsx        ← gestionale (/admin)
```

## 1. Avvio in locale

```bash
npm install
npm run dev
```

Il sito funziona da subito anche **senza** Supabase: mostra 4 progetti di esempio.

## 2. Configurazione Supabase

1. Crea un progetto su [supabase.com](https://supabase.com).
2. Apri **SQL Editor** e incolla/esegui tutto `supabase-setup.sql`.
3. Vai su **Authentication → Users → Add user** e crea il tuo account admin (email + password). Userai queste credenziali su `/admin`.
4. Copia URL e anon key da **Project Settings → API**.

Crea un file `.env.local` (NON va su GitHub, è già in `.gitignore`):

```
VITE_SUPABASE_URL=https://tuo-progetto.supabase.co
VITE_SUPABASE_ANON_KEY=la-tua-anon-key
```

> ⚠️ Con Vite il prefisso è **`VITE_`** (non `REACT_APP_`). Si accede con `import.meta.env.VITE_...`.

## 3. Deploy su Vercel

1. Push del repo su GitHub.
2. Su Vercel: **Add New → Project → Import** del repo.
3. Vercel rileva Vite in automatico:
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. In **Settings → Environment Variables** aggiungi le stesse due variabili (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
5. Deploy. Da ora ogni push su GitHub ridistribuisce in automatico.

Il file `vercel.json` reindirizza tutte le rotte a `index.html`: senza di esso, aprire direttamente `/progetti` o `/admin` darebbe 404.

## Pagine

- `/` — landing con carosello (primi 4 progetti).
- `/progetti` — griglia con tutti i progetti dal database.
- `/admin` — login + creazione/modifica/eliminazione progetti, con upload immagini compresso su Supabase Storage.

## Sicurezza

- La **anon key** è pubblica per design: è protetta dalle policy RLS.
- Lettura progetti: pubblica. Scrittura: solo utenti autenticati.
- Per limitare a un solo admin, nella policy "Scrittura admin progetti" sostituisci `true` con `auth.uid() = 'tuo-uuid'::uuid` (trovi l'UUID in Authentication → Users).

## Nota sul form di contatto

Il form nella home è attualmente solo visivo (simula l'invio). Per riceverlo davvero puoi collegarlo a una serverless function Vercel, a un servizio come Formspree, o salvare i messaggi in una tabella Supabase.
