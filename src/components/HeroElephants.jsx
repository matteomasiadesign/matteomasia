import React, { useEffect, useRef, useState } from 'react'

// --- ELEFANTI DI DALÍ, FATTI DI FUMO ---
// Un video in loop già renderizzato (la scena 3D è in tools/elephants/): costa
// come un video qualsiasi su ogni dispositivo. È in scala di grigi su bianco e
// sta in "multiply" sopra il fluido: il bianco sparisce e il fumo diventa rosso
// scuro sul rosso. Formato orizzontale o verticale a seconda della hero.
// Attorno al nome il video si attenua con una maschera: dietro i puntini neri
// gli elefanti restano appena visibili, come dietro una nebbia.
//
// Con "Riduci movimento" o "Risparmio dati" resta il primo fotogramma, fermo.
// Fuori schermo il video va in pausa.

const SRC = '/video/elephants-'

export default function HeroElephants() {
  const videoRef = useRef(null)
  const [variant, setVariant] = useState(null)
  const [mask, setMask] = useState(undefined)

  // Orizzontale o verticale, secondo le proporzioni della hero
  useEffect(() => {
    const host = videoRef.current?.parentElement
    if (!host) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setVariant(width / Math.max(height, 1) < 0.9 ? 'portrait' : 'landscape')
      // Ellisse centrata sul titolo: velo leggero sopra le lettere, poi
      // il velo cala con una curva che parte e arriva piano (smoothstep), così
      // non si vede dove finisce
      const title = host.querySelector('h1')
      if (!title) return
      const r = host.getBoundingClientRect()
      const t = title.getBoundingClientRect()
      const cx = t.left + t.width / 2 - r.left
      const cy = t.top + t.height / 2 - r.top
      const CLEAR = 25 // % dell'ellisse con il velo al massimo
      const FLOOR = 0.3 // quanto si vedono gli elefanti dietro le lettere
      const stops = Array.from({ length: 9 }, (_, i) => {
        const k = i / 8
        const a = FLOOR + (1 - FLOOR) * k * k * (3 - 2 * k)
        return `rgba(0,0,0,${a.toFixed(3)}) ${(CLEAR + (100 - CLEAR) * k).toFixed(1)}%`
      })
      // Su mobile il nome è basso (~40px): senza un minimo legato allo schermo
      // l'ellisse diventerebbe una striscia e l'alone sparirebbe
      const rx = t.width * 0.8
      const ry = Math.max(t.height * 1.7, r.height * 0.18)
      setMask(`radial-gradient(${rx}px ${ry}px at ${cx}px ${cy}px, ${stops.join(', ')})`)
    })
    ro.observe(host)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !variant) return
    const still =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches || navigator.connection?.saveData === true
    if (still) return
    // iOS fa partire da solo solo i video muti: React non scrive l'attributo
    // "muted" nell'HTML, quindi lo si mette a mano
    video.muted = true
    video.setAttribute('muted', '')
    // Il video (1 MB) si scarica solo a pagina caricata: fino ad allora resta il
    // primo fotogramma, identico all'inizio del video. Poi gira solo mentre la
    // hero è visibile
    let ready = false
    let visible = false
    const sync = () => {
      if (ready && visible) video.play().catch(() => {})
      else video.pause()
    }
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      sync()
    })
    io.observe(video)
    const onLoad = () => {
      ready = true
      sync()
    }
    if (document.readyState === 'complete') onLoad()
    else window.addEventListener('load', onLoad, { once: true })
    return () => {
      io.disconnect()
      window.removeEventListener('load', onLoad)
    }
  }, [variant])

  return (
    <video
      ref={videoRef}
      key={variant || 'none'}
      aria-hidden="true"
      tabIndex={-1}
      muted
      loop
      playsInline
      preload="none"
      disablePictureInPicture
      poster={variant ? `${SRC}${variant}.jpg` : undefined}
      style={{ maskImage: mask, WebkitMaskImage: mask }}
      className="absolute inset-0 w-full h-full object-cover pointer-events-none mix-blend-multiply"
    >
      {/* Codec dichiarati: Safari che non decodifica il VP9 salta al MP4 invece di fermarsi */}
      {variant && <source src={`${SRC}${variant}.webm`} type='video/webm; codecs="vp9"' />}
      {variant && <source src={`${SRC}${variant}.mp4`} type='video/mp4; codecs="avc1.640032"' />}
    </video>
  )
}
