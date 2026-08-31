import { SAMPLE_LABELS } from '../data'
import type { SampleKey, Settings } from '../types'

interface Props {
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  display,
  onChange,
}: {
  label: string
  min: number
  max: number
  step: number
  value: number
  display: string
  onChange: (v: number) => void
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
      <span className="shrink-0">{label}</span>
      <input
        type="range"
        className="w-24 accent-indigo-600"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="w-10 shrink-0 tabular-nums text-zinc-700 dark:text-zinc-300">{display}</span>
    </label>
  )
}

export default function Toolbar({ settings, onChange }: Props) {
  const selectCls =
    'h-8 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-900 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100'
  const segBtn = (active: boolean) =>
    `h-8 px-3 text-sm ${
      active
        ? 'bg-indigo-600 text-white'
        : 'bg-white text-zinc-600 hover:text-zinc-900 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
    }`

  return (
    <section className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <label className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        示例文本
        <select
          className={selectCls}
          value={settings.sample}
          onChange={(e) => onChange({ sample: e.target.value as SampleKey })}
        >
          {SAMPLE_LABELS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      <Slider
        label="字号"
        min={12}
        max={24}
        step={1}
        value={settings.baseSize}
        display={`${settings.baseSize}px`}
        onChange={(v) => onChange({ baseSize: v })}
      />
      <Slider
        label="行高"
        min={1.2}
        max={2.4}
        step={0.05}
        value={settings.lineHeight}
        display={settings.lineHeight.toFixed(2)}
        onChange={(v) => onChange({ lineHeight: v })}
      />
      <Slider
        label="标题比例"
        min={1.2}
        max={3}
        step={0.05}
        value={settings.headingScale}
        display={`×${settings.headingScale.toFixed(2)}`}
        onChange={(v) => onChange({ headingScale: v })}
      />
      <Slider
        label="字距"
        min={-0.02}
        max={0.15}
        step={0.005}
        value={settings.letterSpacing}
        display={`${settings.letterSpacing.toFixed(3)}em`}
        onChange={(v) => onChange({ letterSpacing: v })}
      />

      <div className="ml-auto flex items-center gap-3">
        <div className="flex overflow-hidden rounded-md border border-zinc-300 dark:border-zinc-700">
          <button className={segBtn(settings.view === 'grid')} onClick={() => onChange({ view: 'grid' })}>
            网格
          </button>
          <button className={segBtn(settings.view === 'list')} onClick={() => onChange({ view: 'list' })}>
            列表
          </button>
        </div>
        <button
          className="h-8 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-600 hover:border-indigo-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
          onClick={() => onChange({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
        >
          {settings.theme === 'dark' ? '浅色模式' : '深色模式'}
        </button>
      </div>
    </section>
  )
}
