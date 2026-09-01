import { getSample } from '../data'
import type { CustomFont, FontPair, Settings } from '../types'
import PairCard from './PairCard'
import Toolbar from './Toolbar'

interface Props {
  settings: Settings
  pairs: FontPair[]
  customFonts: CustomFont[]
  fontTick: number
  onPatchSettings: (patch: Partial<Settings>) => void
  onPatchPair: (id: string, patch: Partial<FontPair>) => void
  onAddPair: () => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onToast: (msg: string) => void
}

export default function CompareView({
  settings,
  pairs,
  customFonts,
  fontTick,
  onPatchSettings,
  onPatchPair,
  onAddPair,
  onDuplicate,
  onDelete,
  onToast,
}: Props) {
  const sample = getSample(settings)
  const gridCls = settings.view === 'grid' ? 'grid grid-cols-1 gap-4 xl:grid-cols-2' : 'flex flex-col gap-4'

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button className="h-8 rounded-md bg-indigo-600 px-3 text-sm text-white hover:bg-indigo-500" onClick={onAddPair}>
          + 添加组合
        </button>
      </div>

      <Toolbar settings={settings} onChange={onPatchSettings} />

      {settings.sample === 'custom' && (
        <section className="mb-4 flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-3 sm:flex-row dark:border-zinc-800 dark:bg-zinc-900">
          <label className="flex flex-1 items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            标题
            <input
              className="h-8 flex-1 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-900 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              value={settings.customTitle}
              onChange={(e) => onPatchSettings({ customTitle: e.target.value })}
            />
          </label>
          <label className="flex flex-[2] flex-col gap-1 text-xs text-zinc-500 sm:flex-row sm:items-center sm:gap-2 dark:text-zinc-400">
            正文
            <textarea
              className="min-h-8 flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              rows={2}
              value={settings.customBody}
              placeholder="用空行分段"
              onChange={(e) => onPatchSettings({ customBody: e.target.value })}
            />
          </label>
        </section>
      )}

      <main className={gridCls}>
        {pairs.map((pair) => (
          <PairCard
            key={pair.id}
            pair={pair}
            settings={settings}
            sample={sample}
            customFonts={customFonts.map((f) => f.name)}
            fontTick={fontTick}
            onChange={(patch) => onPatchPair(pair.id, patch)}
            onDelete={() => onDelete(pair.id)}
            onDuplicate={() => onDuplicate(pair.id)}
            onToast={onToast}
          />
        ))}
        {pairs.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-400 dark:border-zinc-700">
            暂无组合，点击「添加组合」开始对比
          </div>
        )}
      </main>
    </>
  )
}
