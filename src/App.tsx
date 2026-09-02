import { useEffect, useRef, useState } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import CompareView from './components/CompareView'
import FeatureMatrix from './components/FeatureMatrix'
import FontModal from './components/FontModal'
import TopBar from './components/TopBar'
import TranslateLab from './components/TranslateLab'
import { DEFAULT_SETTINGS, GOOGLE_FONT_MAP, defaultPairs, uid } from './data'
import type { FontFeatureResult } from './detect'
import { fontAvailable, loadFontResource, loadGoogleFont, removeInjectedFont, restoreFont } from './fontUtils'
import type { CustomFont, FontPair, Settings } from './types'

interface AppState {
  settings: Settings
  pairs: FontPair[]
  customFonts: CustomFont[]
}

const STORAGE_KEY = 'fontlab-v1'

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem('font-compare-v1')
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

  const deletePair = (id: string) => setState((s) => ({ ...s, pairs: s.pairs.filter((p) => p.id !== id) }))

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

  const loadGoogleForMatrix = async (family: string, query?: string): Promise<boolean> => {
    const q = query ?? GOOGLE_FONT_MAP.get(family)
    if (!q) return false
    try {
      await loadGoogleFont(family, q)
      googleTried.current.delete(family)
      setFontTick((t) => t + 1)
      return true
    } catch {
      return false
    }
  }

  const useFontInCompare = (r: FontFeatureResult) => {
    setState((s) => ({
      ...s,
      pairs: [
        ...s.pairs,
        {
          id: uid(),
          name: r.family,
          headingZh: r.family,
          bodyZh: r.family,
          latin: '',
          mono: r.monospace === 'yes' ? r.family : '',
          headingWeight: 700,
          bodyWeight: 400,
        },
      ],
    }))
    setToast(`已添加组合「${r.family}」`)
  }

  return (
    <HashRouter>
      <div className="min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <TopBar onAddFont={() => setModalOpen(true)} onReset={reset} />

        <div className="mx-auto max-w-[1600px] px-4 py-4">
          <Routes>
            <Route
              path="/"
              element={
                <CompareView
                  settings={settings}
                  pairs={pairs}
                  customFonts={customFonts}
                  fontTick={fontTick}
                  onPatchSettings={patchSettings}
                  onPatchPair={patchPair}
                  onAddPair={addPair}
                  onDuplicate={duplicatePair}
                  onDelete={deletePair}
                  onToast={setToast}
                />
              }
            />
            <Route
              path="/features"
              element={
                <FeatureMatrix
                  customFonts={customFonts}
                  fontTick={fontTick}
                  loadGoogle={loadGoogleForMatrix}
                  onUseFont={useFontInCompare}
                  onToast={setToast}
                />
              }
            />
            <Route path="/translate" element={<TranslateLab />} />
          </Routes>
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
    </HashRouter>
  )
}
