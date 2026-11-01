// --- FUMO COME FLUIDO VERO ---
// Simulazione di un fluido incomprimibile sulla GPU (il metodo "stable
// fluids" dei film): l'aria ha una velocità in ogni punto, il fumo è un
// colore trasportato da quell'aria. A ogni frame:
//   1. i frammenti delle lettere rilasciano fumo e calore (la "maschera")
//   2. il calore spinge l'aria verso l'alto; il cursore attira il fumo
//   3. i vortici piccoli vengono rinforzati (le volute del fumo)
//   4. l'aria viene resa incomprimibile (pressione), così si avvolge invece
//      di ammassarsi
//   5. velocità, fumo e calore vengono trasportati dall'aria e si dissipano
// Il fumo sta nel canale rosso della texture, il calore nel verde: il calore
// si disperde prima, quindi il fumo sale veloce appena nato e poi rallenta.

const VERT = `
precision highp float;
attribute vec2 aPos;
uniform vec2 texelSize;
varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;
void main() {
  vUv = aPos * 0.5 + 0.5;
  vL = vUv - vec2(texelSize.x, 0.0);
  vR = vUv + vec2(texelSize.x, 0.0);
  vT = vUv + vec2(0.0, texelSize.y);
  vB = vUv - vec2(0.0, texelSize.y);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`

const HEAD = `
precision highp float;
precision highp sampler2D;
varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;
`

const NOISE = `
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
`

