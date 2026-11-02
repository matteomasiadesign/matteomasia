// --- SCENA DEGLI UCCELLI DI FUMO (rendering offline) ---
// Uccelli fatti di fumo che attraversano il cielo dietro "What I do", tutti
// nello stesso verso come uno stormo in migrazione, a profondità diverse: i
// lontani piccoli e chiari, i vicini grandi e cupi. Battono le ali, ogni tanto
// planano, salgono e scendono piano lungo la rotta. Non gira nel sito:
// render.html la disegna fotogramma per fotogramma e tools/capture.mjs ne fa un
// video in loop, come per gli elefanti della hero.
//
// Il loop è esatto: in LOOP secondi ogni uccello fa un numero intero di
// passaggi, battiti e planate. Tra un passaggio e l'altro, fuori campo, cambia
// un po' quota e profondità, così i passaggi non si ripetono uguali.
//
// Il video esce in scala di grigi su bianco: nei servizi va in "multiply", così
// il fumo diventa rosso scuro sul rosso e il bianco sparisce.

export const LOOP = 48 // secondi
export const FPS = 30

export const VARIANTS = {
  landscape: { w: 1280, h: 720, tanV: 0.364 },
  portrait: { w: 720, h: 1280, tanV: 0.533 },
}

const SC = 3.0 // scala dell'uccello: deve combaciare con lo shader
const PITCH = 0.6 // la camera guarda verso il cielo: gli uccelli si vedono un po' da sotto
const PAD = 7 // oltre il bordo dell'inquadratura, dove l'uccello entra ed esce senza essere visto
// Scia: il fumo lasciato indietro sono copie sbiadite dell'uccello com'era
// GHOSTS istanti prima (ogni GHOST_DT secondi), con le ali in quella posa
const GHOSTS = 4
const GHOST_DT = 0.15

// d: distanza dalla camera, y: altezza nell'inquadratura (-1 in basso, 1 in alto),
// yaw: rotta rispetto al bordo dello schermo (+ verso la camera, - via da lei),
// v: velocità (m/s), L: passaggi in un loop, off: quando passa la prima volta
// (frazione del giro), m: battiti d'ala in un loop, g: planate in un loop
const BIRDS = [
  { d: 76, y: 0.55, yaw: -0.3, v: 5, L: 2, off: 0.1, m: 58, g: 3 },
  { d: 66, y: -0.2, yaw: 0.25, v: 5, L: 2, off: 0.55, m: 62, g: 4 },
  { d: 54, y: 0.65, yaw: 0.5, v: 5, L: 3, off: 0.8, m: 56, g: 5 },
  { d: 44, y: 0.05, yaw: -0.45, v: 4.5, L: 3, off: 0.3, m: 54, g: 4 },
  { d: 34, y: 0.45, yaw: 0.35, v: 4.5, L: 3, off: 0.62, m: 50, g: 3 },
  { d: 25, y: -0.35, yaw: -0.2, v: 4, L: 4, off: 0.02, m: 46, g: 5 },
]

const TAU = Math.PI * 2
const frac = (x) => x - Math.floor(x)
const jit = (a, b) => frac(Math.sin(a * 12.9898 + b * 78.233) * 43758.5453)
const smoothstep = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1)
  return t * t * (3 - 2 * t)
}

