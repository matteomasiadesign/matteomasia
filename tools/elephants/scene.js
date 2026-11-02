// --- SCENA DEGLI ELEFANTI DI FUMO (rendering offline) ---
// Elefanti di Dalí sulle zampe lunghissime, fatti di fumo, che attraversano un
// deserto in due corsie a profondità fissa: il lontano verso destra, il vicino
// verso sinistra, su curve morbide che li girano di tre quarti senza mai farli
// sparire verso il fondo. Non gira nel sito: render.html la disegna fotogramma
// per fotogramma e tools/capture.mjs ne fa un video in loop (vedi lì come si usa).
//
// Il loop è esatto: in LOOP secondi ogni elefante prende il posto del successivo
// della sua corsia, con lo stesso passo, la stessa proboscide e lo stesso fumo.
//
// Il video esce in scala di grigi su bianco: nella hero va in "multiply", così il
// fumo diventa rosso scuro sul rosso e il bianco sparisce.

export const LOOP = 48 // secondi
export const FPS = 30

export const VARIANTS = {
  landscape: { w: 1280, h: 720, tanV: 0.364 },
  portrait: { w: 720, h: 1280, tanV: 0.533 },
}

// Rig: devono combaciare con le costanti dello shader
const HIP = 9.0 // altezza delle anche da terra
const L1 = 4.56 // femore
const L2 = 4.56 // tibia
const SOFT = 0.2 // ultimo tratto di estensione in cui l'IK rallenta invece di scattare
const HIPS = [
  [0.95, 0.43],
  [0.95, -0.43],
  [-1.0, 0.43],
  [-1.0, -0.43],
]
// Passo laterale come gli elefanti veri: posteriore sx, anteriore sx, posteriore dx, anteriore dx
const PHASE = [0.25, 0.75, 0, 0.5]
const DUTY = 0.65 // parte del passo in cui il piede è a terra
const CYCLE0 = 2.46 // strada fatta in un passo, prima di adattarla al loop
const LIFT = 0.7
const CAM_H = 2.0
const PITCH = 0.16
const MARGIN = 8 // oltre il bordo dell'inquadratura, dove cambiano corsia senza essere visti

// z: profondità, dir: verso, k: elefanti in fila, amp/wl: curva della corsia (m),
// m: giri in un loop di proboscide, coda e orecchie
const LANES = [
  { z: -34, dir: 1, k: 3, amp: 2.2, wl: 26, ph: 1.3, m: [3, 6, 5] },
  { z: -22, dir: -1, k: 2, amp: 2.6, wl: 30, ph: 0, m: [3, 6, 5] },
]

const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10)
const frac = (x) => x - Math.floor(x)

// Corsia: una curva su x con l'ascissa curvilinea tabulata, per camminare a
// velocità costante sulla curva vera
function makeLane(lane, aspect, tanV) {
  const P = 2 * (Math.abs(lane.z) * tanV * aspect + MARGIN)
  const W = (2 * Math.PI) / lane.wl
  const zAt = (u) => lane.z + lane.amp * Math.sin(W * u + lane.ph)
  const du = 0.05
  const u0 = -15
  const us = []
  const ss = []
  let s = 0
  for (let u = u0; u <= P + 15; u += du) {
    if (us.length) s += Math.hypot(du, zAt(u) - zAt(u - du))
    us.push(u)
    ss.push(s)
  }
  const sAt0 = ss[Math.round(-u0 / du)]
  for (let i = 0; i < ss.length; i++) ss[i] -= sAt0
  const A = ss[Math.round((P - u0) / du)]
  const uOf = (sv) => {
    let lo = 0
    let hi = ss.length - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (ss[mid] < sv) lo = mid
      else hi = mid
    }
    const t = (sv - ss[lo]) / (ss[hi] - ss[lo] || 1)
    return us[lo] + (us[hi] - us[lo]) * t
  }
  // Corpo all'ascissa s: posizione e direzione (x avanti)
  const body = (sv) => {
    const u = uOf(sv)
    const dx = lane.dir
    const dz = lane.amp * W * Math.cos(W * u + lane.ph)
    const l = Math.hypot(dx, dz)
    return { x: -lane.dir * (P / 2) + lane.dir * u, z: zAt(u), c: dx / l, s: dz / l }
  }
  const spacing = A / lane.k
  const n = Math.max(1, Math.round(spacing / CYCLE0 - 1 / lane.k))
  // In un loop si fa la strada fino all'elefante dopo: un numero di passi più
  // 1/k, così ognuno eredita anche il passo del successivo
  const cycle = spacing / (n + 1 / lane.k)
  return { ...lane, A, spacing, cycle, stride: cycle * DUTY, v: spacing / LOOP, body }
}

