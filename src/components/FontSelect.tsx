import { useMemo, useState } from 'react'
import { FONT_GROUPS } from '../data'
import { fontExists } from '../fontUtils'

const MAX_SHOWN = 200

interface Props {
  label: string
  value: string
  allowNone?: boolean
  customFonts: string[]
  extraFonts: string[]
  fontTick: number
  onChange: (value: string) => void
}

export default function FontSelect({ label, value, allowNone, customFonts, extraFonts, fontTick, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')

  const all = useMemo(() => {
    const set = new Set<string>()
    customFonts.forEach((f) => set.add(f))
    FONT_GROUPS.forEach((g) => g.fonts.forEach((f) => set.add(f)))
    extraFonts.forEach((f) => set.add(f))
    if (value) set.add(value)
    return [...set].sort((a, b) => a.localeCompare(b))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customFonts, extraFonts, value])

  const query = q.trim().toLowerCase()
  const filtered = query ? all.filter((f) => f.toLowerCase().includes(query)) : all
  const shown = filtered.slice(0, MAX_SHOWN)
  const exact = all.some((f) => f.toLowerCase() === query)

  const pick = (name: string) => {
    onChange(name)
    setOpen(false)
    setQ('')
  }

  return (
    <div className="flex min-w-0 flex-col gap-1" data-tick={fontTick}>
      <span className="text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
      <div className="relative">
        <input
          className="h-8 w-full truncate rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-900 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          placeholder="搜索字体…"
          value={open ? q : value}
          onFocus={() => {
            setOpen(true)
            setQ('')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false)
              setQ('')
            }
          }}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
        />
        {open && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
            <div className="absolute left-0 top-9 z-30 max-h-64 w-full min-w-56 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              {allowNone && (
                <button
                  className="block w-full truncate rounded px-2 py-1.5 text-left text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  onClick={() => pick('')}
                >
                  不设置
                </button>
              )}
              {query && !exact && (
                <button
                  className="block w-full truncate rounded bg-indigo-50 px-2 py-1.5 text-left text-sm text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-400 dark:hover:bg-indigo-900"
                  onClick={() => pick(q.trim())}
                >
                  使用「{q.trim()}」
                </button>
              )}
              {shown.map((f) => (
                <button
                  key={f}
                  className="block w-full truncate rounded px-2 py-1.5 text-left text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  onClick={() => pick(f)}
                >
                  {f}
                  {!fontExists(f) && <span className="ml-1 text-xs text-zinc-400 dark:text-zinc-500">(云端)</span>}
                </button>
              ))}
              {filtered.length > MAX_SHOWN && (
                <p className="px-2 py-1 text-xs text-zinc-400">还有 {filtered.length - MAX_SHOWN} 项，请输入更多字符缩小范围</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
