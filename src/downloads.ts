let filesPromise: Promise<Record<string, Record<string, string>> | null> | null = null

function loadFontFiles(): Promise<Record<string, Record<string, string>> | null> {
  if (!filesPromise) {
    filesPromise = fetch(import.meta.env.BASE_URL + 'google-fonts-files.json', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return null
        const d = (await res.json()) as { files: Record<string, Record<string, string>> }
        return d.files
      })
      .catch(() => null)
  }
  return filesPromise
}

export async function downloadFamilyZip(family: string): Promise<boolean> {
  const all = await loadFontFiles()
  const files = all?.[family.toLowerCase()]
  const entries = Object.entries(files ?? {})
  if (entries.length === 0) return false
  const blobs = await Promise.all(
    entries.map(async ([variant, url]) => {
      const r = await fetch(url)
      if (!r.ok) throw new Error('HTTP ' + r.status)
      return { variant, blob: await r.blob() }
    }),
  )
  const jszip = (await import('jszip')).default
  const zip = new jszip()
  for (const { variant, blob } of blobs) {
    zip.file(`${family}-${variant}.ttf`, blob)
  }
  const out = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(out)
  const a = document.createElement('a')
  a.href = url
  a.download = `${family}.zip`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  return true
}

export function officialDownloadUrl(family: string): string {
  return `https://fonts.google.com/download?family=${encodeURIComponent(family)}`
}
