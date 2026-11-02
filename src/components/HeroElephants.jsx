import React from 'react'
import SmokeVideo from './SmokeVideo.jsx'

// --- ELEFANTI DI DALÍ, FATTI DI FUMO ---
// Il video di tools/elephants/ (vedi SmokeVideo). Attorno al nome il video si
// attenua con una maschera: dietro i puntini neri gli elefanti restano appena
// visibili, come dietro una nebbia.

// Ellisse centrata sul titolo: velo leggero sopra le lettere, poi il velo cala
// con una curva che parte e arriva piano (smoothstep), così non si vede dove finisce
const titleMask = (host, r) => {
  const title = host.querySelector('h1')
  if (!title) return undefined
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
  return `radial-gradient(${rx}px ${ry}px at ${cx}px ${cy}px, ${stops.join(', ')})`
}

export default function HeroElephants() {
  return <SmokeVideo name="elephants" getMask={titleMask} />
}
