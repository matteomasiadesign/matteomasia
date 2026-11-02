// --- SCENA DEL CORVO DI FUMO (rendering offline) ---
// Un corvo fatto di fumo, posato su un ramo secco che entra dal bordo destro,
// nel vuoto tra i contatti e il footer. Sta quasi fermo come un corvo vero:
// respira, gira la testa a scatti (a un certo punto guarda chi legge), piega
// la testa di lato, gracchia due volte sporgendosi in avanti con uno sbuffo
// dal becco, scuote le ali. Il ramo ondeggia appena e si piega quando gracchia.
// Dal corvo e dal ramo salgono piano sbuffi di fumo, come dagli altri animali.
// Non gira nel sito: render.html la disegna fotogramma per fotogramma e
// tools/capture.mjs ne fa un video in loop, come per gli elefanti e gli uccelli.
//
// Il loop è esatto: ogni movimento torna alla posa iniziale prima di LOOP.
// Il video esce in scala di grigi su bianco: nel footer va in "multiply".
//
// Unità: il corvo è lungo circa 0.6 (becco-coda), i piedi sono nell'origine,
// sul dorso del ramo. La camera guarda dritto da lontano (quasi un tele).

export const LOOP = 20 // secondi
export const FPS = 30

// Due strisce: larga per desktop e tablet, quasi quadrata per i telefoni.
// fh: altezza inquadrata, fx/fy: dove stanno i piedi del corvo (frazione da
// sinistra e dall'alto)
export const VARIANTS = {
  landscape: { w: 1600, h: 480, fh: 1.05, fx: 0.68, fy: 0.62 },
  portrait: { w: 720, h: 540, fh: 1.45, fx: 0.6, fy: 0.6 },
}

const CAM_D = 10 // distanza della camera

const TAU = Math.PI * 2
const clamp01 = (x) => Math.min(Math.max(x, 0), 1)
const ease = (x) => {
  x = clamp01(x)
  return x * x * (3 - 2 * x)
}
// Sale in rise secondi, resta hold, scende in fall
const bump = (t, t0, rise, hold, fall) => ease((t - t0) / rise) * (1 - ease((t - t0 - rise - hold) / fall))

// Valore a scatti, come la testa degli uccelli: resta fermo e cambia in dur
// secondi a ogni chiave [t, valore]. L'ultima chiave torna al valore di t = 0
const steps = (keys, t, dur = 0.16) => {
  let v = keys[keys.length - 1][1]
  for (const [tk, vk] of keys) if (t >= tk) v = v + (vk - v) * ease((t - tk) / dur)
  return v
}

// Gira la testa: 0 di profilo (guarda a sinistra), + verso chi guarda
const YAW = [[0, 0], [2.2, 0.75], [4.6, 0.15], [6.8, -0.35], [7.9, 0], [13.0, 0.55], [14.6, 0.2], [16.2, -0.25], [18.4, 0]]
// Alza (+) o abbassa il becco
const PITCH = [[0, 0], [2.2, 0.05], [4.6, -0.25], [6.8, 0.05], [7.9, 0], [16.2, 0.25], [18.4, 0]]
// Piega la testa di lato, curioso
const ROLL = [[0, 0], [3.3, 0.3], [4.3, 0], [16.9, -0.2], [17.8, 0]]
const CAWS = [8.2, 9.3] // gracchiate
const PUFF = 1.8 // durata dello sbuffo dal becco

export function makeScene(variant) {
  const { w, h, fh, fx, fy } = VARIANTS[variant]
  const fw = fh * (w / h)
  const cam = [-(fx - 0.5) * fw, (fy - 0.5) * fh, fh / 2 / CAM_D]
  const head = new Float32Array(4)
  const body = new Float32Array(4)
  const misc = new Float32Array(4)

  // Posa al tempo t (deterministica: ogni fotogramma da solo)
  const pose = (t) => {
    let caw = 0
    let lean = 0
    let recoil = 0
    CAWS.forEach((tc) => {
      caw += bump(t, tc, 0.1, 0.22, 0.4)
      lean += bump(t, tc - 0.08, 0.15, 0.25, 0.5)
      // Il ramo si piega sotto la spinta e oscilla fino a fermarsi
      if (t > tc) recoil += Math.exp(-3 * (t - tc)) * Math.sin(TAU * 2.5 * (t - tc))
    })
    const shake = bump(t, 14.9, 0.15, 0.4, 0.35)
    const flick = bump(t, 5.0, 0.08, 0.05, 0.25) + bump(t, 12.2, 0.08, 0.05, 0.25)

    head.set([
      steps(YAW, t),
      steps(PITCH, t) - 0.12 * caw,
      steps(ROLL, t, 0.3),
      0.5 * caw, // becco aperto
    ])
    body.set([
      0.22 * lean, // si sporge in avanti
      1 + 0.012 * Math.sin((TAU * 8 * t) / LOOP), // respiro
      0.35 * caw + 0.2 * flick, // coda che si alza
      0.3 * caw + shake * (0.4 + 0.12 * Math.sin(TAU * 7 * t)), // ali che si staccano dal corpo
    ])
    const age = (tc) => (t - tc - 0.1) / PUFF
    misc.set([
      0.007 * Math.sin((TAU * 2 * t) / LOOP) + 0.008 * recoil + 0.003 * shake, // ondeggiare del ramo
      caw, // collo allungato
      age(CAWS[0]),
      age(CAWS[1]),
    ])
    return { head, body, misc }
  }

  return { w, h, cam, pose, frag }
}

