declare module 'fontkit' {
  export interface FontkitFont {
    hasGlyphForCodePoint(codePoint: number): boolean
    availableFeatures: string[]
  }
  export interface FontkitCollection {
    fonts: FontkitFont[]
  }
  export function create(buffer: Uint8Array): FontkitFont | FontkitCollection
}
