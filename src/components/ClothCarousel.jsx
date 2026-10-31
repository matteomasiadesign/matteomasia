import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { scrollToTarget } from '../lib/smoothScroll.js'

// --- CAROSELLO "CLOTH" ---
// Ogni progetto è una stampa su tessuto appesa per il bordo superiore.
// Simulazione verlet: la gravità la tiene distesa, il vento (con raffiche)
// la spinge in base all'orientamento di ogni punto, e quando la card si
// sposta l'aria frena la parte libera, che resta indietro come una tenda.

const GRID_X = 28
const GRID_Y = 19
const STEP = 1 / 60
const DAMPING = 0.975 // quanta velocità resta a ogni passo (attrito generale)
const GRAVITY = 0.22 // px / passo²
const AERO = 0.075 // quanto il vento "prende" il tessuto
const ITERATIONS = 4
// Le foto vengono ridotte prima di andare sulla GPU: basta che coprano la card
// più grande (580px CSS) a densità 2x, con un po' di margine
const TEX_W = 1280
const TEX_H = 854

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vNormal = normal;
    gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform sampler2D uTexture;
  uniform vec2 uImageRes;
  uniform vec2 uPlaneRes;
  uniform float uLoaded;
  uniform float uLight;
  uniform float uDim;
  uniform float uRadius;
  uniform vec3 uBg;
  varying vec2 vUv;
  varying vec3 vNormal;

  float roundedBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  void main() {
    vec2 ratio = vec2(
      min((uPlaneRes.x / uPlaneRes.y) / (uImageRes.x / uImageRes.y), 1.0),
      min((uPlaneRes.y / uPlaneRes.x) / (uImageRes.y / uImageRes.x), 1.0)
    );
    vec2 uv = vUv * ratio + (1.0 - ratio) * 0.5;
    vec3 color = texture2D(uTexture, uv).rgb;
    color = mix(mix(uBg, vec3(0.5), 0.12), color, uLoaded);

    // Luce radente sulle pieghe del tessuto
    vec3 n = normalize(vNormal);
    if (!gl_FrontFacing) n = -n;
    vec3 L = normalize(vec3(-0.45, 0.55, 1.0));
    float diff = clamp(dot(n, L), 0.0, 1.0);
    float spec = pow(clamp(dot(n, normalize(L + vec3(0.0, 0.0, 1.0))), 0.0, 1.0), 48.0);
    color = color * (0.5 + 0.56 * diff) + spec * 0.18;

    // Le card lontane dal centro si spengono nello sfondo
    color = mix(color, uBg, (1.0 - uLight) * uDim);

    vec2 p = (vUv - 0.5) * uPlaneRes;
    float alpha = 1.0 - smoothstep(-1.0, 0.5, roundedBox(p, uPlaneRes * 0.5, uRadius));
    gl_FragColor = vec4(color, alpha);
  }