const toWorld = (b, lx, lz) => [b.x + lx * b.c - lz * b.s, b.z + lx * b.s + lz * b.c]
const toLocal = (b, wx, wz) => {
  const dx = wx - b.x
  const dz = wz - b.z
  return [dx * b.c + dz * b.s, dz * b.c - dx * b.s]
}

// IK a due ossa: dato anca e piede trova il ginocchio, piegato in avanti.
// Vicino alla zampa tesa la distanza viene ammorbidita: il ginocchio non scatta
function solveKnee(hip, foot, out, o) {
  let dx = foot[0] - hip[0]
  let dy = foot[1] - hip[1]
  let dz = foot[2] - hip[2]
  const len = Math.hypot(dx, dy, dz) || 1
  dx /= len
  dy /= len
  dz /= len
  const soft = L1 + L2 - SOFT
  const d = len > soft ? soft + SOFT * (1 - Math.exp(-(len - soft) / SOFT)) : len
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d)
  const h = Math.sqrt(Math.max(L1 * L1 - a * a, 0))
  let bx = 1 - dx * dx
  let by = -dy * dx
  let bz = -dz * dx
  const bl = Math.hypot(bx, by, bz) || 1
  out[o] = hip[0] + dx * a + (bx / bl) * h
  out[o + 1] = hip[1] + dy * a + (by / bl) * h
  out[o + 2] = hip[2] + dz * a + (bz / bl) * h
}

