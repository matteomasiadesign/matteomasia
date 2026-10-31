import React, { useEffect, useRef } from 'react'

// --- SFONDO DELLA HERO: ROSSO E NERO CHE RESPIRANO ---
// Macchie di nero che si muovono lente nel rosso come inchiostro nell'acqua:
// un rumore deformato più volte su se stesso (domain warping), calcolato da
// uno shader. Attorno al titolo resta rosso pieno, così il fumo nero si legge
// sempre; il nero vive sui bordi. Non reagisce al cursore: si muove da solo.
//
// Costa poco: la canvas è a un quarto della risoluzione (il fluido è sfocato,
// i pixel non si vedono), disegna a 30 fps, si ferma fuori schermo e resta
// immobile con "Riduci movimento". Senza WebGL resta il rosso pieno della hero.

const SCALE = 0.25 // risoluzione della canvas rispetto ai px CSS
const MAX_W = 520
const FRAME_MS = 1000 / 30

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`

const FRAG = `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uCenter;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.02 + vec2(17.0, 9.0);
    a *= 0.5;
  }
  return v;
}

void main() {
  float ar = uRes.x / uRes.y;
  vec2 p = vec2(vUv.x * ar, vUv.y);

  float t = uTime * 0.035;
  vec2 q = vec2(fbm(p * 1.1 + vec2(0.0, t)), fbm(p * 1.1 + vec2(5.2, -t * 0.8)));
  vec2 r = vec2(fbm(p * 1.3 + 3.2 * q + vec2(1.7, 9.2) + t * 0.6),
                fbm(p * 1.3 + 3.2 * q + vec2(8.3, 2.8) - t * 0.5));
  float f = fbm(p * 1.0 + 2.6 * r);

  // Attorno al titolo il nero non arriva
  vec2 c = vec2(uCenter.x * ar, uCenter.y);
  float away = smoothstep(0.14, 0.68, length((p - c) * vec2(0.75, 1.0)));

  vec3 red = vec3(1.0, 0.169, 0.11);
  vec3 deep = vec3(0.62, 0.06, 0.03);
  // Anche al centro il rosso respira appena, tra il rosso pieno e uno più cupo
  vec3 col = mix(red, deep, smoothstep(0.35, 0.75, f) * (0.18 + 0.5 * away));
  float ink = smoothstep(0.44, 0.74, f) * away;
  col = mix(col, vec3(0.0), ink * 0.94);
  gl_FragColor = vec4(col, 1.0);
}`

export default function HeroFluid() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const host = canvas?.parentElement
    if (!canvas || !host) return
    const gl = canvas.getContext('webgl', { antialias: false, depth: false, powerPreference: 'low-power' })
    if (!gl) return

    const compile = (type, src) => {
      const s = gl.createShader(type)
      gl.shaderSource(s, src)
      gl.compileShader(s)
      return s
    }
    const prog = gl.createProgram()
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(prog, 'aPos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)
    const u = (n) => gl.getUniformLocation(prog, n)
    const uRes = u('uRes')
    const uTime = u('uTime')
    const uCenter = u('uCenter')

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // Centro del titolo dentro la hero (0..1, y dal basso), letto dall'h1
    const center = [0.5, 0.58]
    const resize = () => {
      const r = host.getBoundingClientRect()
      const w = Math.min(Math.max(Math.round(r.width * SCALE), 2), MAX_W)
      const h = Math.max(Math.round(w * (r.height / Math.max(r.width, 1))), 2)
      canvas.width = w
      canvas.height = h
      gl.viewport(0, 0, w, h)
      gl.uniform2f(uRes, w, h)
      const title = host.querySelector('h1')
      if (title) {
        const t = title.getBoundingClientRect()
        center[0] = (t.left + t.width / 2 - r.left) / r.width
        center[1] = 1 - (t.top + t.height / 2 - r.top) / r.height
      }
      gl.uniform2f(uCenter, center[0], center[1])
    }

    let raf = 0
    let last = 0
    let time = 20000 * Math.random() // ogni visita parte da una forma diversa
    const draw = (now) => {
      raf = requestAnimationFrame(draw)
      const dt = now - last
      if (dt < FRAME_MS - 2) return
      last = now
      time += Math.min(dt, 100)
      gl.uniform1f(uTime, time / 1000)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }

    const ro = new ResizeObserver(() => {
      resize()
      if (reduce) {
        gl.uniform1f(uTime, time / 1000)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      }
    })
    ro.observe(host)
    resize()

    // Anima solo mentre la hero è visibile; fuori schermo si ferma anche la grana
    const io = new IntersectionObserver(([entry]) => {
      host.classList.toggle('hero-idle', !entry.isIntersecting)
      if (reduce) return
      if (entry.isIntersecting && !raf) {
        last = 0
        raf = requestAnimationFrame(draw)
      } else if (!entry.isIntersecting && raf) {
        cancelAnimationFrame(raf)
        raf = 0
      }
    })
    io.observe(host)

    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
      // Niente loseContext(): in sviluppo React rimonta il componente e
      // getContext() restituirebbe lo stesso contesto, ormai perso (canvas bianca)
      gl.deleteBuffer(buf)
      gl.deleteProgram(prog)
    }
  }, [])

  return <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 w-full h-full pointer-events-none" />
}