export const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`

const frag = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uCam;   // centro dell'inquadratura x, y e tan(fov verticale / 2)
uniform vec4 uHead;  // giro, su/giù, piega di lato, becco aperto
uniform vec4 uBody;  // sporgersi, respiro, coda alzata, ali staccate
uniform vec4 uMisc;  // ondeggiare del ramo, collo allungato, età dei due sbuffi
varying vec2 vUv;

const float LOOP = ${LOOP.toFixed(1)};
const float CAM_D = ${CAM_D.toFixed(1)};
const float HEADING = 0.3; // il corpo girato appena verso chi guarda
const vec2 PIVOT = vec2(2.3, -0.42); // dove il ramo esce dal bordo: ci ruota attorno
const vec3 LIGHT = vec3(-0.45, 0.8, 0.4);
const float SIGMA = 30.0;
const float STEP = 0.008;
const float K = 14.0; // grana del fumo

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
// Fumo che scorre con velocità v (in unità del rumore al secondo); a fine loop
// sfuma in se stesso, con il contrasto tenuto costante nella dissolvenza
float smoke(vec3 p, vec3 v) {
  float a = uTime / LOOP;
  float n0 = fbm(p - v * uTime);
  float n1 = fbm(p - v * uTime + v * LOOP);
  return 0.5 + (mix(n0, n1, a) - 0.5) / sqrt(a * a + (1.0 - a) * (1.0 - a));
}

vec2 rot(vec2 v, float a) {
  float c = cos(a), s = sin(a);
  return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
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
// Capsula che si assottiglia da r1 a r2
float sdCap(vec3 p, vec3 a, vec3 b, float r1, float r2) {
  vec3 pa = p - a;
  vec3 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - mix(r1, r2, h);
}
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
float slab(float d2, float y, float th) {
  vec2 w = vec2(d2, abs(y) - th);
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0));
}

// Ramo secco: sale da destra verso sinistra, con qualche rametto e la punta sottile
float branch(vec3 p) {
  float d = sdCap(p, vec3(2.3, -0.42, -0.05), vec3(1.25, -0.19, -0.02), 0.062, 0.05);
  d = smin(d, sdCap(p, vec3(1.25, -0.19, -0.02), vec3(0.45, -0.075, 0.0), 0.05, 0.04), 0.015);
  d = smin(d, sdCap(p, vec3(0.45, -0.075, 0.0), vec3(0.0, -0.036, 0.0), 0.04, 0.036), 0.015);
  d = smin(d, sdCap(p, vec3(0.0, -0.036, 0.0), vec3(-0.75, 0.0, 0.02), 0.036, 0.026), 0.015);
  d = smin(d, sdCap(p, vec3(-0.75, 0.0, 0.02), vec3(-1.45, 0.1, 0.05), 0.026, 0.015), 0.015);
  d = smin(d, sdCap(p, vec3(-1.45, 0.1, 0.05), vec3(-2.0, 0.28, 0.06), 0.015, 0.004), 0.012);
  d = smin(d, sdCap(p, vec3(1.25, -0.19, -0.02), vec3(0.95, 0.22, -0.08), 0.026, 0.009), 0.025);
  d = min(d, sdCap(p, vec3(0.95, 0.22, -0.08), vec3(0.86, 0.45, -0.1), 0.009, 0.003));
  d = smin(d, sdCap(p, vec3(1.7, -0.3, -0.04), vec3(1.85, 0.12, 0.0), 0.024, 0.005), 0.025);
  d = smin(d, sdCap(p, vec3(-0.75, 0.0, 0.02), vec3(-1.05, -0.3, 0.04), 0.017, 0.004), 0.015);
  d = smin(d, sdCap(p, vec3(-1.45, 0.1, 0.05), vec3(-1.62, 0.42, 0.03), 0.011, 0.003), 0.012);
  return d;
}

// Centro della testa, nello spazio del corvo già sporto in avanti
vec3 headCenter() {
  return vec3(0.2 + 0.05 * uMisc.y, 0.44 - 0.03 * uMisc.y, 0.0);
}

// Il corvo: x avanti (il becco), y su, z di lato; i piedi nell'origine
float crow(vec3 p) {
  p.xy = rot(p.xy, uBody.x);
  float br = uBody.y;
  // Corpo lungo e inclinato, petto robusto ma non tondo
  vec3 b = p - vec3(-0.03, 0.26, 0.0);
  b.xy = rot(b.xy, -0.5);
  float d = sdEll(b, vec3(0.27, 0.13, 0.12) * br);
  d = smin(d, sdEll(p - vec3(0.07, 0.25, 0.0), vec3(0.13, 0.115, 0.105) * br), 0.05);
  // Cosce piumate, zampe robuste, dita sul ramo
  vec3 m = vec3(p.xy, abs(p.z));
  d = smin(d, sdEll(m - vec3(-0.01, 0.13, 0.04), vec3(0.055, 0.06, 0.04)), 0.035);
  float leg = sdCap(m, vec3(0.0, 0.1, 0.035), vec3(0.015, 0.008, 0.03), 0.014, 0.011);
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    leg = min(leg, sdCap(m, vec3(0.015, 0.006, 0.03), vec3(0.075, -0.004, 0.018 + fk * 0.012), 0.008, 0.004));
  }
  leg = min(leg, sdCap(m, vec3(0.015, 0.006, 0.03), vec3(-0.05, -0.004, 0.03), 0.008, 0.004));
  d = min(d, leg);

  // Collo e testa
  vec3 hc = headCenter();
  d = smin(d, sdCap(p, vec3(0.08, 0.33, 0.0), hc - vec3(0.03, 0.02, 0.0), 0.088, 0.07), 0.05);
  vec3 h = p - hc;
  float cy = cos(uHead.x), sy = sin(uHead.x);
  h = vec3(h.x * cy + h.z * sy, h.y, h.z * cy - h.x * sy);
  h.xy = rot(h.xy, -uHead.y);
  h.yz = rot(h.yz, -uHead.z);
  // Testa allungata, con la fronte piatta che scende dritta nel becco
  float hd = sdEll(h, vec3(0.105, 0.078, 0.074));
  hd = smin(hd, sdEll(h - vec3(0.05, 0.012, 0.0), vec3(0.075, 0.055, 0.06)), 0.03);
  // Gola arruffata
  hd = smin(hd, sdEll(h - vec3(0.01, -0.06, 0.0), vec3(0.08, 0.05, 0.06)), 0.04);
  // Becco da corvo: lungo quanto la testa e grosso alla base; la mascella si alza
  // poco, la mandibola scende; la punta curva in giù
  vec3 u = h - vec3(0.06, 0.0, 0.0);
  u.xy = rot(u.xy, 0.3 * uHead.w);
  u.y += 1.1 * pow(max(u.x - 0.08, 0.0), 2.0);
  float beak = sdCap(vec3(u.xy, u.z * 1.5), vec3(0.0, 0.012, 0.0), vec3(0.21, -0.016, 0.0), 0.05, 0.009);
  vec3 lo = h - vec3(0.06, -0.022, 0.0);
  lo.xy = rot(lo.xy, uHead.w);
  beak = min(beak, sdCap(vec3(lo.xy, lo.z * 1.5), vec3(0.0, 0.0, 0.0), vec3(0.18, -0.008, 0.0), 0.03, 0.006));
  hd = smin(hd, beak, 0.03);
  d = smin(d, hd, 0.03);

  // Coda lunga, chiusa, che scende dietro il ramo
  vec3 t = p - vec3(-0.22, 0.16, 0.0);
  t.xy = rot(t.xy, -(3.52 - uBody.z));
  float tail = sdQuad(t.xz, vec2(0.0, 0.04), vec2(0.37, 0.06), vec2(0.37, -0.06), vec2(0.0, -0.04));
  tail = max(tail, length(t.xz - vec2(0.05, 0.0)) - 0.33);
  d = smin(d, slab(tail, t.y, 0.012) - 0.01, 0.04);

  // Ali chiuse sui fianchi, le remiganti incrociate sopra la coda;
  // quando si staccano ruotano sulla spalla verso l'esterno
  vec3 v = m - vec3(0.1, 0.33, 0.08);
  v.yz = rot(v.yz, uBody.w);
  v.xy = rot(v.xy, -0.25 * uBody.w);
  v.z *= 2.2;
  float wing = sdCap(v, vec3(0.0), vec3(-0.55, -0.24, -0.06), 0.09, 0.012) / 2.2;
  d = smin(d, wing, 0.03);
  return d;
}

// Densità del fumo in un punto del mondo; dmin serve a saltare il vuoto
float density(vec3 w, out float dmin, out float ink) {
  // Ramo e corvo ondeggiano insieme attorno al punto dove il ramo esce
  vec3 q = w;
  q.xy = PIVOT + rot(q.xy - PIVOT, -uMisc.x);
  float d = branch(q);
  float ch = cos(HEADING), sh = sin(HEADING);
  vec3 l = vec3(-q.x * ch + q.z * sh, q.y, q.x * sh + q.z * ch);
  float bound = length(l - vec3(0.02, 0.28, 0.0)) - 0.66;
  float dc = bound > 0.2 ? bound : crow(l);
  // Quanto il punto è corvo invece che ramo: il corvo è più scuro
  ink = smoothstep(0.02, -0.02, dc - d);
  d = min(d, dc);

  // Sbuffi dal becco quando gracchia: escono in avanti, salgono, si allargano e svaniscono
  float puff = 0.0;
  float dp = 1e5;
  vec3 tip = headCenter() + vec3(0.24, -0.02, 0.0);
  for (int k = 0; k < 2; k++) {
    float a = k == 0 ? uMisc.z : uMisc.w;
    if (a > 0.0 && a < 1.0) {
      vec3 c = tip + vec3(0.32 * a, 0.12 * a, 0.0);
      float r = 0.03 + 0.12 * a;
      vec3 lc = l;
      lc.xy = rot(lc.xy, uBody.x);
      float dd = length(lc - c) - r;
      dp = min(dp, dd);
      puff += smoothstep(0.0, -r * 0.6, dd) * pow(1.0 - a, 2.0) * smoothstep(0.0, 0.1, a);
    }
  }

  dmin = min(d, dp);
  if (dmin > 0.25) return 0.0;
  float n = smoke(q * K, vec3(0.1, 0.35, 0.0));
  // Sagoma piena e leggibile con il bordo sfilacciato
  float e = d - (n - 0.5) * 0.028;
  float dens = smoothstep(0.01, -0.012, e) * (1.2 + 0.6 * n);
  // Sbuffi che si staccano e salgono piano
  float up = smoke(q * K * 0.45 + 3.1, vec3(0.05, 0.6, 0.0));
  dens += smoothstep(0.63, 0.85, up) * smoothstep(0.16, 0.0, d) * 0.5;
  if (puff > 0.0) dens += puff * smoothstep(0.42, 0.72, n) * 1.6;
  return dens;
}

void main() {
  float aspect = uRes.x / uRes.y;
  vec2 uv = vUv * 2.0 - 1.0;
  vec3 rd = normalize(vec3(uv.x * aspect * uCam.z, uv.y * uCam.z, -1.0));
  vec3 ro = vec3(uCam.xy, CAM_D);

  float col = 0.0;
  float trans = 1.0;
  // Tutta la scena sta in una fetta sottile attorno a z = 0
  float tA = (CAM_D - 0.5) / -rd.z;
  float tB = (CAM_D + 0.5) / -rd.z;
  float t = tA + STEP * hash(gl_FragCoord.xy);
  vec3 L = normalize(LIGHT);
  for (int s = 0; s < 400; s++) {
    if (t > tB || trans < 0.02) break;
    vec3 w = ro + rd * t;
    float dmin, ink;
    float dens = density(w, dmin, ink);
    if (dmin > 0.3) { t += dmin - 0.25; continue; }
    if (dens > 0.002) {
      // Luce dall'alto a sinistra: il fumo esposto è più chiaro, quello in ombra più cupo
      float dd, ii;
      float sh = density(w + L * 0.03, dd, ii) * 0.25 + density(w + L * 0.07, dd, ii) * 0.35 + density(w + L * 0.13, dd, ii) * 0.5;
      float lit = exp(-sh * 2.2);
      float lum = mix(mix(0.16, 0.52, lit), mix(0.04, 0.34, lit), ink);
      float a = 1.0 - exp(-dens * SIGMA * STEP);
      col += trans * a * lum;
      trans *= 1.0 - a;
    }
    t += STEP;
  }
  // Su bianco: in "multiply" il bianco sparisce e il grigio scurisce il fondo
  gl_FragColor = vec4(vec3(trans + col), 1.0);
}`
