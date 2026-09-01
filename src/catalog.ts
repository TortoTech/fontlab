import type { FontFeatureResult } from './detect'

export interface CatalogFont {
  f: string
  c: string
  v: string[]
  s: string[]
  r: number
  d?: string[]
  y?: string
  cl?: string[]
  desc?: string
  ps?: string
  pl?: string
  ax?: string[]
}

export interface Catalog {
  generated: string
  count: number
  fonts: CatalogFont[]
}

let cached: Promise<Catalog | null> | null = null

export function loadCatalog(): Promise<Catalog | null> {
  if (!cached) {
    cached = fetch(import.meta.env.BASE_URL + 'google-fonts-catalog.json', { cache: 'no-store' })
      .then((res) => (res.ok ? (res.json() as Promise<Catalog>) : null))
      .catch(() => null)
  }
  return cached
}

export interface OfflineFeatures {
  ft: string[]
  fd?: 'lining' | 'oldstyle'
  cjk?: boolean
  lat?: boolean
  dig?: boolean
  mono?: boolean
}

let cachedFeatures: Promise<Map<string, OfflineFeatures> | null> | null = null

export function loadFeatures(): Promise<Map<string, OfflineFeatures> | null> {
  if (!cachedFeatures) {
    cachedFeatures = fetch(import.meta.env.BASE_URL + 'google-fonts-features.json', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return null
        const d = (await res.json()) as { fonts: Record<string, OfflineFeatures> }
        return new Map(Object.entries(d.fonts))
      })
      .catch(() => null)
  }
  return cachedFeatures
}

function parseVariants(font: CatalogFont): { weights: number[]; hasItalic: boolean } {
  const weights = new Set<number>()
  let hasItalic = false
  for (const v of font.v) {
    if (v.includes('italic')) hasItalic = true
    const base = v.replace('italic', '')
    const w = base === '' || base === 'regular' ? 400 : parseInt(base, 10)
    if (!Number.isNaN(w)) weights.add(w)
  }
  return { weights: [...weights].sort((a, b) => a - b), hasItalic }
}

export function catalogFeatures(font: CatalogFont): FontFeatureResult {
  const { weights, hasItalic } = parseVariants(font)
  const latin = font.s.includes('latin')
  return {
    family: font.f,
    source: 'google',
    available: false,
    monospace: font.c === 'monospace' ? 'yes' : 'no',
    cjk: font.s.some((s) => s.startsWith('chinese')) ? 'yes' : 'no',
    latin: latin ? 'yes' : 'no',
    digits: latin ? 'yes' : 'unknown',
    bold: weights.some((w) => w >= 600) ? 'yes' : 'no',
    italic: hasItalic ? 'yes' : 'no',
    tnum: 'unknown',
    smcp: 'unknown',
    liga: 'unknown',
    frac: 'unknown',
    sups: 'unknown',
    subs: 'unknown',
    ordn: 'unknown',
    weights,
    isVariable: false,
  }
}

export function css2Query(font: CatalogFont): string {
  const name = font.f.replace(/\s+/g, '+')
  const dedup = new Map<string, { ital: number; w: number }>()
  for (const v of font.v) {
    const ital = v.includes('italic') ? 1 : 0
    const base = v.replace('italic', '')
    const w = base === '' || base === 'regular' ? 400 : parseInt(base, 10)
    if (!Number.isNaN(w)) dedup.set(ital + ',' + w, { ital, w })
  }
  const list = [...dedup.values()].sort((a, b) => a.ital - b.ital || a.w - b.w)
  if (list.length === 0) return name
  if (list.every((t) => t.ital === 0)) return name + ':wght@' + list.map((t) => t.w).join(';')
  return name + ':ital,wght@' + list.map((t) => t.ital + ',' + t.w).join(';')
}