const SHADERS = {
  // Moltiplica una texture (per svuotarla o smorzare la pressione)
  scale: `${HEAD}
uniform sampler2D uTexture;
uniform float value;
void main() { gl_FragColor = value * texture2D(uTexture, vUv); }`,

  // I frammenti che si staccano dalle lettere (la maschera) rilasciano fumo,
  // un po' irregolare: un rumore che scorre verso l'alto lo fa uscire a ciocche
  emit: `${HEAD}${NOISE}
uniform sampler2D uTarget;
uniform sampler2D uMask;
uniform float uAspect;
uniform float uRate;
uniform float uBurst;
uniform float uTime;
void main() {
  vec4 base = texture2D(uTarget, vUv);
  float m = texture2D(uMask, vUv).a;
  vec2 p = vUv * vec2(uAspect, 1.0);
  float n = noise(p * 90.0 + vec2(0.0, -uTime * 2.5)) * 0.6 + noise(p * 31.0 + vec2(uTime * 0.4, -uTime)) * 0.4;
  float strands = smoothstep(0.42, 0.78, n);
  float add = m * uRate * (0.45 + 0.8 * strands);
  // L'esplosione: tutto il glifo diventa nube, poco calda (resta sospesa)
  float cloud = m * uBurst * (0.6 + 0.8 * n);
  gl_FragColor = base + vec4(add + cloud, add * 1.4 + cloud * 0.25, 0.0, 0.0);
}`,

  // Spinte: il calore fa salire l'aria; il cursore attira il fumo e lo fa
  // girare attorno a sé. La forza pesa per la densità del fumo: una spinta
  // uniforme verso un punto verrebbe cancellata dall'incomprimibilità
  forces: `${HEAD}
uniform sampler2D uVelocity;
uniform sampler2D uDye;
uniform vec2 uPointer;
uniform float uAspect;
uniform float uBuoyancy;
uniform float uAttract;
uniform float uRadius;
uniform float dt;
void main() {
  vec2 vel = texture2D(uVelocity, vUv).xy;
  vec4 s = texture2D(uDye, vUv);
  vel.y += uBuoyancy * s.g * dt;
  vec2 d = (uPointer - vUv) * vec2(uAspect, 1.0);
  float dist = length(d);
  vec2 dir = d / (dist + 0.0001);
  // Vicino al cursore l'attrazione cala e resta la rotazione: il fumo gli
  // gira attorno invece di ammassarsi in un punto
  float pull = 1.0 - smoothstep(0.0, uRadius, dist);
  float inner = smoothstep(0.03, 0.16, dist);
  vec2 f = dir * inner + vec2(-dir.y, dir.x) * 0.6 * (1.0 - inner * 0.5);
  vel += f * pull * uAttract * min(s.r, 1.2) * dt;
  gl_FragColor = vec4(vel, 0.0, 1.0);
}`,

  // Spruzzo gaussiano (la mano che muove l'aria, la spinta dell'esplosione)
  splat: `${HEAD}
uniform sampler2D uTarget;
uniform float aspectRatio;
uniform vec3 color;
uniform vec2 point;
uniform float radius;
void main() {
  vec2 p = vUv - point;
  p.x *= aspectRatio;
  vec3 splat = exp(-dot(p, p) / radius) * color;
  gl_FragColor = vec4(texture2D(uTarget, vUv).xyz + splat, 1.0);
}`,

  advect: `${HEAD}
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 texelSize;
uniform float dt;
uniform vec4 dissipation;
void main() {
  vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
  gl_FragColor = texture2D(uSource, coord) / (1.0 + dissipation * dt);
}`,

  divergence: `${HEAD}
uniform sampler2D uVelocity;
void main() {
  float L = texture2D(uVelocity, vL).x;
  float R = texture2D(uVelocity, vR).x;
  float T = texture2D(uVelocity, vT).y;
  float B = texture2D(uVelocity, vB).y;
  vec2 C = texture2D(uVelocity, vUv).xy;
  if (vL.x < 0.0) { L = -C.x; }
  if (vR.x > 1.0) { R = -C.x; }
  if (vB.y < 0.0) { B = -C.y; }
  gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`,

  curl: `${HEAD}
uniform sampler2D uVelocity;
void main() {
  float L = texture2D(uVelocity, vL).y;
  float R = texture2D(uVelocity, vR).y;
  float T = texture2D(uVelocity, vT).x;
  float B = texture2D(uVelocity, vB).x;
  gl_FragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}`,

  vorticity: `${HEAD}
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform float curl;
uniform float dt;
void main() {
  float L = texture2D(uCurl, vL).x;
  float R = texture2D(uCurl, vR).x;
  float T = texture2D(uCurl, vT).x;
  float B = texture2D(uCurl, vB).x;
  float C = texture2D(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 0.0001;
  force *= curl * C;
  force.y *= -1.0;
  vec2 vel = texture2D(uVelocity, vUv).xy + force * dt;
  // Tetto alla velocità: il fumo non deve mai "esplodere" numericamente
  gl_FragColor = vec4(clamp(vel, -120.0, 120.0), 0.0, 1.0);
}`,

  pressure: `${HEAD}
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
void main() {
  float L = texture2D(uPressure, vL).x;
  float R = texture2D(uPressure, vR).x;
  float T = texture2D(uPressure, vT).x;
  float B = texture2D(uPressure, vB).x;
  float div = texture2D(uDivergence, vUv).x;
  gl_FragColor = vec4((L + R + B + T - div) * 0.25, 0.0, 0.0, 1.0);
}`,

  gradient: `${HEAD}
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
void main() {
  float L = texture2D(uPressure, vL).x;
  float R = texture2D(uPressure, vR).x;
  float T = texture2D(uPressure, vT).x;
  float B = texture2D(uPressure, vB).x;
  vec2 vel = texture2D(uVelocity, vUv).xy - vec2(R - L, T - B);
  gl_FragColor = vec4(vel, 0.0, 1.0);
}`,

  // A schermo: nero caldo traslucido, più denso dove c'è più fumo, con un
  // riflesso caldo appena accennato sui bordi alti (luce da sopra)
  display: `${HEAD}
uniform sampler2D uDye;
uniform vec2 uDyeTexel;
uniform float uDensity;
void main() {
  float d = texture2D(uDye, vUv).r;
  float a = 1.0 - exp(-d * uDensity);
  if (a < 0.003) { gl_FragColor = vec4(0.0); return; }
  float up = texture2D(uDye, vUv + vec2(0.0, uDyeTexel.y * 2.5)).r;
  float rim = clamp((d - up) * 2.5, 0.0, 1.0) * (1.0 - a);
  vec3 col = mix(vec3(0.086, 0.051, 0.047), vec3(1.0, 0.77, 0.67), rim * 0.3);
  gl_FragColor = vec4(col * a, a);
}`,
}

export const FLUID = {
  SIM: 128, // risoluzione della velocità (lato corto)
  DYE: 512, // risoluzione del fumo (lato corto, al massimo)
  PRESSURE_ITER: 20,
  CURL: 12, // forza delle volute
  MAX_DT: 1 / 40, // passo massimo: su un dispositivo lento va al rallentatore, ma resta stabile
  BUOYANCY: 38, // spinta del calore verso l'alto
  ATTRACT: 34, // forza del magnete verso il cursore
  RADIUS: 0.55, // raggio del magnete (in altezze della hero)
  VEL_DISSIPATION: 0.35,
  DYE_DISSIPATION: 0.42, // quanto in fretta il fumo svanisce
  HEAT_DISSIPATION: 1.3, // quanto in fretta si raffredda
  DENSITY: 1.7, // opacità a schermo
}

