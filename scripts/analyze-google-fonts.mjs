import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const key = process.env.GOOGLE_FONTS_API_KEY
const cacheDir = process.env.GF_TTF_DIR || 'gf-ttf-cache'
const TRACK = ['liga', 'tnum', 'onum', 'lnum', 'smcp', 'frac', 'sups', 'subs', 'ordn']

const outPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'google-fonts-features.json')

if (!key) {
  console.warn('[analyze-google-fonts] GOOGLE_FONTS_API_KEY 未设置，跳过离线特性解析')
  process.exit(0)
}

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

const api = 'https://www.googleapis.com/webfonts/v1/webfonts?key=' + key + '&sort=popularity'
const res = await fetch(api, { headers: { Referer: 'https://tortotech.github.io/' } })
if (!res.ok) {
  console.warn('[analyze-google-fonts] Developer API 请求失败（HTTP ' + res.status + '），跳过')
  process.exit(0)
}
const data = await res.json()
const items = Array.isArray(data.items) ? data.items : []
if (items.length === 0) {
  console.warn('[analyze-google-fonts] 目录为空，跳过')
  process.exit(0)
}

mkdirSync(cacheDir, { recursive: true })

const fontkitMod = await import('fontkit')
const fontkit = fontkitMod.default ?? fontkitMod

const tasks = items.map((it) => ({
  family: it.family,
  url: it.files?.regular ?? Object.values(it.files ?? {})[0],
}))

const results = {}
let done = 0
let failed = 0

async function processOne({ family, url }) {
  const slug = norm(family)
  const file = join(cacheDir, slug + '.ttf')
  try {
    if (!existsSync(file)) {
      if (!url) throw new Error('no file url')
      const r = await fetch(url)
      if (!r.ok) throw new Error('HTTP ' + r.status)
      writeFileSync(file, Buffer.from(await r.arrayBuffer()))
    }
    const font = fontkit.create(new Uint8Array(readFileSync(file)))
    const feats = font.availableFeatures ?? []
    results[family.toLowerCase()] = { ft: TRACK.filter((f) => feats.includes(f)) }
  } catch (err) {
    failed++
    if (failed <= 5) console.warn('[analyze-google-fonts] ' + family + ' 解析失败: ' + (err?.message ?? err))
  } finally {
    done++
    if (done % 200 === 0) console.log('[analyze-google-fonts] 进度 ' + done + '/' + tasks.length)
  }
}

const queue = [...tasks]
const workers = Array.from({ length: 16 }, async () => {
  for (;;) {
    const t = queue.shift()
    if (!t) return
    await processOne(t)
  }
})
await Promise.all(workers)

writeFileSync(
  outPath,
  JSON.stringify({ generated: new Date().toISOString().slice(0, 10), count: Object.keys(results).length, fonts: results }),
)
console.log(
  '[analyze-google-fonts] 完成：解析 ' +
    Object.keys(results).length +
    '，失败 ' +
    failed +
    ' → ' +
    outPath,
)
