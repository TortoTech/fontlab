import { FONT_GROUPS } from './data'

export interface LocalFontInfo {
  weights: number[]
  italic: boolean
}

export interface LocalFontsResult {
  info: Map<string, LocalFontInfo>
  blobs: Map<string, () => Promise<Blob>>
}

export type LocalFontsStatus = 'ok' | 'unsupported' | 'needs-activation' | 'denied'

interface FontDataLike {
  family: string
  style: string
  blob(): Promise<Blob>
}

export function parseStyle(style: string): { weight: number | null; italic: boolean } {
  const s = style.toLowerCase()
  const italic = /italic|oblique/.test(s)
  const num = s.match(/\b(\d{3})\b/)
  if (num) return { weight: Number(num[1]), italic }
  const table: [RegExp, number][] = [
    [/thin|hairline/, 100],
    [/extralight|ultralight/, 200],
    [/light/, 300],
    [/semibold|demibold/, 600],
    [/extrabold|ultrabold/, 800],
    [/black|heavy/, 900],
    [/bold/, 700],
    [/medium/, 500],
    [/regular|normal|book|roman/, 400],
  ]
  for (const [re, w] of table) {
    if (re.test(s)) return { weight: w, italic }
  }
  return { weight: null, italic }
}

export async function queryLocalFonts(): Promise<{ status: LocalFontsStatus; result?: LocalFontsResult }> {
  const w = window as unknown as { queryLocalFonts?: () => Promise<FontDataLike[]> }
  if (typeof w.queryLocalFonts !== 'function') return { status: 'unsupported' }
  let fonts: FontDataLike[]
  try {
    fonts = await w.queryLocalFonts()
  } catch (err) {
    if (err instanceof DOMException && err.name === 'SecurityError') return { status: 'needs-activation' }
    return { status: 'denied' }
  }
  const info = new Map<string, LocalFontInfo>()
  const blobs = new Map<string, () => Promise<Blob>>()
  for (const f of fonts) {
    const key = f.family.toLowerCase()
    const entry = info.get(key) ?? { weights: [], italic: false }
    const { weight, italic } = parseStyle(f.style)
    if (weight !== null && !entry.weights.includes(weight)) entry.weights.push(weight)
    if (italic) entry.italic = true
    info.set(key, entry)
    if (!blobs.has(key)) blobs.set(key, () => f.blob())
  }
  for (const entry of info.values()) entry.weights.sort((a, b) => a - b)
  return { status: 'ok', result: { info, blobs } }
}

interface ParsedFontLike {
  hasGlyphForCodePoint: (cp: number) => boolean
  availableFeatures: string[]
}

export interface LocalFontAnalysis {
  cjk: boolean | null
  onum: boolean | null
  tnum: boolean | null
  smcp: boolean | null
  liga: boolean | null
  frac: boolean | null
  sups: boolean | null
  subs: boolean | null
  ordn: boolean | null
}

export async function analyzeLocalFont(getBlob: () => Promise<Blob>): Promise<LocalFontAnalysis> {
  try {
    const buf = new Uint8Array(await (await getBlob()).arrayBuffer())
    const { create } = await import('fontkit')
    const created = create(buf) as ParsedFontLike | { fonts: ParsedFontLike[] }
    const fonts = 'fonts' in created ? created.fonts : [created]
    const feats = new Set<string>()
    fonts.forEach((f) => f.availableFeatures.forEach((x) => feats.add(x)))
    return {
      cjk: fonts.some((f) => f.hasGlyphForCodePoint(0x4e2d)),
      onum: feats.has('onum') ? true : feats.has('lnum') ? false : null,
      tnum: feats.has('tnum') ? true : feats.has('pnum') ? false : null,
      smcp: feats.has('smcp') ? true : false,
      liga: feats.has('liga') ? true : false,
      frac: feats.has('frac') ? true : false,
      sups: feats.has('sups') ? true : false,
      subs: feats.has('subs') ? true : false,
      ordn: feats.has('ordn') ? true : false,
    }
  } catch {
    return {
      cjk: null,
      onum: null,
      tnum: null,
      smcp: null,
      liga: null,
      frac: null,
      sups: null,
      subs: null,
      ordn: null,
    }
  }
}

export const LOCAL_ZH_FAMILIES: string[] = FONT_GROUPS[0].fonts.map((f) => f.toLowerCase())

export const LOCAL_CURATED_FAMILIES: string[] = FONT_GROUPS.flatMap((g) =>
  g.fonts.map((f) => f.toLowerCase()),
)

export const FEATURE_TAGS = ['liga', 'tnum', 'onum', 'lnum', 'smcp', 'frac', 'sups', 'subs', 'ordn']

export interface FontFeatures {
  ft: string[]
  fd?: 'lining' | 'oldstyle'
}

export async function featuresFromBuffer(buf: ArrayBuffer): Promise<FontFeatures | null> {
  try {
    const { create } = await import('fontkit')
    const created = create(new Uint8Array(buf)) as ParsedFontLike | { fonts: ParsedFontLike[] }
    const fonts = 'fonts' in created ? created.fonts : [created]
    const feats = new Set<string>()
    fonts.forEach((f) => f.availableFeatures.forEach((x) => feats.add(x)))
    const result: FontFeatures = { ft: FEATURE_TAGS.filter((f) => feats.has(f)) }
    try {
      const font = fonts[0] as unknown as {
        glyphForCodePoint: (cp: number) => { bbox: { maxX: number; maxY: number; minY: number } }
      }
      const capH = font.glyphForCodePoint(72).bbox.maxY
      const xH = font.glyphForCodePoint(120).bbox.maxY
      if (capH > 0 && xH > 0) {
        const zero = font.glyphForCodePoint(48).bbox
        const hasDesc = [51, 52, 53, 55, 57].some((cp) => font.glyphForCodePoint(cp).bbox.minY < -5)
        result.fd = zero.maxY < (xH + capH) / 2 || hasDesc ? 'oldstyle' : 'lining'
      }
    } catch {
      // 取不到轮廓时不写默认数字风格
    }
    return result
  } catch {
    return null
  }
}