export function makeScene(variant) {
  const { w, h, tanV } = VARIANTS[variant]
  const tanH = tanV * (w / h)
  const cp = Math.cos(PITCH)
  const sp = Math.sin(PITCH)
  const N = BIRDS.length
  const bird = new Float32Array(N * 4)
  const anim = new Float32Array(N * 4)
  const past = new Float32Array(N * GHOSTS * 4)
  const off = new Float32Array(N)
  BIRDS.forEach((_, i) => (off[i] = i * 9.1))

  // Dalla camera (inclinata) al mondo e ritorno
  const toWorld = (x, y, z) => [x, y * cp - z * sp, y * sp + z * cp]
  const seen = (x, y, z) => {
    const yc = y * cp + z * sp
    const D = y * sp - z * cp
    return D > 1 && Math.abs(x) < D * tanH + PAD && Math.abs(yc) < D * tanV + PAD
  }

  // Rotta di un passaggio: una retta orizzontale che attraversa l'inquadratura.
  // Si cerca dove entra e dove esce (fuori campo, con margine). Ogni passaggio
  // un po' più vicino o lontano, più alto o più basso, più o meno obliquo
  const laps = new Map()
  const lapPath = (i, lap) => {
    const key = `${i}:${lap}`
    if (laps.has(key)) return laps.get(key)
    const b = BIRDS[i]
    const D = b.d * (1 + 0.24 * (jit(i, lap) - 0.5))
    const yf = b.y + 0.3 * (jit(i + 3, lap) - 0.5)
    const yaw = b.yaw + 0.3 * (jit(i + 5, lap) - 0.5)
    const c = toWorld(0, yf * D * tanV * 0.8, -D)
    const dir = [Math.cos(yaw), Math.sin(yaw)]
    let s0 = null
    let s1 = null
    for (let s = -400; s <= 400; s += 0.25) {
      if (seen(c[0] + dir[0] * s, c[1], c[2] + dir[1] * s)) {
        if (s0 === null) s0 = s
        s1 = s
      }
    }
    // Se il tragitto non ci sta nel giro, l'uccello va un po' più veloce
    const v = Math.max(b.v, (s1 - s0) / ((LOOP / b.L) * 0.95))
    const path = { c, yaw, s0, s1, v, ph: jit(i + 7, lap) * TAU }
    laps.set(key, path)
    return path
  }

  // Ali: battito con la punta in ritardo; nelle planate il battito si spegne
  // e le ali restano aperte, appena alzate. In risalita la mano si piega indietro.
  // L'ultimo valore è il dondolio: il corpo scende quando le ali sono in alto
  const wings = (b, i, t) => {
    const phi = (TAU * b.m * t) / LOOP + i * 1.7
    const glide = 0.5 + 0.5 * Math.sin((TAU * b.g * t) / LOOP + i * 2.3)
    const amp = 0.12 + 0.88 * smoothstep(0.15, 0.45, glide)
    const a1 = 0.12 + amp * 0.55 * Math.sin(phi)
    const a2 = a1 + 0.08 + amp * 0.38 * Math.sin(phi - 0.9)
    const fold = amp * smoothstep(-0.3, 1, Math.cos(phi))
    return [a1, a2, fold, -0.14 * amp * Math.sin(phi)]
  }

  // Posa di tutto lo stormo al tempo t (deterministica: ogni fotogramma da solo)
  const pose = (t) => {
    BIRDS.forEach((b, i) => {
      const lapF = (t * b.L) / LOOP + b.off
      const lap = ((Math.floor(lapF) % b.L) + b.L) % b.L
      const { c, yaw, s0, v, ph } = lapPath(i, lap)
      // Dopo l'uscita continua dritto, fuori campo, fino al passaggio dopo
      const s = s0 + v * frac(lapF) * (LOOP / b.L)
      // Sale e scende piano, e ondeggia di lato
      const Wy = TAU / 28
      const Wz = TAU / 44
      const up = 0.8 * Math.sin(Wy * s + ph)
      const side = 1.5 * Math.sin(Wz * s + ph * 1.3)
      const cy = Math.cos(yaw)
      const sy = Math.sin(yaw)
      const x = c[0] + cy * s - sy * side
      const z = c[2] + sy * s + cy * side
      const pitch = 0.8 * Math.atan(0.8 * Wy * Math.cos(Wy * s + ph))
      const heading = yaw + Math.atan(1.5 * Wz * Math.cos(Wz * s + ph * 1.3))

      const [a1, a2, fold, bob] = wings(b, i, t)
      bird.set([x, c[1] + up + bob, z, heading], i * 4)
      anim.set([pitch, a1, a2, fold], i * 4)
      // Le copie della scia: quanto sono indietro lungo la rotta e com'erano le ali
      for (let k = 1; k <= GHOSTS; k++) {
        const [p1, p2, pf] = wings(b, i, t - k * GHOST_DT)
        past.set([v * k * GHOST_DT, p1, p2, pf], (i * GHOSTS + k - 1) * 4)
      }
    })
    return { bird, anim, past, off }
  }

  return { N, w, h, tanV, pitch: PITCH, pose, frag: frag(N) }
}

export const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`

const frag = (N) => `
precision highp float;
#define N ${N}
#define GHOSTS ${GHOSTS}
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uCam;      // altezza, inclinazione, tan(fov verticale / 2)
uniform vec4 uBird[N];  // posizione x, y, z e rotta (imbardata)
uniform vec4 uAnim[N];  // beccheggio, ala, mano, piega della mano
uniform vec4 uPast[N * GHOSTS]; // scia: quanto indietro, ala, mano, piega
uniform float uOff[N];  // rumore di questo uccello
varying vec2 vUv;

