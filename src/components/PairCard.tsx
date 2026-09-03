import { WEIGHTS } from '../data'
import { buildCssSnippet, copyText } from '../fontUtils'
import type { FontPair, Sample, Settings } from '../types'
import FontSelect from './FontSelect'
import Preview from './Preview'

interface Props {
  pair: FontPair
  settings: Settings
  sample: Sample
  customFonts: string[]
  extraFonts: string[]
  fontTick: number
  onChange: (patch: Partial<FontPair>) => void
  onDelete: () => void
  onDuplicate: () => void
  onToast: (msg: string) => void
}

function WeightSelect({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
      <select
        className="h-8 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-900 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {WEIGHTS.map((w) => (
          <option key={w.value} value={w.value}>
            {w.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export default function PairCard({
  pair,
  settings,
  sample,
  customFonts,
  extraFonts,
  fontTick,
  onChange,
  onDelete,
  onDuplicate,
  onToast,
}: Props) {
  const btn =
    'h-7 rounded-md border border-zinc-300 bg-white px-2.5 text-xs text-zinc-600 hover:border-indigo-400 hover:text-indigo-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-indigo-500 dark:hover:text-indigo-400'

  const selectProps = { customFonts, extraFonts, fontTick }

  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-center gap-2">
        <input
          className="h-8 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 text-sm font-semibold text-zinc-800 outline-none hover:border-zinc-300 focus:border-indigo-500 dark:text-zinc-100 dark:hover:border-zinc-700"
          value={pair.name}
          spellCheck={false}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        <button
          className={btn}
          onClick={async () => {
            const ok = await copyText(buildCssSnippet(pair, settings))
            onToast(ok ? 'CSS 已复制到剪贴板' : '复制失败，请手动复制')
          }}
        >
          复制 CSS
        </button>
        <button className={btn} onClick={onDuplicate}>
          复制
        </button>
        <button
          className="h-7 rounded-md border border-zinc-300 bg-white px-2.5 text-xs text-red-500 hover:border-red-400 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-red-500"
          onClick={onDelete}
        >
          删除
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-3">
        <FontSelect label="中文标题字体" value={pair.headingZh} {...selectProps} onChange={(v) => onChange({ headingZh: v })} />
        <FontSelect label="中文正文字体" value={pair.bodyZh} {...selectProps} onChange={(v) => onChange({ bodyZh: v })} />
        <FontSelect label="英文字体（混排）" value={pair.latin} allowNone {...selectProps} onChange={(v) => onChange({ latin: v })} />
        <FontSelect label="等宽字体（代码）" value={pair.mono} allowNone {...selectProps} onChange={(v) => onChange({ mono: v })} />
        <WeightSelect label="标题字重" value={pair.headingWeight} onChange={(v) => onChange({ headingWeight: v })} />
        <WeightSelect label="正文字重" value={pair.bodyWeight} onChange={(v) => onChange({ bodyWeight: v })} />
      </div>

      <Preview pair={pair} settings={settings} sample={sample} />
    </article>
  )
}
