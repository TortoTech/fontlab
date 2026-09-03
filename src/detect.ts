import { fontExists, fontHasCjk } from './fontUtils'
import type { FontSource, TriState } from './types'

export type { TriState }

export interface FontFeatureResult {
  family: string
  source: FontSource
  available: boolean
  monospace: TriState
  cjk: TriState
  latin: TriState
  digits: TriState
  bold: TriState
  italic: TriState
  tnum: TriState
  smcp: TriState
  liga: TriState
  frac: TriState
  sups: TriState
  subs: TriState
  ordn: TriState
  weights: number[]
  isVariable: boolean
  figures?: FiguresInfo
}

export interface FiguresInfo {
  def: 'lining' | 'oldstyle' | 'unknown'
  onum: TriState
}

let ctx: CanvasRenderingContext2D | null = null

function getCtx(): CanvasRenderingContext2D | null {
  if (!ctx) ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  return ctx
}

function isMonospace(family: string): TriState {
  const c = getCtx()
  if (!c) return 'unknown'
  const chars = ['i', 'l', 'm', 'W', '0', '.']
  c.font = `64px "${family}"`
  const widths = chars.map((ch) => c.measureText(ch).width)
  if (widths[0] === 0) return 'unknown'
  const first = widths[0]
  return widths.every((w) => Math.abs(w - first) < 0.5) ? 'yes' : 'no'
}

interface FaceInfo {
  weights: number[]
  styles: string[]
  isVariable: boolean
}

function enumerateFaces(family: string): FaceInfo | null {
  const norm = family.toLowerCase().replace(/["']/g, '')
  let count = 0
  const weights = new Set<number>()
  const styles = new Set<string>()
  let isVariable = false
  document.fonts.forEach((face) => {
    if (face.family.toLowerCase().replace(/["']/g, '') !== norm) return
    count++
    const parts = face.weight.split(/\s+/).map(Number)
    if (parts.length > 1) isVariable = true
    parts.forEach((w) => weights.add(w))
    styles.add(face.style)
  })
  if (count === 0) return null
  return { weights: [...weights].sort((a, b) => a - b), styles: [...styles], isVariable }
}

function raster(family: string, style: string, weight: string): Uint8ClampedArray | null {
  const c = getCtx()
  if (!c) return null
  const w = 240
  const h = 80
  c.canvas.width = w
  c.canvas.height = h
  c.fillStyle = '#000'
  c.font = `${style} ${weight} 48px "${family}"`
  c.textBaseline = 'alphabetic'
  c.fillText('Hamb中', 8, 56)
  return c.getImageData(0, 0, w, h).data
}

function samePixels(a: Uint8ClampedArray, b: Uint8ClampedArray): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

function styleHeuristic(family: string, kind: 'bold' | 'italic'): TriState {
  const base = raster(family, 'normal', '400')
  const test = kind === 'bold' ? raster(family, 'normal', '700') : raster(family, 'italic', '400')
  if (!base || !test) return 'unknown'
  return samePixels(base, test) ? 'no' : 'maybe'
}

function figureDefaultStyle(family: string): 'lining' | 'oldstyle' | 'unknown' {
  const c = getCtx()
  if (!c) return 'unknown'
  const size = 48
  c.font = `${size}px "${family}"`
  const dig = c.measureText('0123456789')
  const capA = c.measureText('H').actualBoundingBoxAscent
  const xA = c.measureText('x').actualBoundingBoxAscent
  if (!capA || !xA || !dig.actualBoundingBoxAscent) return 'unknown'
  if (dig.actualBoundingBoxDescent > size * 0.08) return 'oldstyle'
  return dig.actualBoundingBoxAscent < (xA + capA) / 2 ? 'oldstyle' : 'lining'
}

export function detectFigures(family: string): FiguresInfo {
  const t = '0123456789'
  const wL = featWidth(family, '"lnum"', t)
  const wO = featWidth(family, '"onum"', t)
  const eps = 0.01
  const hasOnum = Math.abs(wL - wO) > eps
  return { def: figureDefaultStyle(family), onum: hasOnum ? 'yes' : 'no' }
}

let featSpan: HTMLSpanElement | null = null

function featWidth(family: string, featureSettings: string, text: string): number {
  if (!featSpan) {
    featSpan = document.createElement('span')
    featSpan.style.cssText =
      'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:nowrap;font-size:48px;'
    document.body.appendChild(featSpan)
  }
  featSpan.textContent = text
  featSpan.style.fontFamily = `"${family}"`
  featSpan.style.fontFeatureSettings = featureSettings
  return featSpan.getBoundingClientRect().width
}

export function detectTnum(family: string): TriState {
  const t = '0123456789'
  const wN = featWidth(family, 'normal', t)
  const wT = featWidth(family, '"tnum"', t)
  const wP = featWidth(family, '"pnum"', t)
  const eps = 0.01
  return Math.abs(wT - wP) > eps || Math.abs(wN - wP) > eps ? 'yes' : 'no'
}

export function detectSmcp(family: string): TriState {
  const t = 'abcdefghij'
  const wN = featWidth(family, 'normal', t)
  const wS = featWidth(family, '"smcp"', t)
  return Math.abs(wS - wN) > 0.01 ? 'yes' : 'no'
}

export function detectFeature(family: string, feature: string, text: string): TriState {
  const wOn = featWidth(family, `"${feature}" 1`, text)
  const wOff = featWidth(family, `"${feature}" 0`, text)
  return Math.abs(wOn - wOff) > 0.01 ? 'yes' : 'no'
}

export function detectFont(family: string, source: FontSource): FontFeatureResult {
  const available = fontExists(family)
  const faces = available ? enumerateFaces(family) : null

  let bold: TriState = 'unknown'
  let italic: TriState = 'unknown'
  if (faces) {
    bold = faces.weights.some((w) => w >= 600) ? 'yes' : 'no'
    italic = faces.styles.some((s) => s === 'italic' || s === 'oblique') ? 'yes' : 'no'
  } else if (available) {
    bold = styleHeuristic(family, 'bold')
    italic = styleHeuristic(family, 'italic')
  }

  return {
    family,
    source,
    available,
    monospace: available ? isMonospace(family) : 'unknown',
    cjk: available ? fontHasCjk(family) : 'unknown',
    latin: available ? 'yes' : 'unknown',
    digits: available ? 'yes' : 'unknown',
    bold,
    italic,
    weights: faces?.weights ?? [],
    isVariable: faces?.isVariable ?? false,
    figures: available ? detectFigures(family) : undefined,
    tnum: available ? detectTnum(family) : 'unknown',
    smcp: available ? detectSmcp(family) : 'unknown',
    liga: available ? detectFeature(family, 'liga', 'fi fl ff ffi') : 'unknown',
    frac: available ? detectFeature(family, 'frac', '1/2 2/3 3/4') : 'unknown',
    sups: available ? detectFeature(family, 'sups', 'ABC123') : 'unknown',
    subs: available ? detectFeature(family, 'subs', 'ABC123') : 'unknown',
    ordn: available ? detectFeature(family, 'ordn', '1o 2a 3o 4a') : 'unknown',
  }
}
