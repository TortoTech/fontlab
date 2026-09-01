declare module 'fontkit' {
  export interface FontkitFont {
    hasGlyphForCodePoint(codePoint: number): boolean
  }
  export interface FontkitCollection {
    fonts: FontkitFont[]
  }
  export function create(buffer: Uint8Array): FontkitFont | FontkitCollection
}
