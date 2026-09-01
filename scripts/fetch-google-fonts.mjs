import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const key = process.env.GOOGLE_FONTS_API_KEY
const outPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'google-fonts-catalog.json')

if (!key) {
  console.warn('[fetch-google-fonts] GOOGLE_FONTS_API_KEY 未设置，保留已有目录快照')
  process.exit(0)
}

const url = 'https://www.googleapis.com/webfonts/v1/webfonts?key=' + key + '&sort=popularity'

try {
  const res = await fetch(url, { headers: { Referer: 'https://tortotech.github.io/' } })
  if (!res.ok) {
    console.warn(
      '[fetch-google-fonts] API 请求失败（HTTP ' + res.status + ': ' + (await res.text()).slice(0, 200) + '），保留已有目录快照',
    )
    process.exit(0)
  }
  const data = await res.json()
  if (!Array.isArray(data.items) || data.items.length === 0) {
    console.warn('[fetch-google-fonts] 返回内容为空，保留已有目录快照')
    process.exit(0)
  }
  const fonts = data.items.map((it, i) => ({
    f: it.family,
    c: it.category ?? '',
    v: it.variants ?? [],
    s: it.subsets ?? [],
    r: i + 1,
  }))
  writeFileSync(
    outPath,
    JSON.stringify({ generated: new Date().toISOString().slice(0, 10), count: fonts.length, fonts }),
  )
  console.log('[fetch-google-fonts] 已写入 ' + fonts.length + ' 个字体家族 → ' + outPath)
} catch (err) {
  console.warn('[fetch-google-fonts] 请求异常（' + (err?.message ?? err) + '），保留已有目录快照')
  process.exit(0)
}
