import { fontAvailable } from './fontUtils'
import type { FontSource } from './types'

export type TriState = 'yes' | 'maybe' | 'no' | 'unknown'

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
  weights: number[]
  isVariable: boolean
}

let ctx: CanvasRenderingContext2D | null = null

function getCtx(): CanvasRenderingContext2D | null {
  if (!ctx) ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  return ctx
}

export function hasGlyph(family: string, text: string): TriState {
  try {
    return document.fonts.check(`16px "${family}"`, text) ? 'yes' : 'no'
  } catch {
    return 'unknown'
  }
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

export function detectFont(family: string, source: FontSource): FontFeatureResult {
  const available = fontAvailable(family)
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

  const latin = available ? hasGlyph(family, 'A') : 'unknown'

  return {
    family,
    source,
    available,
    monospace: available && latin === 'yes' ? isMonospace(family) : 'unknown',
    cjk: available ? hasGlyph(family, '中') : 'unknown',
    latin,
    digits: available ? hasGlyph(family, '0') : 'unknown',
    bold,
    italic,
    weights: faces?.weights ?? [],
    isVariable: faces?.isVariable ?? false,
  }
}
