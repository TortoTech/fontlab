import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const key = process.env.GOOGLE_FONTS_API_KEY
const outPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'google-fonts-catalog.json')

const normSlug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

function loadDescriptions() {
  const map = new Map()
  const root = process.env.GF_DESC_DIR
  if (!root || !existsSync(root)) return map
  for (const lic of readdirSync(root, { withFileTypes: true })) {
    if (!lic.isDirectory()) continue
    let dirs = []
    try {
      dirs = readdirSync(join(root, lic.name), { withFileTypes: true })
    } catch {
      continue
    }
    for (const d of dirs) {
      if (!d.isDirectory()) continue
      const file = join(root, lic.name, d.name, 'DESCRIPTION.en.html')
      if (!existsSync(file)) continue
      try {
        const text = readFileSync(file, 'utf8')
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        if (text) map.set(normSlug(d.name), text)
      } catch {
        // skip unreadable description
      }
    }
  }
  return map
}

function variantsFromFontsMap(m) {
  const out = []
  for (const k of Object.keys(m || {})) {
    const italic = k.endsWith('i')
    const base = italic ? k.slice(0, -1) : k
    if (!italic && base === '400') out.push('regular')
    else if (italic && base === '400') out.push('italic')
    else out.push(base + (italic ? 'italic' : ''))
  }
  return out
}

async function fetchMetadata() {
  const res = await fetch('https://fonts.google.com/metadata/fonts')
  if (!res.ok) throw new Error('HTTP ' + res.status)
  const data = await res.json()
  const list = data.familyMetadataList
  if (!Array.isArray(list) || list.length === 0) throw new Error('empty familyMetadataList')
  const fonts = list.map((it) => ({
    f: it.family,
    c: String(it.category || '')
      .toLowerCase()
      .replace(/\s+/g, '-'),
    v: variantsFromFontsMap(it.fonts),
    s: (it.subsets || []).filter((s) => s !== 'menu'),
    r: Number(it.popularity) || 0,
    d: it.designers || [],
    y: it.dateAdded || '',
    cl: it.classifications || [],
  }))
  fonts.sort((a, b) => a.r - b.r)
  return { source: 'fonts.google.com/metadata', fonts }
}

async function fetchDeveloperApi() {
  if (!key) throw new Error('GOOGLE_FONTS_API_KEY not set')
  const url = 'https://www.googleapis.com/webfonts/v1/webfonts?key=' + key + '&sort=popularity'
  const res = await fetch(url, { headers: { Referer: 'https://tortotech.github.io/' } })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  const data = await res.json()
  if (!Array.isArray(data.items) || data.items.length === 0) throw new Error('empty items')
  const fonts = data.items.map((it, i) => ({
    f: it.family,
    c: it.category ?? '',
    v: it.variants ?? [],
    s: it.subsets ?? [],
    r: i + 1,
  }))
  return { source: 'googleapis.com/webfonts (Developer API)', fonts }
}

let result = null
try {
  result = await fetchMetadata()
} catch (err) {
  console.warn('[fetch-google-fonts] 站点元数据失败（' + err.message + '），回退 Developer API')
  try {
    result = await fetchDeveloperApi()
  } catch (err2) {
    console.warn('[fetch-google-fonts] Developer API 也失败（' + err2.message + '），保留已有目录快照')
    process.exit(0)
  }
}

const descriptions = loadDescriptions()
let withDesc = 0
for (const f of result.fonts) {
  const t = descriptions.get(normSlug(f.f))
  if (t) {
    f.desc = t
    withDesc++
  }
}

writeFileSync(
  outPath,
  JSON.stringify({ generated: new Date().toISOString().slice(0, 10), source: result.source, count: result.fonts.length, fonts: result.fonts }),
)
console.log(
  '[fetch-google-fonts] 已写入 ' +
    result.fonts.length +
    ' 个字体家族（来源: ' +
    result.source +
    '，描述: ' +
    withDesc +
    '）→ ' +
    outPath,
)
