import { FONT_GROUPS, GOOGLE_FONT_GROUPS, GOOGLE_FONT_MAP } from '../data'
import { fontAvailable } from '../fontUtils'

const CUSTOM_VALUE = '__custom__'

interface Props {
  label: string
  value: string
  allowNone?: boolean
  customFonts: string[]
  fontTick: number
  onChange: (value: string) => void
}

function Option({ name }: { name: string }) {
  const suffix = fontAvailable(name) ? '' : GOOGLE_FONT_MAP.has(name) ? '（云端，选中后加载）' : '（未检测到）'
  return <option value={name}>{name + suffix}</option>
}

export default function FontSelect({ label, value, allowNone, customFonts, fontTick, onChange }: Props) {
  const known = new Set<string>()
  FONT_GROUPS.forEach((g) => g.fonts.forEach((f) => known.add(f)))
  GOOGLE_FONT_GROUPS.forEach((g) => g.fonts.forEach((f) => known.add(f.family)))
  customFonts.forEach((f) => known.add(f))

  const isKnown = value === '' || known.has(value)

  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
      <select
        data-tick={fontTick}
        className="h-8 w-full truncate rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-900 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        value={value}
        onChange={(e) => {
          const v = e.target.value
          if (v === CUSTOM_VALUE) {
            const name = window.prompt('输入字体族名称（font-family）')
            if (name?.trim()) onChange(name.trim())
          } else {
            onChange(v)
          }
        }}
      >
        {allowNone && <option value="">不设置</option>}
        {!isKnown && <Option name={value} />}
        {customFonts.length > 0 && (
          <optgroup label="自定义网络字体">
            {customFonts.map((f) => (
              <Option key={f} name={f} />
            ))}
          </optgroup>
        )}
        {FONT_GROUPS.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.fonts.map((f) => (
              <Option key={f} name={f} />
            ))}
          </optgroup>
        ))}
        {GOOGLE_FONT_GROUPS.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.fonts.map((f) => (
              <Option key={f.family} name={f.family} />
            ))}
          </optgroup>
        ))}
        <option value={CUSTOM_VALUE}>手动输入…</option>
      </select>
    </label>
  )
}
