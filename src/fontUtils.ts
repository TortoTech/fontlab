import type { CustomFont, FontPair, Settings, TriState } from './types'

const injected = new Map<string, HTMLElement>()

export function fontAvailable(name: string): boolean {
  return fontExists(name)
}

let measureCanvas: CanvasRenderingContext2D | null = null

function measureCtx(): CanvasRenderingContext2D | null {
  if (!measureCanvas) measureCanvas = document.createElement('canvas').getContext('2d')
  return measureCanvas
}

function textWidth(font: string, text: string): number {
  const c = measureCtx()
  if (!c) return -1
  c.font = font
  return c.measureText(text).width
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.01

export function fontExists(family: string): boolean {
  const probe = 'Hamburgefonstiv 0123456789'
  const q = `"${family}"`
  return (
    !near(textWidth(`16px ${q}, serif`, probe), textWidth('16px serif', probe)) ||
    !near(textWidth(`16px ${q}, sans-serif`, probe), textWidth('16px sans-serif', probe)) ||
    !near(textWidth(`16px ${q}, monospace`, probe), textWidth('16px monospace', probe))
  )
}

export function fontHasCjk(family: string): TriState {
  const probe = '中文测试永'
  const wF = textWidth(`16px "${family}", Arial`, probe)
  const wA = textWidth('16px Arial', probe)
  if (!near(wF, wA)) return 'yes'
  for (const witness of CJK_WITNESSES) {
    if (witness.toLowerCase() === family.toLowerCase()) continue
    if (!fontExists(witness)) continue
    const wFG = textWidth(`16px "${family}", "${witness}"`, probe)
    const wG = textWidth(`16px "${witness}"`, probe)
    return near(wFG, wG) ? 'no' : 'yes'
  }
  return 'unknown'
}

const CJK_WITNESSES = [
  'Microsoft YaHei',
  'KaiTi',
  'SimSun',
  'PingFang SC',
  'Hiragino Sans GB',
  'Songti SC',
  'STKaiti',
  'Noto Sans CJK SC',
]

const quote = (name: string) => `"${name}"`

export function headingStack(pair: FontPair): string {
  return [pair.latin, pair.headingZh].filter(Boolean).map(quote).join(', ') + ', serif'
}

export function bodyStack(pair: FontPair): string {
  return [pair.latin, pair.bodyZh].filter(Boolean).map(quote).join(', ') + ', sans-serif'
}

export function monoStack(pair: FontPair): string {
  return pair.mono ? `${quote(pair.mono)}, monospace` : 'monospace'
}

export function buildCssSnippet(pair: FontPair, settings: Settings): string {
  return `/* ${pair.name} */
h1, h2 {
  font-family: ${headingStack(pair)};
  font-weight: ${pair.headingWeight};
}

body {
  font-family: ${bodyStack(pair)};
  font-weight: ${pair.bodyWeight};
  line-height: ${settings.lineHeight};
  letter-spacing: ${settings.letterSpacing}em;
}

code, pre {
  font-family: ${monoStack(pair)};
}`
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}

export async function loadFontResource(font: CustomFont): Promise<void> {
  injected.get(font.name)?.remove()
  if (font.kind === 'link' && font.href) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = font.href
    document.head.appendChild(link)
    injected.set(font.name, link)
    await new Promise<void>((resolve, reject) => {
      link.onload = () => resolve()
      link.onerror = () => {
        link.remove()
        injected.delete(font.name)
        reject(new Error('链接加载失败，请检查 URL 是否可访问'))
      }
    })
  } else if (font.css) {
    const style = document.createElement('style')
    style.textContent = font.css
    document.head.appendChild(style)
    injected.set(font.name, style)
  } else {
    throw new Error('缺少字体资源内容')
  }
  await document.fonts.ready
}

export function restoreFont(font: CustomFont): void {
  loadFontResource(font).catch(() => {})
}

export function removeInjectedFont(name: string): void {
  injected.get(name)?.remove()
  injected.delete(name)
}

const googleLinks = new Map<string, HTMLLinkElement>()
const pendingGoogle = new Map<string, Promise<void>>()

export function googleFontsUrl(query: string): string {
  return `https://fonts.googleapis.com/css2?family=${query}&display=swap`
}

export async function loadGoogleFont(family: string, query: string): Promise<void> {
  if (fontAvailable(family) || googleLinks.has(family)) return
  const existing = pendingGoogle.get(family)
  if (existing) return existing

  const promise = (async () => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = googleFontsUrl(query)
    document.head.appendChild(link)
    try {
      await new Promise<void>((resolve, reject) => {
        link.onload = () => resolve()
        link.onerror = () =>
          reject(new Error('无法连接 Google Fonts（网络或地区限制），可改用「添加网络字体」自行托管'))
      })
      googleLinks.set(family, link)
      await document.fonts.ready
    } catch (err) {
      link.remove()
      throw err
    } finally {
      pendingGoogle.delete(family)
    }
  })()
  pendingGoogle.set(family, promise)
  return promise
}

export function guessFamilyFromUrl(url: string): string {
  const m = url.match(/[?&]family=([^&:]+)/)
  return m ? decodeURIComponent(m[1]).replace(/\+/g, ' ') : ''
}

export function parseFamilyFromCss(css: string): string {
  const m = css.match(/font-family\s*:\s*["']?([^;"'}]+)/i)
  return m ? m[1].trim() : ''
}

export function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(bin)
}

export function guessMime(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'woff':
      return 'font/woff'
    case 'woff2':
      return 'font/woff2'
    case 'ttf':
      return 'font/ttf'
    case 'otf':
      return 'font/otf'
    default:
      return 'font/woff2'
  }
}
