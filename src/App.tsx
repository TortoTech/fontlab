import { useEffect, useRef, useState } from 'react'
import FontModal from './components/FontModal'
import PairCard from './components/PairCard'
import Toolbar from './components/Toolbar'
import TopBar from './components/TopBar'
import { DEFAULT_SETTINGS, GOOGLE_FONT_MAP, defaultPairs, getSample, uid } from './data'
import { fontAvailable, loadFontResource, loadGoogleFont, removeInjectedFont, restoreFont } from './fontUtils'
import type { CustomFont, FontPair, Settings } from './types'

interface AppState {
  settings: Settings
  pairs: FontPair[]
  customFonts: CustomFont[]
}

const STORAGE_KEY = 'font-compare-v1'

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppState>
      return {
        settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
        pairs: parsed.pairs?.length ? parsed.pairs : defaultPairs(),
        customFonts: parsed.customFonts ?? [],
      }
    }
  } catch {
    // ignore corrupted storage
  }
  return { settings: { ...DEFAULT_SETTINGS }, pairs: defaultPairs(), customFonts: [] }
}

export default function App() {
  const [state, setState] = useState<AppState>(loadState)
  const [modalOpen, setModalOpen] = useState(false)
  const [fontTick, setFontTick] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const googleTried = useRef(new Set<string>())

  const { settings, pairs, customFonts } = state
  const sample = getSample(settings)

  const ensureGoogleFont = async (family: string, opts?: { force?: boolean; silent?: boolean }) => {
    const query = GOOGLE_FONT_MAP.get(family)
    if (!query || fontAvailable(family)) return
    if (!opts?.force && googleTried.current.has(family)) return
    googleTried.current.add(family)
    if (!opts?.silent) setToast(`正在从 Google Fonts 加载：${family}…`)
    try {
      await loadGoogleFont(family, query)
      googleTried.current.delete(family)
      setFontTick((t) => t + 1)
      if (!opts?.silent) setToast(`已加载：${family}`)
    } catch (err) {
      if (!opts?.silent) setToast(err instanceof Error ? err.message : '字体加载失败')
    }
  }

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  useEffect(() => {
    state.customFonts.forEach(restoreFont)
    document.fonts.ready.then(() => setFontTick((t) => t + 1))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const families = new Set<string>()
    pairs.forEach((p) =>
      [p.headingZh, p.bodyZh, p.latin, p.mono].forEach((f) => {
        if (GOOGLE_FONT_MAP.has(f)) families.add(f)
      }),
    )
    families.forEach((f) => void ensureGoogleFont(f, { silent: true }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairs])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark')
  }, [settings.theme])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 2200)
    return () => clearTimeout(timer)
  }, [toast])

  const patchSettings = (patch: Partial<Settings>) =>
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }))

  const patchPair = (id: string, patch: Partial<FontPair>) => {
    setState((s) => ({ ...s, pairs: s.pairs.map((p) => (p.id === id ? { ...p, ...patch } : p)) }))
    for (const key of ['headingZh', 'bodyZh', 'latin', 'mono'] as const) {
      const family = patch[key]
      if (family && GOOGLE_FONT_MAP.has(family)) void ensureGoogleFont(family, { force: true })
    }
  }

  const addPair = () => {
    const base = pairs[pairs.length - 1]
    setState((s) => ({
      ...s,
      pairs: [
        ...s.pairs,
        base
          ? { ...base, id: uid(), name: `${base.name} 副本` }
          : {
              id: uid(),
              name: `组合 ${s.pairs.length + 1}`,
              headingZh: 'Noto Sans SC',
              bodyZh: 'Noto Sans SC',
              latin: '',
              mono: '',
              headingWeight: 700,
              bodyWeight: 400,
            },
      ],
    }))
  }

  const duplicatePair = (id: string) =>
    setState((s) => {
      const idx = s.pairs.findIndex((p) => p.id === id)
      if (idx < 0) return s
      const copy = { ...s.pairs[idx], id: uid(), name: `${s.pairs[idx].name} 副本` }
      const next = [...s.pairs]
      next.splice(idx + 1, 0, copy)
      return { ...s, pairs: next }
    })

  const deletePair = (id: string) =>
    setState((s) => ({ ...s, pairs: s.pairs.filter((p) => p.id !== id) }))

  const addFont = async (font: CustomFont) => {
    await loadFontResource(font)
    setState((s) => ({
      ...s,
      customFonts: [...s.customFonts.filter((f) => f.name !== font.name), font],
    }))
    setFontTick((t) => t + 1)
  }

  const removeFont = (name: string) => {
    removeInjectedFont(name)
    setState((s) => ({ ...s, customFonts: s.customFonts.filter((f) => f.name !== name) }))
    setFontTick((t) => t + 1)
  }

  const reset = () => {
    if (!window.confirm('重置所有配置与字体组合？此操作不可撤销。')) return
    localStorage.removeItem(STORAGE_KEY)
    location.reload()
  }

  const gridCls =
    settings.view === 'grid' ? 'grid grid-cols-1 gap-4 xl:grid-cols-2' : 'flex flex-col gap-4'

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <TopBar onAddPair={addPair} onAddFont={() => setModalOpen(true)} onReset={reset} />

      <div className="mx-auto max-w-[1600px] px-4 py-4">
        <Toolbar settings={settings} onChange={patchSettings} />

        {settings.sample === 'custom' && (
          <section className="mb-4 flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-3 sm:flex-row dark:border-zinc-800 dark:bg-zinc-900">
            <label className="flex flex-1 items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              标题
              <input
                className="h-8 flex-1 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-900 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                value={settings.customTitle}
                onChange={(e) => patchSettings({ customTitle: e.target.value })}
              />
            </label>
            <label className="flex flex-[2] flex-col gap-1 text-xs text-zinc-500 sm:flex-row sm:items-center sm:gap-2 dark:text-zinc-400">
              正文
              <textarea
                className="min-h-8 flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                rows={2}
                value={settings.customBody}
                placeholder="用空行分段"
                onChange={(e) => patchSettings({ customBody: e.target.value })}
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
              onChange={(patch) => patchPair(pair.id, patch)}
              onDelete={() => deletePair(pair.id)}
              onDuplicate={() => duplicatePair(pair.id)}
              onToast={setToast}
            />
          ))}
          {pairs.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-400 dark:border-zinc-700">
              暂无组合，点击右上角「添加组合」开始对比
            </div>
          )}
        </main>
      </div>

      {modalOpen && (
        <FontModal
          customFonts={customFonts}
          onClose={() => setModalOpen(false)}
          onAdd={addFont}
          onRemove={removeFont}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900">
          {toast}
        </div>
      )}
    </div>
  )
}
