import React, { useEffect, useRef, useState } from 'react'

// --- ELEFANTI DI DALÍ, FATTI DI FUMO ---
// Un video in loop già renderizzato (la scena 3D è in tools/elephants/): costa
// come un video qualsiasi su ogni dispositivo. È in scala di grigi su bianco e
// sta in "multiply" sopra il fluido: il bianco sparisce e il fumo diventa rosso
// scuro sul rosso. Formato orizzontale o verticale a seconda della hero.
//
// Con "Riduci movimento" o "Risparmio dati" resta il primo fotogramma, fermo.
// Fuori schermo il video va in pausa.

const SRC = '/video/elephants-'

export default function HeroElephants() {
  const videoRef = useRef(null)
  const [variant, setVariant] = useState(null)

  // Orizzontale o verticale, secondo le proporzioni della hero
  useEffect(() => {
    const host = videoRef.current?.parentElement
    if (!host) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setVariant(width / Math.max(height, 1) < 0.9 ? 'portrait' : 'landscape')
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
      className="absolute inset-0 w-full h-full object-cover pointer-events-none mix-blend-multiply"
    >
      {/* Codec dichiarati: Safari che non decodifica il VP9 salta al MP4 invece di fermarsi */}
      {variant && <source src={`${SRC}${variant}.webm`} type='video/webm; codecs="vp9"' />}
      {variant && <source src={`${SRC}${variant}.mp4`} type='video/mp4; codecs="avc1.640032"' />}
    </video>
  )
}
