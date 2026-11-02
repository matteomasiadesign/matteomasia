import React, { useEffect, useRef, useState } from 'react'

// --- VIDEO DI FUMO SUL ROSSO ---
// Un video in loop già renderizzato (le scene 3D sono in tools/): costa come un
// video qualsiasi su ogni dispositivo. È in scala di grigi su bianco e sta in
// "multiply" sopra il rosso: il bianco sparisce e il fumo diventa rosso scuro
// sul rosso. Formato orizzontale o verticale a seconda del contenitore.
// Lo usano gli elefanti della hero, gli uccelli dei servizi e il corvo del footer.
//
// getMask (facoltativa) riceve il contenitore e la sua posizione a ogni
// ridimensionamento, e restituisce una maschera CSS per attenuare il video.
// portraitBelow: sotto queste proporzioni (larghezza / altezza) si usa il
// formato verticale; il corvo sta in una striscia, quindi la soglia è più alta.
//
// Con "Riduci movimento" o "Risparmio dati" resta il primo fotogramma, fermo.
// Fuori schermo il video va in pausa.

export default function SmokeVideo({ name, getMask, portraitBelow = 0.9, className = '' }) {
  const videoRef = useRef(null)
  const [variant, setVariant] = useState(null)
  const [mask, setMask] = useState(undefined)
  const src = `/video/${name}-`

  // Orizzontale o verticale, secondo le proporzioni del contenitore
  useEffect(() => {
    const host = videoRef.current?.parentElement
    if (!host) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setVariant(width / Math.max(height, 1) < portraitBelow ? 'portrait' : 'landscape')
      if (getMask) setMask(getMask(host, host.getBoundingClientRect()))
    })
    ro.observe(host)
    return () => ro.disconnect()
  }, [getMask, portraitBelow])

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
    // Il video (circa 1 MB) si scarica solo a pagina caricata: fino ad allora resta
    // il primo fotogramma, identico all'inizio del video. Poi gira solo mentre è visibile
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
      poster={variant ? `${src}${variant}.jpg` : undefined}
      style={{ maskImage: mask, WebkitMaskImage: mask }}
      className={`absolute inset-0 w-full h-full object-cover pointer-events-none mix-blend-multiply ${className}`}
    >
      {/* Codec dichiarati: Safari che non decodifica il VP9 salta al MP4 invece di fermarsi */}
      {variant && <source src={`${src}${variant}.webm`} type='video/webm; codecs="vp9"' />}
      {variant && <source src={`${src}${variant}.mp4`} type='video/mp4; codecs="avc1.640032"' />}
    </video>
  )
}