export function makeScene(variant) {
  const { w, h, tanV } = VARIANTS[variant]
  const lanes = LANES.map((l) => makeLane(l, w / h, tanV))
  const herd = []
  lanes.forEach((lane, li) => {
    for (let j = 0; j < lane.k; j++) herd.push({ lane, li, j })
  })
  const N = herd.length
  const ele = new Float32Array(N * 4)
  const anim = new Float32Array(N * 4)
  const off = new Float32Array(N * 2)
  const knee = new Float32Array(N * 12)
  const foot = new Float32Array(N * 12)

  // Posa di tutta la mandria al tempo t (deterministica: ogni fotogramma da solo)
  const pose = (t) => {
    herd.forEach(({ lane, li, j }, i) => {
      const { A, cycle, stride, k } = lane
      const s = (((lane.v * t + j * lane.spacing) % A) + A) % A
      const b = lane.body(s)
      const gait = s / cycle
      const bob = 0.03 * Math.cos(gait * Math.PI * 4)
      const ang = (m) => (2 * Math.PI * (m + 1 / k) * t) / LOOP + (2 * Math.PI * j) / k + li
      ele.set([b.x, b.z, b.c, b.s], i * 4)
      anim.set([bob, Math.sin(ang(lane.m[0])) * 0.22, Math.sin(ang(lane.m[1])) * 0.25, 0.18 + 0.12 * Math.sin(ang(lane.m[2]))], i * 4)
      off.set([li * 50 + j * 7.3, li * 50 + ((j + 1) % k) * 7.3], i * 2)
      HIPS.forEach(([hx, hz], L) => {
        const p = frac(gait + PHASE[L])
        const sLand = s - p * cycle
        // Dove il piede ha appoggiato all'inizio di questo passo, fermo nel mondo
        const land = (sv) => toWorld(lane.body(sv), hx + stride / 2, hz)
        let wx
        let wz
        let y = 0
        const w0 = land(sLand)
        if (p < DUTY) {
          ;[wx, wz] = w0
        } else {
          // In volo verso il prossimo appoggio: velocità nulla allo stacco e all'arrivo
          const u = (p - DUTY) / (1 - DUTY)
          const w1 = land(sLand + cycle)
          const e = smoother(u)
          wx = w0[0] + (w1[0] - w0[0]) * e
          wz = w0[1] + (w1[1] - w0[1]) * e
          y = 16 * u * u * (1 - u) * (1 - u) * LIFT
        }
        const [lx, lz] = toLocal(b, wx, wz)
        const o = (i * 4 + L) * 3
        foot[o] = lx
        foot[o + 1] = y
        foot[o + 2] = lz
        solveKnee([hx, HIP + bob, hz], [lx, y, lz], knee, o)
      })
    })
    return { ele, anim, off, knee, foot }
  }

  return { N, w, h, tanV, pose, frag: frag(N) }
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
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uCam;      // altezza, inclinazione, tan(fov verticale / 2)
uniform vec4 uEle[N];   // posizione x, z e direzione x, z
uniform vec4 uAnim[N];  // dondolio, proboscide, coda, orecchie
uniform vec2 uOff[N];   // rumore di questo elefante e del successivo (per chiudere il loop)
uniform vec3 uKnee[N * 4];
uniform vec3 uFoot[N * 4];
varying vec2 vUv;

const float LOOP = ${LOOP.toFixed(1)};
const float HIP = ${HIP.toFixed(2)};
const vec3 BOX_C = vec3(0.5, 5.7, 0.0);
const vec3 BOX_H = vec3(3.3, 5.9, 1.8);
const vec3 LIGHT = vec3(-0.37, 0.83, -0.42);
const float SIGMA = 8.0;
const float STEP = 0.04;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
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
// Fumo che scorre all'indietro e sale; a fine loop sfuma nel fumo dell'elefante
// che prende il suo posto, con il contrasto tenuto costante nella dissolvenza
float smoke(vec3 p, vec2 off) {
  vec3 drift = vec3(uTime * 0.3, -uTime * 0.34, 0.0);
  vec3 back = vec3(LOOP * 0.3, -LOOP * 0.34, 0.0);
  float a = uTime / LOOP;
  float n0 = fbm(p + drift + off.x);
  float n1 = fbm(p + drift - back + off.y);
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

// Dal mondo allo spazio dell'elefante: x avanti, y su, z di lato
vec3 toLocal(vec3 w, vec4 e) {
  vec3 d = w - vec3(e.x, 0.0, e.y);
  return vec3(d.x * e.z + d.z * e.w, d.y, d.z * e.z - d.x * e.w);
}

float leg(vec3 p, vec3 h, vec3 k, vec3 f) {
  float d = sdCone(p, h, k, 0.17, 0.085);
  d = min(d, sdCone(p, k, f + vec3(0.0, 0.1, 0.0), 0.085, 0.06));
  d = min(d, length(p - k) - 0.13);
  return min(d, sdEll(p - f - vec3(0.0, 0.08, 0.0), vec3(0.16, 0.1, 0.16)));
}

// Lo stampo dell'elefante, nel suo spazio locale
float shape(vec3 p, vec4 an, vec3 k0, vec3 k1, vec3 k2, vec3 k3, vec3 f0, vec3 f1, vec3 f2, vec3 f3) {
  // Corpo: groppa e spalle fuse in un'unica massa
  vec3 q = p - vec3(0.0, HIP + 0.75 + an.x, 0.0);
  float body = sdEll(q, vec3(1.5, 0.92, 0.88));
  body = smin(body, sdEll(q - vec3(-0.85, 0.05, 0.0), vec3(0.8, 0.88, 0.82)), 0.3);
  body = smin(body, sdEll(q - vec3(0.8, 0.12, 0.0), vec3(0.75, 0.92, 0.84)), 0.3);
  // Gualdrappa e cuscino: un po' più in fuori del corpo
  float el = min(body, max(max(body - 0.07, abs(q.x + 0.05) - 0.95), -0.45 - q.y));
  el = min(el, sdEll(q - vec3(-0.05, 0.98, 0.0), vec3(0.55, 0.14, 0.6)));

  // Testa con la fronte a cupola
  vec3 hq = q - vec3(1.72, 0.3, 0.0);
  el = smin(el, sdEll(hq, vec3(0.58, 0.7, 0.55)), 0.35);
  el = smin(el, sdEll(hq - vec3(0.18, 0.42, 0.0), vec3(0.4, 0.36, 0.42)), 0.2);

  // Proboscide lunga che pende e ondeggia
  float sw = an.y;
  vec3 t0 = vec3(2.05, 0.1, 0.0);
  vec3 t1 = vec3(2.36, -0.75, 0.0);
  vec3 t2 = vec3(2.34 + sw * 0.3, -1.6, sw * 0.4);
  vec3 t3 = vec3(2.2 + sw * 0.6, -2.35, sw);
  vec3 t4 = vec3(2.4 + sw * 0.8, -2.72, sw * 1.2);
  float trunk = sdCone(q, t0, t1, 0.32, 0.25);
  trunk = min(trunk, sdCone(q, t1, t2, 0.25, 0.18));
  trunk = min(trunk, sdCone(q, t2, t3, 0.18, 0.13));
  trunk = min(trunk, sdCone(q, t3, t4, 0.13, 0.09));
  el = smin(el, trunk, 0.15);

  // Zanne e orecchie, simmetriche
  vec3 m = vec3(q.xy, abs(q.z));
  float tusk = sdCone(m, vec3(2.0, -0.2, 0.28), vec3(2.55, -0.62, 0.36), 0.09, 0.06);
  tusk = min(tusk, sdCone(m, vec3(2.55, -0.62, 0.36), vec3(2.95, -0.42, 0.34), 0.06, 0.03));
  el = min(el, tusk);
  vec3 eq = m - vec3(1.35, 0.25, 0.58);
  float ca = cos(an.w), sa = sin(an.w);
  eq.xz = vec2(ca * eq.x - sa * eq.z, sa * eq.x + ca * eq.z);
  el = smin(el, sdEll(eq, vec3(0.52, 0.74, 0.08)), 0.08);

  // Coda con il ciuffo
  vec3 te = vec3(-1.85, -1.0, an.z);
  el = min(el, sdCone(q, vec3(-1.72, 0.25, 0.0), te, 0.07, 0.045));
  el = min(el, sdEll(q - te + vec3(0.0, 0.12, 0.0), vec3(0.1, 0.2, 0.1)));

  // Zampe: anca, ginocchio (dal rig) e piede
  float y = HIP + an.x;
  float legs = leg(p, vec3(0.95, y, 0.43), k0, f0);
  legs = min(legs, leg(p, vec3(0.95, y, -0.43), k1, f1));
  legs = min(legs, leg(p, vec3(-1.0, y, 0.43), k2, f2));
  legs = min(legs, leg(p, vec3(-1.0, y, -0.43), k3, f3));
  return smin(el, legs, 0.2);
}

// Densità del fumo in un punto del mondo; dmin serve a saltare il vuoto
float density(vec3 w, out float dmin) {
  dmin = 1e5;
  float dens = 0.0;
  for (int i = 0; i < N; i++) {
    vec3 p = toLocal(w, uEle[i]);
    float bb = sdBox(p - BOX_C, BOX_H);
    if (bb > 0.9) { dmin = min(dmin, bb); continue; }
    float d = shape(p, uAnim[i], uKnee[i * 4], uKnee[i * 4 + 1], uKnee[i * 4 + 2], uKnee[i * 4 + 3],
                    uFoot[i * 4], uFoot[i * 4 + 1], uFoot[i * 4 + 2], uFoot[i * 4 + 3]);
    dmin = min(dmin, d);
    if (d > 0.7) continue;
    float n = smoke(p, uOff[i]);
    // Sagoma piena con il bordo sfilacciato, e sbuffi che si staccano
    float e = d - (n - 0.5) * 0.3;
    dens += smoothstep(0.08, -0.1, e) * (0.75 + 0.5 * n);
    dens += smoothstep(0.66, 0.82, n) * smoothstep(0.55, 0.05, d) * 0.6;
  }
  return dens;
}

// Tratto del raggio che passa dentro i riquadri degli elefanti
bool rayBoxes(vec3 ro, vec3 rd, out float tA, out float tB) {
  tA = 1e5;
  tB = -1e5;
  for (int i = 0; i < N; i++) {
    vec4 e = uEle[i];
    vec3 o = toLocal(ro, e);
    vec3 r = vec3(rd.x * e.z + rd.z * e.w, rd.y, rd.z * e.z - rd.x * e.w) + 1e-6;
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
    for (int s = 0; s < 600; s++) {
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
        // Lontano il fumo si perde nel rosso; vicino al terreno lo mangia la nebbia
        float fog = 1.0 - exp(-t * 0.02);
        // (la nebbia gira in tondo nel rumore: torna uguale a fine loop)
        float lp = uTime / LOOP * 6.2832;
        float mist = exp(-max(w.y, 0.0) * 0.5) * (0.5 + 0.5 * noise(vec2(w.x * 0.35 + 3.0 * cos(lp), w.y * 0.5 + 3.0 * sin(lp))));
        dens *= (1.0 - 0.45 * fog) * (1.0 - 0.55 * mist);
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
