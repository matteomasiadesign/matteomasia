// --- CATTURA DEI VIDEO DI FUMO (elefanti della hero, uccelli dei servizi, corvo del footer) ---
// Apre il render.html della scena in Edge (con la GPU), prende i fotogrammi uno
// per uno e li passa a ffmpeg, che ne fa i video in loop per public/video/.
//
// Serve il dev server acceso (npm run dev) e, fuori dal progetto, i due pacchetti:
//   npm i puppeteer-core ffmpeg-static   (in una cartella qualsiasi)
//   CAP_MODULES=<quella cartella>/ node tools/capture.mjs <elephants|birds|crow> [landscape|portrait] [porta]
// Con PREVIEW=12,600,1100 salva solo quei fotogrammi in PNG, per controllare.

import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(process.env.CAP_MODULES ? join(process.env.CAP_MODULES, 'x.js') : import.meta.url)
const puppeteer = require('puppeteer-core')
const ffmpeg = require('ffmpeg-static')

const scene = process.argv[2] || 'elephants'
const variant = process.argv[3] || 'landscape'
const port = process.argv[4] || '5173'
const { LOOP, FPS } = await import(`./${scene}/scene.js`)
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'public', 'video')
const tmp = process.env.CAP_TMP || join(root, 'tools', scene, '.frames')
mkdirSync(out, { recursive: true })
mkdirSync(tmp, { recursive: true })

const edge = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync)
const browser = await puppeteer.launch({
  executablePath: process.env.BROWSER || edge,
  headless: 'new',
  protocolTimeout: 600000,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--disable-gpu-watchdog'],
})
const page = await browser.newPage()
await page.goto(`http://localhost:${port}/tools/${scene}/render.html?v=${variant}`, { waitUntil: 'load' })
await page.waitForFunction('window.frame')
const { w, h } = await page.evaluate('window.sceneInfo')
console.log('GPU:', await page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl')
  const ext = gl.getExtension('WEBGL_debug_renderer_info')
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'sconosciuta'
}))

const run = (args, input) =>
  new Promise((ok, ko) => {
    const p = spawn(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: [input ? 'pipe' : 'ignore', 'inherit', 'inherit'] })
    p.on('exit', (c) => (c ? ko(new Error(`ffmpeg ${c}`)) : ok()))
    if (input) input(p.stdin)
  })
const raw = ['-f', 'rawvideo', '-pix_fmt', 'gray', '-s', `${w}x${h}`, '-r', String(FPS), '-i', '-', '-vf', 'vflip']

if (process.env.PREVIEW) {
  for (const i of process.env.PREVIEW.split(',').map(Number)) {
    const t0 = Date.now()
    const b64 = await page.evaluate((n) => window.frame(n), i)
    console.log(`fotogramma ${i}: ${Date.now() - t0} ms`)
    await run([...raw, '-frames:v', '1', join(tmp, `${variant}-${i}.png`)], (s) => s.end(Buffer.from(b64, 'base64')))
  }
  await browser.close()
  process.exit(0)
}

// Tutti i fotogrammi in un file senza perdita, poi le codifiche per il web
const total = LOOP * FPS
const master = join(tmp, `${variant}.mkv`)
const t0 = Date.now()
await run([...raw, '-c:v', 'ffv1', master], async (stdin) => {
  for (let i = 0; i < total; i++) {
    const b64 = await page.evaluate((n) => window.frame(n), i)
    if (!stdin.write(Buffer.from(b64, 'base64'))) await new Promise((r) => stdin.once('drain', r))
    if (i % 60 === 0) console.log(`${i}/${total} · ${Math.round((Date.now() - t0) / 1000)} s`)
  }
  stdin.end()
})
await browser.close()

const name = join(out, `${scene}-${variant}`)
await run(['-i', master, '-c:v', 'libx264', '-preset', 'veryslow', '-crf', '27', '-pix_fmt', 'yuv420p', '-tune', 'grain', '-movflags', '+faststart', '-an', `${name}.mp4`])
await run(['-i', master, '-c:v', 'libvpx-vp9', '-crf', '40', '-b:v', '0', '-row-mt', '1', '-pix_fmt', 'yuv420p', '-an', `${name}.webm`])
await run(['-i', master, '-frames:v', '1', '-q:v', '4', `${name}.jpg`])
console.log('fatto:', name)