// Crea la simulazione su una canvas; null se il dispositivo non la regge
export function createSmokeFluid(canvas) {
  const params = { alpha: true, depth: false, stencil: false, antialias: false, premultipliedAlpha: true, preserveDrawingBuffer: false }
  let gl = canvas.getContext('webgl2', params)
  const isGL2 = !!gl
  if (!gl) gl = canvas.getContext('webgl', params)
  if (!gl) return null

  let halfType
  if (isGL2) {
    if (!gl.getExtension('EXT_color_buffer_float')) return null
    halfType = gl.HALF_FLOAT
  } else {
    const ext = gl.getExtension('OES_texture_half_float')
    if (!ext || !gl.getExtension('OES_texture_half_float_linear')) return null
    halfType = ext.HALF_FLOAT_OES
  }
  const internal = isGL2 ? gl.RGBA16F : gl.RGBA

  const compile = (type, src) => {
    const s = gl.createShader(type)
    gl.shaderSource(s, src)
    gl.compileShader(s)
    return s
  }
  const vert = compile(gl.VERTEX_SHADER, VERT)
  // Prima si avviano tutti i link, poi si controllano: chiedere lo stato subito
  // dopo ogni link costringeva il driver a compilarli uno alla volta, in attesa
  const linked = Object.entries(SHADERS).map(([name, src]) => {
    const prog = gl.createProgram()
    gl.attachShader(prog, vert)
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, src))
    gl.bindAttribLocation(prog, 0, 'aPos')
    gl.linkProgram(prog)
    return [name, prog]
  })
  const programs = {}
  for (const [name, prog] of linked) {
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null
    const uniforms = {}
    const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS)
    for (let i = 0; i < n; i++) {
      const name = gl.getActiveUniform(prog, i).name
      uniforms[name] = gl.getUniformLocation(prog, name)
    }
    programs[name] = { prog, u: uniforms }
  }

  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  gl.enableVertexAttribArray(0)
  gl.disable(gl.BLEND)

  const textures = []
  const framebuffers = []
  const createFBO = (w, h) => {
    gl.activeTexture(gl.TEXTURE0)
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, gl.RGBA, halfType, null)
    const fbo = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    gl.viewport(0, 0, w, h)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    textures.push(tex)
    framebuffers.push(fbo)
    return {
      fbo, w, h, tx: 1 / w, ty: 1 / h,
      attach(id) {
        gl.activeTexture(gl.TEXTURE0 + id)
        gl.bindTexture(gl.TEXTURE_2D, tex)
        return id
      },
    }
  }
  const createDouble = (w, h) => {
    const d = { read: createFBO(w, h), write: createFBO(w, h) }
    d.swap = () => { const t = d.read; d.read = d.write; d.write = t }
    return d
  }

  // Maschera delle lettere calde, disegnata dal componente su una canvas 2D
  const maskTex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, maskTex)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4))

  let velocity, dye, pressure, divergence, curlFbo
  let aspect = 1

  const disposeTargets = () => {
    textures.forEach((t) => gl.deleteTexture(t))
    framebuffers.forEach((f) => gl.deleteFramebuffer(f))
    textures.length = 0
    framebuffers.length = 0
  }

  const blit = (target) => {
    if (target) {
      gl.viewport(0, 0, target.w, target.h)
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo)
    } else {
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }
  const use = (name, texel) => {
    const p = programs[name]
    gl.useProgram(p.prog)
    if (texel && p.u.texelSize) gl.uniform2f(p.u.texelSize, texel.tx, texel.ty)
    return p.u
  }
  const res = (n) => (aspect >= 1 ? [Math.round(n * aspect), n] : [n, Math.round(n / aspect)])

  return {
    // Dimensioni della hero in px CSS
    resize(cssW, cssH) {
      aspect = cssW / Math.max(cssH, 1)
      const dyeShort = Math.min(FLUID.DYE, Math.round(Math.min(cssW, cssH) * 0.9))
      const [sw, sh] = res(FLUID.SIM)
      const [dw, dh] = res(dyeShort)
      disposeTargets()
      velocity = createDouble(sw, sh)
      pressure = createDouble(sw, sh)
      divergence = createFBO(sw, sh)
      curlFbo = createFBO(sw, sh)
      dye = createDouble(dw, dh)
      canvas.width = dw
      canvas.height = dh
      return { dyeW: dw, dyeH: dh, pxPerCell: cssH / sh }
    },

    setMask(source) {
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, maskTex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
    },

    // Spruzzo di velocità (in celle al secondo) o di fumo/calore
    splat(x, y, a, b, c, radius, toDye) {
      const target = toDye ? dye : velocity
      const u = use('splat', target.read)
      gl.uniform1i(u.uTarget, target.read.attach(0))
      gl.uniform1f(u.aspectRatio, aspect)
      gl.uniform2f(u.point, x, y)
      gl.uniform3f(u.color, a, b, c)
      gl.uniform1f(u.radius, radius)
      blit(target.write)
      target.swap()
    },

    // s: { time, pointer:[x,y], rate, burst, attract }
    step(dt, s) {
      dt = Math.min(dt, FLUID.MAX_DT)
      let u = use('emit', dye.read)
      gl.uniform1i(u.uTarget, dye.read.attach(0))
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, maskTex)
      gl.uniform1i(u.uMask, 1)
      gl.uniform1f(u.uAspect, aspect)
      gl.uniform1f(u.uRate, s.rate * dt)
      gl.uniform1f(u.uBurst, s.burst)
      gl.uniform1f(u.uTime, s.time)
      blit(dye.write)
      dye.swap()

      u = use('forces', velocity.read)
      gl.uniform1i(u.uVelocity, velocity.read.attach(0))
      gl.uniform1i(u.uDye, dye.read.attach(1))
      gl.uniform2f(u.uPointer, s.pointer[0], s.pointer[1])
      gl.uniform1f(u.uAspect, aspect)
      gl.uniform1f(u.uBuoyancy, FLUID.BUOYANCY)
      gl.uniform1f(u.uAttract, s.attract)
      gl.uniform1f(u.uRadius, FLUID.RADIUS)
      gl.uniform1f(u.dt, dt)
      blit(velocity.write)
      velocity.swap()

      u = use('curl', velocity.read)
      gl.uniform1i(u.uVelocity, velocity.read.attach(0))
      blit(curlFbo)

      u = use('vorticity', velocity.read)
      gl.uniform1i(u.uVelocity, velocity.read.attach(0))
      gl.uniform1i(u.uCurl, curlFbo.attach(1))
      gl.uniform1f(u.curl, FLUID.CURL)
      gl.uniform1f(u.dt, dt)
      blit(velocity.write)
      velocity.swap()

      u = use('divergence', velocity.read)
      gl.uniform1i(u.uVelocity, velocity.read.attach(0))
      blit(divergence)

      u = use('scale', pressure.read)
      gl.uniform1i(u.uTexture, pressure.read.attach(0))
      gl.uniform1f(u.value, 0.8)
      blit(pressure.write)
      pressure.swap()

      u = use('pressure', velocity.read)
      gl.uniform1i(u.uDivergence, divergence.attach(0))
      for (let i = 0; i < FLUID.PRESSURE_ITER; i++) {
        gl.uniform1i(u.uPressure, pressure.read.attach(1))
        blit(pressure.write)
        pressure.swap()
      }

      u = use('gradient', velocity.read)
      gl.uniform1i(u.uPressure, pressure.read.attach(0))
      gl.uniform1i(u.uVelocity, velocity.read.attach(1))
      blit(velocity.write)
      velocity.swap()

      u = use('advect', velocity.read)
      gl.uniform1i(u.uVelocity, velocity.read.attach(0))
      gl.uniform1i(u.uSource, velocity.read.attach(0))
      gl.uniform1f(u.dt, dt)
      gl.uniform4f(u.dissipation, FLUID.VEL_DISSIPATION, FLUID.VEL_DISSIPATION, 0, 0)
      blit(velocity.write)
      velocity.swap()

      gl.uniform1i(u.uVelocity, velocity.read.attach(0))
      gl.uniform1i(u.uSource, dye.read.attach(1))
      gl.uniform4f(u.dissipation, FLUID.DYE_DISSIPATION, FLUID.HEAT_DISSIPATION, 0, 0)
      blit(dye.write)
      dye.swap()
    },

    render() {
      const u = use('display', dye.read)
      gl.uniform1i(u.uDye, dye.read.attach(0))
      gl.uniform2f(u.uDyeTexel, dye.read.tx, dye.read.ty)
      gl.uniform1f(u.uDensity, FLUID.DENSITY)
      blit(null)
    },

    // Svuota tutto (quando il fumo è svanito e il loop si ferma)
    reset() {
      for (const t of [velocity.read, velocity.write, dye.read, dye.write, pressure.read, pressure.write]) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo)
        gl.clear(gl.COLOR_BUFFER_BIT)
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.clear(gl.COLOR_BUFFER_BIT)
    },

    // Niente loseContext(): in sviluppo React rimonta il componente e
    // getContext() restituirebbe lo stesso contesto, ormai perso
    dispose() {
      disposeTargets()
      gl.deleteTexture(maskTex)
      gl.deleteBuffer(buf)
      Object.values(programs).forEach((p) => gl.deleteProgram(p.prog))
    },
  }
}