const float LOOP = ${LOOP.toFixed(1)};
const float SC = ${SC.toFixed(2)};
// (allungato indietro e in alto per la scia)
const vec3 BOX_C = vec3(-2.4, 0.4, 0.0);
const vec3 BOX_H = vec3(4.9, 4.1, 4.6);
const vec3 LIGHT = vec3(-0.37, 0.83, -0.42);
const float SIGMA = 8.0;
const float STEP = 0.04;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hash3(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1.0, 0.0, 0.0)), f.x),
                 mix(hash3(i + vec3(0.0, 1.0, 0.0)), hash3(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(hash3(i + vec3(0.0, 0.0, 1.0)), hash3(i + vec3(1.0, 0.0, 1.0)), f.x),
                 mix(hash3(i + vec3(0.0, 1.0, 1.0)), hash3(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  return 0.5 * noise3(p) + 0.3 * noise3(p * 2.3 + 1.7) + 0.2 * noise3(p * 5.1 + 4.1);
}
// Fumo che resta indietro nel volo e sale piano; a fine loop sfuma in se stesso,
// con il contrasto tenuto costante nella dissolvenza
float smoke(vec3 p, float off) {
  vec3 drift = vec3(uTime * 0.8, -uTime * 0.15, 0.0);
  vec3 back = vec3(LOOP * 0.8, -LOOP * 0.15, 0.0);
  float a = uTime / LOOP;
  float n0 = fbm(p + drift + off);
  float n1 = fbm(p + drift - back + off);
  return 0.5 + (mix(n0, n1, a) - 0.5) / sqrt(a * a + (1.0 - a) * (1.0 - a));
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
float sdEll(vec3 p, vec3 r) {
  float k0 = length(p / r);
  float k1 = length(p / (r * r));
  return k0 * (k0 - 1.0) / k1;
}
float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}
// Cono arrotondato tra due sfere (Inigo Quilez)
float sdCone(vec3 p, vec3 a, vec3 b, float r1, float r2) {
  vec3 ba = b - a;
  float l2 = dot(ba, ba);
  float rr = r1 - r2;
  float a2 = l2 - rr * rr;
  float il2 = 1.0 / l2;
  vec3 pa = p - a;
  float y = dot(pa, ba);
  float z = y - l2;
  vec3 xv = pa * l2 - ba * y;
  float x2 = dot(xv, xv);
  float y2 = y * y * l2;
  float z2 = z * z * l2;
  float k = sign(rr) * rr * rr * x2;
  if (sign(z) * a2 * z2 > k) return sqrt(x2 + z2) * il2 - r2;
  if (sign(y) * a2 * y2 < k) return sqrt(x2 + y2) * il2 - r1;
  return (sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}

// Dal mondo allo spazio dell'uccello: x avanti, y su, z di lato
vec3 rotLocal(vec3 d, vec4 b, float pitch) {
  float cy = cos(b.w), sy = sin(b.w);
  vec3 q = vec3(d.x * cy + d.z * sy, d.y, d.z * cy - d.x * sy);
  float cp = cos(pitch), sp = sin(pitch);
  return vec3(q.x * cp + q.y * sp, q.y * cp - q.x * sp, q.z);
}

// Sagome piatte: si disegnano in pianta (x avanti, z di lato) e poi si danno uno spessore
float cr(vec2 u, vec2 v) { return u.x * v.y - u.y * v.x; }
float sdSeg2(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}
// Quadrilatero convesso, in qualsiasi verso
float sdQuad(vec2 p, vec2 a, vec2 b, vec2 c, vec2 d) {
  float dd = min(min(sdSeg2(p, a, b), sdSeg2(p, b, c)), min(sdSeg2(p, c, d), sdSeg2(p, d, a)));
  float s0 = cr(b - a, p - a);
  float s1 = cr(c - b, p - b);
  float s2 = cr(d - c, p - c);
  float s3 = cr(a - d, p - d);
  bool inside = min(min(s0, s1), min(s2, s3)) > 0.0 || max(max(s0, s1), max(s2, s3)) < 0.0;
  return inside ? -dd : dd;
}
// Penna: segmento che si assottiglia da r1 a r2
float sdFeather(vec2 p, vec2 a, vec2 b, float r1, float r2) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - mix(r1, r2, h);
}
// Dalla pianta al volume: spessore th sopra e sotto
float slab(float d2, float y, float th) {
  vec2 w = vec2(d2, abs(y) - th);
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0));
}

// Lo stampo dell'uccello, in unità sue (apertura alare circa 2.9)
float shape(vec3 p, vec4 an) {
  // Corpo affusolato con il petto pieno, collo, testa e becco
  float body = sdEll(p, vec3(0.38, 0.105, 0.11));
  body = smin(body, sdEll(p - vec3(0.1, -0.02, 0.0), vec3(0.22, 0.125, 0.12)), 0.08);
  body = smin(body, sdCone(p, vec3(0.28, 0.03, 0.0), vec3(0.47, 0.07, 0.0), 0.085, 0.065), 0.05);
  body = smin(body, sdEll(p - vec3(0.5, 0.075, 0.0), vec3(0.1, 0.075, 0.07)), 0.04);
  body = min(body, sdCone(p, vec3(0.57, 0.07, 0.0), vec3(0.74, 0.045, 0.0), 0.03, 0.006));
  // Coda a ventaglio, sottile, che si allarga verso il fondo arrotondato
  float tail = sdQuad(p.xz, vec2(-0.26, 0.06), vec2(-0.66, 0.19), vec2(-0.68, -0.19), vec2(-0.26, -0.06));
  tail = max(tail, length(p.xz - vec2(-0.24, 0.0)) - 0.43);
  body = smin(body, slab(tail, p.y - 0.02, 0.01) - 0.012, 0.06);

  // Ali, simmetriche: braccio che ruota sulla spalla, mano che ruota sul polso
  // (in ritardo) e si piega indietro
  vec3 m = vec3(p.xy, abs(p.z));
  vec3 q = m - vec3(0.08, 0.05, 0.07);
  float c1 = cos(an.y), s1 = sin(an.y);
  q.yz = vec2(q.y * c1 - q.z * s1, q.y * s1 + q.z * c1);
  // Braccio: bordo d'attacco dritto, largo alla spalla e appena più stretto al polso
  float arm = sdQuad(q.xz, vec2(0.1, 0.0), vec2(0.07, 0.58), vec2(-0.15, 0.58), vec2(-0.21, 0.0));
  float wing = slab(arm, q.y, 0.032 - 0.012 * clamp(q.z / 0.58, 0.0, 1.0)) - 0.012;
  vec3 r = q - vec3(0.0, 0.0, 0.56);
  float da = an.z - an.y;
  float c2 = cos(da), s2 = sin(da);
  r.yz = vec2(r.y * c2 - r.z * s2, r.y * s2 + r.z * c2);
  float sw = 0.25 + an.w * 0.6;
  float c3 = cos(sw), s3 = sin(sw);
  r.xz = vec2(r.x * c3 + r.z * s3, r.z * c3 - r.x * s3);
  // Mano: una base che si stringe e cinque remiganti aperte a ventaglio,
  // come le dita dei grandi veleggiatori; in risalita si richiudono
  float hand = sdQuad(r.xz, vec2(0.07, 0.0), vec2(0.035, 0.32), vec2(-0.12, 0.29), vec2(-0.16, 0.0));
  float spread = 1.0 - 0.55 * an.w;
  for (int k = 0; k < 5; k++) {
    float fk = float(k);
    float th = 0.05 + fk * 0.17 * spread;
    vec2 base = vec2(0.03 - fk * 0.035, 0.29 - fk * 0.008);
    vec2 tip = base + vec2(-sin(th), cos(th)) * (0.4 - fk * 0.04);
    hand = min(hand, sdFeather(r.xz, base, tip, 0.032, 0.018));
  }
  wing = smin(wing, slab(hand, r.y, 0.018) - 0.01, 0.04);
  return smin(body, wing, 0.07);
}

// Densità del fumo in un punto del mondo; dmin serve a saltare il vuoto
float density(vec3 w, out float dmin) {
  dmin = 1e5;
  float dens = 0.0;
  for (int i = 0; i < N; i++) {
    vec4 b = uBird[i];
    vec3 p = rotLocal(w - b.xyz, b, uAnim[i].x);
    float bb = sdBox(p - BOX_C, BOX_H);
    if (bb > 0.9) { dmin = min(dmin, bb); continue; }
    float d = shape(p / SC, uAnim[i]) * SC;
    dmin = min(dmin, d);
    // Scia: copie dell'uccello rimaste indietro, che si allargano, salgono e
    // si sfaldano in sbuffi sempre più radi
    float wake[GHOSTS];
    for (int k = 0; k < GHOSTS; k++) {
      vec4 g = uPast[i * GHOSTS + k];
      float age = float(k + 1) / float(GHOSTS);
      wake[k] = shape((p + vec3(g.x, -0.35 * age, 0.0)) / SC, vec4(0.0, g.yzw)) * SC;
      dmin = min(dmin, wake[k] - 0.3);
    }
    if (dmin > 0.6) continue;
    float n = smoke(p, uOff[i]);
    // Sagoma piena e netta (ali e penne sono sottili: bordo appena sfilacciato
    // e fumo più denso), con sbuffi che si staccano
    float e = d - (n - 0.5) * 0.14;
    dens += smoothstep(0.05, -0.06, e) * (1.1 + 0.6 * n);
    dens += smoothstep(0.66, 0.82, n) * smoothstep(0.45, 0.04, d) * 0.55;
    for (int k = 0; k < GHOSTS; k++) {
      float age = float(k + 1) / float(GHOSTS);
      float eg = wake[k] - (n - 0.5) * 0.35 - 0.1 * age;
      // (la prima copia, ancora addosso all'uccello, è la più leggera)
      dens += smoothstep(0.08, -0.12, eg) * smoothstep(0.5 + 0.1 * age, 0.78, n) * (1.0 - age * 0.75) * (k == 0 ? 0.12 : 0.28);
    }
  }
  return dens;
}

// Tratto del raggio che passa dentro i riquadri degli uccelli
bool rayBoxes(vec3 ro, vec3 rd, out float tA, out float tB) {
  tA = 1e5;
  tB = -1e5;
  for (int i = 0; i < N; i++) {
    vec4 b = uBird[i];
    float pitch = uAnim[i].x;
    vec3 o = rotLocal(ro - b.xyz, b, pitch);
    vec3 r = rotLocal(rd, b, pitch) + 1e-6;
    vec3 t0 = (BOX_C - BOX_H - 0.6 - o) / r;
    vec3 t1 = (BOX_C + BOX_H + 0.6 - o) / r;
    vec3 lo = min(t0, t1);
    vec3 hi = max(t0, t1);
    float n = max(max(lo.x, lo.y), max(lo.z, 0.0));
    float f = min(min(hi.x, hi.y), hi.z);
    if (f > n) { tA = min(tA, n); tB = max(tB, f); }
  }
  return tB > tA;
}

void main() {
  float aspect = uRes.x / uRes.y;
  vec2 uv = vUv * 2.0 - 1.0;
  vec3 rd = normalize(vec3(uv.x * aspect * uCam.z, uv.y * uCam.z, -1.0));
  float cp = cos(uCam.y), sp = sin(uCam.y);
  rd = vec3(rd.x, rd.y * cp - rd.z * sp, rd.y * sp + rd.z * cp);
  vec3 ro = vec3(0.0, uCam.x, 0.0);

  float col = 0.0;
  float trans = 1.0;
  float tA, tB;
  if (rayBoxes(ro, rd, tA, tB)) {
    float t = tA + STEP * hash(gl_FragCoord.xy);
    for (int s = 0; s < 1200; s++) {
      if (t > tB || trans < 0.02) break;
      vec3 w = ro + rd * t;
      float dmin;
      float dens = density(w, dmin);
      if (dmin > 1.0) { t += dmin - 0.8; continue; }
      if (dens > 0.002) {
        // Luce dall'alto alle spalle: il fumo esposto è più chiaro, quello in ombra più cupo
        float dd;
        float sh = density(w + LIGHT * 0.25, dd) * 0.25 + density(w + LIGHT * 0.6, dd) * 0.35 + density(w + LIGHT * 1.1, dd) * 0.5;
        float lit = exp(-sh * 3.0);
        float lum = mix(0.2, 0.56, lit);
        // Lontano il fumo si perde nel rosso
        float fog = 1.0 - exp(-t * 0.02);
        dens *= 1.0 - 0.45 * fog;
        lum = mix(lum, 0.75, fog * 0.6);
        float a = 1.0 - exp(-dens * SIGMA * STEP);
        col += trans * a * lum;
        trans *= 1.0 - a;
      }
      t += STEP;
    }
  }
  // Su bianco: in "multiply" il bianco sparisce e il grigio scurisce il rosso
  gl_FragColor = vec4(vec3(trans + col), 1.0);
}`
