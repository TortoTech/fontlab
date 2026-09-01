export interface FontPair {
  id: string
  name: string
  headingZh: string
  bodyZh: string
  latin: string
  mono: string
  headingWeight: number
  bodyWeight: number
}

export type SampleKey = 'mixed' | 'tech' | 'literature' | 'poster' | 'custom'

export interface Settings {
  baseSize: number
  lineHeight: number
  headingScale: number
  letterSpacing: number
  sample: SampleKey
  customTitle: string
  customBody: string
  theme: 'light' | 'dark'
  view: 'grid' | 'list'
}

export interface CustomFont {
  kind: 'link' | 'css'
  name: string
  href?: string
  css?: string
  ft?: string[]
}

export interface Sample {
  h1: string
  h1En?: string
  h2?: string
  paras: string[]
  quote?: string
  code?: string
  caption?: string
}

export type FontSource = 'local' | 'google' | 'custom'

export type TriState = 'yes' | 'maybe' | 'no' | 'unknown'