`

const clamp = (v, a, b) => Math.min(Math.max(v, a), b)
const lerp = (a, b, t) => a + (b - a) * t
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
const pad = (n) => String(n).padStart(2, '0')

export default function ClothCarousel({ projects, isDark, cTextMain, cTextMuted }) {
  const navigate = useNavigate()
  const sectionRef = useRef(null)
  const canvasRef = useRef(null)
  const apiRef = useRef({ active: 0 })
  const [active, setActive] = useState(0)
  const [webglFailed, setWebglFailed] = useState(false)

  const count = projects.length
  const bgHex = isDark ? '#000000' : '#ebebee'

  useEffect(() => {
    if (!count || webglFailed) return
    let disposed = false
    let cleanup = () => {}

    import('three').then((THREE) => {
      if (disposed) return
      const canvas = canvasRef.current
      const section = sectionRef.current
      // Su schermi ad alta densità (2x e oltre) i bordi sono già fini e lo
      // shader li sfuma: l'antialias MSAA costerebbe 4 campioni per pixel su
      // tutta la tela senza differenze visibili, quindi resta solo sotto il 2x
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      let renderer
      try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: dpr < 2, alpha: true })
      } catch {
        setWebglFailed(true)
        return
      }
      renderer.setPixelRatio(dpr)

      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(35, 1, 10, 10000)
      const raycaster = new THREE.Raycaster()
      const bg = new THREE.Color(bgHex)
      const dummy = new THREE.Object3D()

      // Foto della card: decodificata fuori dal thread principale (decode()) e
      // ridotta su una canvas prima di diventare texture. Caricata così com'era,
      // una foto da 2500px veniva decodificata e caricata sulla GPU dentro un
      // frame, bloccando lo scroll per qualche centinaio di ms.
      const loadTexture = (url, texture, onReady) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.decoding = 'async'
        img.src = url
        img.decode().then(() => new Promise((ok) => {
          // Riduzione e caricamento quando il browser ha un attimo libero
          if (window.requestIdleCallback) window.requestIdleCallback(ok, { timeout: 1500 })
          else setTimeout(ok, 0)
        })).then(() => {
          if (disposed) return
          const s = Math.min(1, Math.max(TEX_W / img.naturalWidth, TEX_H / img.naturalHeight))
          let source = img
          if (s < 1) {
            source = document.createElement('canvas')
            source.width = Math.round(img.naturalWidth * s)
            source.height = Math.round(img.naturalHeight * s)
            const ctx = source.getContext('2d')
            ctx.imageSmoothingQuality = 'high'
            ctx.drawImage(img, 0, 0, source.width, source.height)
          }
          texture.image = source
          texture.needsUpdate = true
          // Caricata sulla GPU adesso, non al primo frame in cui la card si vede
          renderer.initTexture(texture)
          onReady(source.width, source.height)
        }).catch(() => {})
      }

      let layout = { w: 0, h: 0, mobile: false, vw: 0, vh: 0 }
      let cards = []

      // Una card = una mesh + il suo stato di simulazione
      const createCard = (project, index) => {
        const texture = project.img ? new THREE.Texture() : null
        if (texture) {
          loadTexture(project.img, texture, (w, h) => {
            material.uniforms.uImageRes.value.set(w, h)
            card.loaded = true
          })
          // Nessuna conversione: lo shader scrive direttamente i valori sRGB dell'immagine
          texture.colorSpace = THREE.NoColorSpace
          texture.anisotropy = 4
        }
        const material = new THREE.ShaderMaterial({
          vertexShader,
          fragmentShader,
          transparent: true,
          side: THREE.DoubleSide,
          uniforms: {
            uTexture: { value: texture },
            uImageRes: { value: new THREE.Vector2(1, 1) },
            uPlaneRes: { value: new THREE.Vector2(1, 1) },
            uLoaded: { value: 0 },
            uLight: { value: 0 },
            uDim: { value: 0.6 },
            uRadius: { value: 6 },
            uBg: { value: bg },
          },
        })
        const card = { index, texture, material, mesh: null, geometry: null, loaded: false }
        return card
      }

      // (Ri)costruisce griglia e vincoli quando cambiano le dimensioni
      const buildCloth = (card) => {
        const { w, h } = layout
        card.geometry?.dispose()
        if (card.mesh) scene.remove(card.mesh)
        const geometry = new THREE.PlaneGeometry(w, h, GRID_X - 1, GRID_Y - 1)
        geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6)
        const rest = Float32Array.from(geometry.attributes.position.array)
        const n = GRID_X * GRID_Y
        // Richiamo verso la forma piatta: debolissimo, serve solo a far
        // tornare il tessuto composto quando il vento cala. Un po' più fermo
        // vicino all'orlo superiore, come una stoffa irrigidita dall'asta.
        const stiff = new Float32Array(n)
        for (let i = 0; i < n; i++) {
          const row = Math.floor(i / GRID_X) / (GRID_Y - 1)
          stiff[i] = lerp(0.02, 0.0025, Math.sqrt(row))
        }
        // Vincoli: strutturali e diagonali (la trama non si deforma),
        // di flessione più morbidi (la stoffa si piega ma non si accartoccia)
        const links = []
        const sx = w / (GRID_X - 1)
        const sy = h / (GRID_Y - 1)
        const diag = Math.hypot(sx, sy)
        for (let j = 0; j < GRID_Y; j++) {
          for (let i = 0; i < GRID_X; i++) {
            const a = j * GRID_X + i
            if (i + 1 < GRID_X) links.push(a, a + 1, sx, 1)
            if (j + 1 < GRID_Y) links.push(a, a + GRID_X, sy, 1)
            if (i + 1 < GRID_X && j + 1 < GRID_Y) {
              links.push(a, a + GRID_X + 1, diag, 1)
              links.push(a + 1, a + GRID_X, diag, 1)
            }
            if (i + 2 < GRID_X) links.push(a, a + 2, sx * 2, 0.6)
            if (j + 2 < GRID_Y) links.push(a, a + GRID_X * 2, sy * 2, 0.6)
          }
        }
        card.geometry = geometry
        card.rest = rest
        card.stiff = stiff
        card.links = Float32Array.from(links)
        card.pos = new Float32Array(rest.length)
        card.posPrev = new Float32Array(rest.length) // stato del passo precedente, per interpolare
        card.offPrev = new Float32Array(rest.length)
        card.target = new Float32Array(rest.length)
        card.targetPrev = new Float32Array(rest.length)
        card.normals = new Float32Array(rest.length)
        card.ready = false
        card.material.uniforms.uPlaneRes.value.set(w, h)
        card.material.uniforms.uRadius.value = 0 // angoli vivi, come i bottoni della hero
        card.mesh = new THREE.Mesh(geometry, card.material)
        card.mesh.frustumCulled = false
        card.mesh.userData.card = card
        scene.add(card.mesh)
      }

      const resize = () => {
        const vw = canvas.clientWidth
        const vh = canvas.clientHeight
        // Su mobile la barra dell'indirizzo che compare e scompare durante lo
        // scroll lancia "resize" anche se la tela (100svh) resta uguale:
        // ricostruire il tessuto lì vorrebbe dire uno scatto a ogni scroll
        if (vw === layout.vw && vh === layout.vh) return
        renderer.setSize(vw, vh, false)
        camera.aspect = vw / vh
        // 1 unità del mondo = 1 pixel sul piano z=0
        camera.position.z = vh / 2 / Math.tan((camera.fov * Math.PI) / 360)
        camera.updateProjectionMatrix()
        const mobile = vw < 768
        let w = mobile ? vw * 0.74 : Math.min(vw * 0.36, 580)
        let h = w / 1.5
        const maxH = vh * (mobile ? 0.3 : 0.42)
        if (h > maxH) { h = maxH; w = h * 1.5 }
        layout = { w, h, mobile, vw, vh }
        cards.forEach(buildCloth)
      }

      cards = projects.map(createCard)

      // --- INPUT ---
      const motion = { current: 0, velocity: 0, pointerX: 0, pointerY: 0, tiltX: 0, tiltY: 0 }
      const pointer = { ndc: new THREE.Vector2(), inside: false, hit: null, dx: 0, dy: 0, lastX: 0, lastY: 0 }

      const readTarget = () => {
        const rect = section.getBoundingClientRect()
        const span = rect.height - window.innerHeight
        const p = span > 0 ? clamp(-rect.top / span, 0, 1) : 0
        const raw = p * (count - 1)
        const base = Math.floor(raw)
        return Math.min(base + smoothstep(0.2, 0.8, raw - base), count - 1)
      }

      const pick = () => {
        raycaster.setFromCamera(pointer.ndc, camera)
        const hits = raycaster.intersectObjects(cards.filter((c) => c.mesh.visible).map((c) => c.mesh), false)
        return hits[0] || null
      }

      const onPointerMove = (e) => {
        const rect = canvas.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        pointer.ndc.set((x / rect.width) * 2 - 1, -(y / rect.height) * 2 + 1)
        if (pointer.inside) {
          pointer.dx += x - pointer.lastX
          pointer.dy -= y - pointer.lastY
        }
        pointer.lastX = x
        pointer.lastY = y
        pointer.inside = true
        motion.pointerX = (x / rect.width - 0.5) * 2
        motion.pointerY = (y / rect.height - 0.5) * 2
        const hit = pick()
        pointer.hit = hit
        canvas.style.cursor = hit ? 'pointer' : ''
      }
      const onPointerLeave = () => {
        pointer.inside = false
        pointer.hit = null
        motion.pointerX = 0
        motion.pointerY = 0
      }
      const onClick = () => {
        const hit = pick()
        if (!hit) return
        const { index } = hit.object.userData.card
        if (index === apiRef.current.active) {
          const p = projects[index]
          navigate(`/progetti/${p.slug || p.id}`)
        } else {
          apiRef.current.goTo?.(index)
        }
      }

      // --- POSIZIONE DI OGNI CARD LUNGO IL PERCORSO ---
      const placeCard = (card) => {
        const { w, h, mobile } = layout
        const d = card.index - motion.current
        const ad = Math.abs(d)
        const light = clamp(1 - ad * 1.15, 0, 1)
        if (mobile) {
          dummy.position.set(d * w * 0.86, d * h * 0.32 - h * 0.18, -ad * w * 0.7)
        } else {
          dummy.position.set(d * w * 0.9 + w * 0.32, d * h * 0.45 - ad * ad * h * 0.06, -ad * w * 0.5)
        }
        dummy.rotation.set(
          -Math.min(ad * 0.17, 0.45) - motion.tiltX * light,
          clamp(-d * 0.38, -0.7, 0.7) + motion.tiltY * light,
          ((4 + d * 3) * Math.PI) / 180
        )
        dummy.updateMatrix()
        card.material.uniforms.uLight.value = light
        card.material.uniforms.uLoaded.value = lerp(card.material.uniforms.uLoaded.value, card.loaded ? 1 : 0, 0.06)
        return { light, visible: ad < 3.5 }
      }

      // --- SIMULAZIONE DEL TESSUTO ---
      let time = 0
      const wind = { x: 0, y: 0, z: 0 }

      // Normale di ogni punto dalla griglia (differenza tra i vicini)
      const computeNormals = (pos, out) => {
        for (let j = 0; j < GRID_Y; j++) {
          const up = Math.max(j - 1, 0), down = Math.min(j + 1, GRID_Y - 1)
          for (let i = 0; i < GRID_X; i++) {
            const left = Math.max(i - 1, 0), right = Math.min(i + 1, GRID_X - 1)
            const r = (j * GRID_X + right) * 3, l = (j * GRID_X + left) * 3
            const u = (up * GRID_X + i) * 3, d = (down * GRID_X + i) * 3
            const ax = pos[r] - pos[l], ay = pos[r + 1] - pos[l + 1], az = pos[r + 2] - pos[l + 2]
            const bx = pos[u] - pos[d], by = pos[u + 1] - pos[d + 1], bz = pos[u + 2] - pos[d + 2]
            const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx
            const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1
            const o = (j * GRID_X + i) * 3
            out[o] = nx / len; out[o + 1] = ny / len; out[o + 2] = nz / len
          }
        }
      }

      const simulate = (card) => {
        const { pos, posPrev, offPrev, target, targetPrev, rest, stiff, links, normals } = card
        const e = dummy.matrix.elements
        const n = rest.length / 3
        posPrev.set(pos)

        // Forma "a riposo" della card nella sua posizione attuale
        targetPrev.set(target)
        for (let i = 0; i < n; i++) {
          const x = rest[i * 3], y = rest[i * 3 + 1]
          target[i * 3] = e[0] * x + e[4] * y + e[12]
          target[i * 3 + 1] = e[1] * x + e[5] * y + e[13]
          target[i * 3 + 2] = e[2] * x + e[6] * y + e[14]
        }
        if (!card.ready || reduceMotion) {
          // Una card che (ri)entra in scena non ha un passo precedente da cui partire
          if (!card.ready) posPrev.set(target)
          pos.set(target)
          offPrev.fill(0)
          targetPrev.set(target)
          card.ready = true
          return
        }

        computeNormals(pos, normals)

        // La mano che sfiora: agisce solo mentre il cursore si muove
        const cnx = e[8], cny = e[9], cnz = e[10]
        const hit = pointer.hit && pointer.hit.object === card.mesh ? pointer.hit : null
        const speed = Math.min(Math.hypot(pointer.dx, pointer.dy), 40)
        const touching = hit && speed > 0.5
        const hx = touching ? (hit.uv.x - 0.5) * layout.w : 0
        const hy = touching ? (hit.uv.y - 0.5) * layout.h : 0
        const radius2 = (layout.w * 0.3) ** 2
        // Forze proporzionate alla card: una card piccola (mobile) non deve piegarsi di più
        const scale = layout.w / 520
        const aero = AERO * scale
        const gravity = GRAVITY * scale

        for (let i = GRID_X; i < n; i++) {
          const ix = i * 3, iy = ix + 1, iz = ix + 2
          // La simulazione lavora sullo scostamento dalla forma della card:
          // il tessuto segue la card senza inerzia (niente rimbalzi a ogni
          // scroll) e si muove solo per vento, gravità e mano
          const tvx = target[ix] - targetPrev[ix], tvy = target[iy] - targetPrev[iy], tvz = target[iz] - targetPrev[iz]
          const ox = pos[ix] - targetPrev[ix], oy = pos[iy] - targetPrev[iy], oz = pos[iz] - targetPrev[iz]
          const rvx = ox - offPrev[ix], rvy = oy - offPrev[iy], rvz = oz - offPrev[iz]

          // Aria che investe il punto: vento con turbolenza locale meno il suo
          // movimento (lo spostamento della card conta poco, per non sollevarla)
          const turb = 1 + 0.8 * Math.sin(time * 1.9 + rest[ix] * 0.007 - rest[iy] * 0.004) * Math.sin(time * 1.1 + rest[iy] * 0.009 + 0.7)
          const wx = wind.x * turb - tvx * 0.6 - rvx, wy = wind.y * turb - tvy * 0.6 - rvy, wz = wind.z * turb - tvz * 0.6 - rvz
          const nx = normals[ix], ny = normals[iy], nz = normals[iz]
          // Tetto alla spinta: anche nelle raffiche più forti il tessuto si
          // inclina al massimo di una ventina di gradi, senza sollevarsi
          const push = clamp(nx * wx + ny * wy + nz * wz, -1.5, 1.5) * aero

          let ax = nx * push - ox * stiff[i]
          let ay = ny * push - oy * stiff[i] - gravity
          let az = nz * push - oz * stiff[i]

          if (touching) {
            const dx = rest[ix] - hx, dy = rest[iy] - hy
            const dist2 = (dx * dx + dy * dy) / radius2
            if (dist2 < 1) {
              const f = (1 - dist2) * (1 - dist2)
              ax += -cnx * f * speed * 0.05 + pointer.dx * f * 0.04
              ay += -cny * f * speed * 0.05 + pointer.dy * f * 0.04
              az += -cnz * f * speed * 0.05
            }
          }

          offPrev[ix] = ox; offPrev[iy] = oy; offPrev[iz] = oz
          pos[ix] = target[ix] + ox + rvx * DAMPING + ax
          pos[iy] = target[iy] + oy + rvy * DAMPING + ay
          pos[iz] = target[iz] + oz + rvz * DAMPING + az
        }

        // Orlo superiore fissato all'asta
        const pin = () => {
          for (let i = 0; i < GRID_X * 3; i++) { pos[i] = target[i]; offPrev[i] = 0 }
        }
        pin()

        // Vincoli: la trama non si allunga
        for (let iter = 0; iter < ITERATIONS; iter++) {
          for (let l = 0; l < links.length; l += 4) {
            const a = links[l] * 3, b = links[l + 1] * 3, len = links[l + 2], k = links[l + 3]
            const dx = pos[b] - pos[a], dy = pos[b + 1] - pos[a + 1], dz = pos[b + 2] - pos[a + 2]
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1
            const c = ((dist - len) / dist) * 0.5 * k
            pos[a] += dx * c; pos[a + 1] += dy * c; pos[a + 2] += dz * c
            pos[b] -= dx * c; pos[b + 1] -= dy * c; pos[b + 2] -= dz * c
          }
          pin()
        }
      }

      // --- LOOP ---
      let visible = false
      let raf = 0
      let acc = 0
      const clock = new THREE.Clock()

      // Fuori dallo schermo il loop si ferma del tutto; lo riavvia l'observer
      const tick = () => {
        raf = 0
        if (!visible) return
        raf = requestAnimationFrame(tick)
        acc = Math.min(acc + clock.getDelta(), STEP * 4)
        const target = readTarget()

        // Tutto ciò che muove le card avanza a passi fissi insieme alla fisica:
        // così il tessuto si comporta allo stesso modo a qualsiasi frame rate
        while (acc >= STEP) {
          acc -= STEP
          time += STEP

          const prevCurrent = motion.current
          motion.current = reduceMotion ? target : lerp(motion.current, target, 0.08)
          motion.velocity = lerp(motion.velocity, motion.current - prevCurrent, 0.2)
          motion.tiltX = lerp(motion.tiltX, layout.mobile ? 0 : motion.pointerY * 0.1, 0.08)
          motion.tiltY = lerp(motion.tiltY, layout.mobile ? 0 : motion.pointerX * 0.14, 0.08)
          // Brezza con raffiche lente e irregolari, un po' più forte mentre si scorre
          const gust = 0.55 + 0.45 * Math.sin(time * 0.37) * Math.sin(time * 0.61 + 1.3)
          const strength = gust * (3 + Math.min(Math.abs(motion.velocity) * 12, 1))
          wind.x = 0.85 * strength
          wind.y = 0.1 * strength
          wind.z = -0.5 * strength

          for (const card of cards) {
            const { visible: cardVisible } = placeCard(card)
            // Una card che rientra in scena riparte distesa
            if (cardVisible && !card.mesh.visible) card.ready = false
            card.mesh.visible = cardVisible
            if (cardVisible) simulate(card)
          }
          pointer.dx *= 0.5
          pointer.dy *= 0.5
        }

        // La fisica avanza a 60 passi al secondo, lo schermo può andare a 90-120 Hz
        // (o avere frame irregolari): si disegna una via di mezzo tra gli ultimi
        // due passi, così le card scorrono fluide invece di procedere a scatti
        const alpha = acc / STEP
        for (const card of cards) {
          if (!card.mesh.visible) continue
          const out = card.geometry.attributes.position.array
          const { pos, posPrev } = card
          for (let i = 0; i < out.length; i++) out[i] = posPrev[i] + (pos[i] - posPrev[i]) * alpha
          card.geometry.attributes.position.needsUpdate = true
          card.geometry.computeVertexNormals()
          card.mesh.renderOrder = 100 - Math.round(Math.abs(card.index - motion.current) * 10)
        }

        const nearest = clamp(Math.round(motion.current), 0, count - 1)
        if (nearest !== apiRef.current.active) {
          apiRef.current.active = nearest
          setActive(nearest)
        }
        renderer.render(scene, camera)
      }

      const io = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting
        if (visible) {
          clock.getDelta()
          if (!raf) raf = requestAnimationFrame(tick)
        }
      })
      io.observe(section)

      resize()
      motion.current = readTarget()
      // Shader mandati in compilazione subito (il driver lavora in parallelo):
      // al primo frame visibile costerebbero ~100ms proprio durante lo scroll
      renderer.compile(scene, camera)
      tick()

      window.addEventListener('resize', resize)
      canvas.addEventListener('pointermove', onPointerMove)
      canvas.addEventListener('pointerleave', onPointerLeave)
      canvas.addEventListener('click', onClick)

      apiRef.current.setBg = (hex, dark) => {
        bg.set(hex)
        cards.forEach((c) => { c.material.uniforms.uDim.value = dark ? 0.6 : 0.3 })
      }
      apiRef.current.setBg(bgHex, isDark)

      cleanup = () => {
        cancelAnimationFrame(raf)
        io.disconnect()
        window.removeEventListener('resize', resize)
        canvas.removeEventListener('pointermove', onPointerMove)
        canvas.removeEventListener('pointerleave', onPointerLeave)
        canvas.removeEventListener('click', onClick)
        cards.forEach((c) => { c.geometry?.dispose(); c.material.dispose(); c.texture?.dispose() })
        renderer.dispose()
      }
    })

    return () => {
      disposed = true
      cleanup()
    }
    // La scena si ricostruisce solo se cambia l'elenco dei progetti
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, webglFailed])

  useEffect(() => {
    apiRef.current.setBg?.(bgHex, isDark)
  }, [bgHex, isDark])

  // Porta la card i al centro scrollando la pagina fino al punto giusto
  const goTo = (i) => {
    const section = sectionRef.current
    if (!section || count < 2) return
    const span = section.offsetHeight - window.innerHeight
    const top = section.getBoundingClientRect().top + window.scrollY
    scrollToTarget(top + (i / (count - 1)) * span)
  }
  apiRef.current.goTo = goTo

  const openProject = (p) => navigate(`/progetti/${p.slug || p.id}`)
  const current = projects[active]

  if (webglFailed) {
    return (
      <section id="projects" className="max-w-[980px] mx-auto px-6 py-24 grid grid-cols-1 md:grid-cols-2 gap-8">
        {projects.map((p) => (
          <button key={p.id} onClick={() => openProject(p)} className="text-left">
            <img src={p.img} alt={p.title} loading="lazy" className="w-full aspect-[3/2] object-cover" />
            <h3 className={`mt-4 text-2xl font-semibold tracking-tight ${cTextMain}`}>{p.title}</h3>
            <p className={`${cTextMuted} text-sm`}>{p.category}</p>
          </button>
        ))}
      </section>
    )
  }

  return (
    <section
      id="projects"
      ref={sectionRef}
      className={`relative w-full ${isDark ? 'slides-dark' : 'slides-light'}`}
      style={{ height: `${100 + Math.max(count - 1, 1) * 60}vh` }}
    >
      <div className="sticky top-0 h-[100svh] w-full overflow-hidden">
        <div aria-hidden="true" className="slides-light-source absolute inset-0 pointer-events-none" />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full touch-pan-y select-none" />
        <div aria-hidden="true" className="slides-grain absolute inset-0 pointer-events-none" />

        {/* Per tastiera e motori di ricerca: le card sono solo pixel della canvas */}
        <ul className="sr-only">
          {projects.map((p) => (
            <li key={p.id}><Link to={`/progetti/${p.slug || p.id}`}>{p.title} — {p.category}</Link></li>
          ))}
        </ul>

        {/* Scheda del progetto (in stile titoli di coda) e azioni, sulla griglia del sito */}
        <div className="pointer-events-none absolute inset-0">
          <div className="wrap h-full flex flex-col justify-between pt-20 md:pt-28 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] md:pb-10">
            <div className="w-full md:w-[360px]">
              <span className="block text-xs font-semibold uppercase tracking-widest text-[#ff2b1c] mb-3">
                Selected work
              </span>
              <div className="overflow-hidden">
                <h2 key={current?.id} className={`slides-swap text-3xl md:text-5xl font-semibold tracking-tight leading-[1.05] ${cTextMain}`}>
                  {current?.title}
                </h2>
              </div>
              <dl className={`mt-4 md:mt-6 text-sm font-medium ${cTextMain}`}>
                <div className="flex justify-between gap-4 py-2 border-t border-[#ff2b1c]/40">
                  <dt className={`text-xs font-semibold uppercase tracking-widest ${cTextMuted} pt-0.5`}>Category</dt>
                  <dd key={`c-${current?.id}`} className="slides-swap text-right">{current?.category}</dd>
                </div>
                <div className="flex justify-between gap-4 py-2 border-t border-[#ff2b1c]/40">
                  <dt className={`text-xs font-semibold uppercase tracking-widest ${cTextMuted} pt-0.5`}>Project</dt>
                  <dd className="tabular-nums">{pad(active + 1)} / {pad(count)}</dd>
                </div>
                {current?.description && (
                  <div className="hidden md:block py-3 border-t border-[#ff2b1c]/40">
                    <dd key={`d-${current?.id}`} className={`slides-swap ${cTextMuted} leading-relaxed`}>{current.description}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Una tacca per ogni progetto + azioni */}
            <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-5">
              <div className="flex items-end gap-1.5" aria-hidden="true">
                {projects.map((p, i) => (
                  <span
                    key={p.id}
                    className={`w-[3px] transition-all duration-500 ${i === active ? 'h-6 bg-[#ff2b1c]' : 'h-3 bg-[#ff2b1c]/35'}`}
                  />
                ))}
              </div>
              <div className="pointer-events-auto flex flex-wrap gap-3">
                {current && (
                  <Link
                    to={`/progetti/${current.slug || current.id}`}
                    className="group flex items-center gap-2 px-6 py-3 border-[3px] border-[#ff2b1c] bg-[#ff2b1c] text-black font-semibold text-sm md:text-base hover:bg-transparent hover:text-[#ff2b1c] active:scale-95 transition-colors duration-200"
                  >
                    Open project
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </Link>
                )}
                <Link
                  to="/progetti"
                  className="hero-btn-red group flex items-center gap-2 px-6 py-3 border-[3px] border-[#ff2b1c] bg-transparent text-[#ff2b1c] font-semibold text-sm md:text-base active:scale-95 transition-colors duration-200"
                >
                  View archive
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
