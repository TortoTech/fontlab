import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { catalogFeatures, css2Query, loadCatalog } from '../catalog'
import type { CatalogFont } from '../catalog'
import { allFontEntries } from '../data'
import { detectFont } from '../detect'
import type { FontFeatureResult, TriState } from '../detect'
import { fontAvailable } from '../fontUtils'
import type { CustomFont, FontSource } from '../types'

interface Props {
  customFonts: CustomFont[]
  fontTick: number
  loadGoogle: (family: string, query?: string) => Promise<boolean>
  onUseFont: (result: FontFeatureResult) => void
  onToast: (msg: string) => void
}

const TRI_META: Record<TriState, { icon: string; cls: string; tip: string }> = {
  yes: { icon: '✓', cls: 'text-emerald-600 dark:text-emerald-400', tip: '支持（有真实字形）' },
  maybe: { icon: '~', cls: 'text-amber-500 dark:text-amber-400', tip: '可渲染，可能是浏览器合成' },
  no: { icon: '✗', cls: 'text-red-400 dark:text-red-500', tip: '不支持（无真实字形）' },
  unknown: { icon: '?', cls: 'text-zinc-300 dark:text-zinc-600', tip: '未知' },
}

const SOURCE_LABEL: Record<FontSource, string> = {
  local: '本地',
  google: 'Google',
  custom: '自定义',
}

const SOURCE_CLS: Record<FontSource, string> = {
  local: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
  google: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400',
  custom: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
}

const PAGE_SIZE = 300

function Tri({ v }: { v: TriState }) {
  const m = TRI_META[v]
  return (
    <span className={`inline-block w-5 text-center text-sm font-bold ${m.cls}`} title={m.tip}>
      {m.icon}
    </span>
  )
}

function weightsLabel(r: FontFeatureResult): string {
  if (!r.available && r.weights.length > 0) return r.weights.length > 5 ? `${r.weights.length} 档` : r.weights.join(' ')
  if (!r.available || r.weights.length === 0) return '—'
  if (r.isVariable) return `可变 ${r.weights[0]}–${r.weights[r.weights.length - 1]}`
  return r.weights.length <= 5 ? r.weights.join(' ') : `${r.weights.length} 档`
}

export default function FeatureMatrix({ customFonts, fontTick, loadGoogle, onUseFont, onToast }: Props) {
  const [catalog, setCatalog] = useState<CatalogFont[]>([])
  const [query, setQuery] = useState('')
  const [source, setSource] = useState<'all' | FontSource>('all')
  const [showUnavailable, setShowUnavailable] = useState(false)
  const [sortBy, setSortBy] = useState<'default' | 'popularity'>('default')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [loading, setLoading] = useState<Set<string>>(new Set())
  const navigate = useNavigate()

  useEffect(() => {
    let alive = true
    loadCatalog().then((c) => {
      if (alive) setCatalog(c?.fonts ?? [])
    })
    return () => {
      alive = false
    }
  }, [])

  const live = useMemo(
    () => allFontEntries(customFonts).map((e) => detectFont(e.family, e.source)),
    // fontTick 变化代表字体加载状态更新，需要重新检测
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customFonts, fontTick],
  )

  const catalogMap = useMemo(() => new Map(catalog.map((f) => [f.f.toLowerCase(), f])), [catalog])

  const rows = useMemo(() => {
    const seen = new Set(live.map((r) => r.family.toLowerCase()))
    const extra = catalog
      .filter((f) => !seen.has(f.f.toLowerCase()))
      .map((f) => (fontAvailable(f.f) ? detectFont(f.f, 'google') : catalogFeatures(f)))
    return [...live, ...extra]
  }, [live, catalog])

  const rankOf = (family: string) => catalogMap.get(family.toLowerCase())?.r

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = rows.filter((r) => {
      if (!showUnavailable && !r.available) return false
      if (source !== 'all' && r.source !== source) return false
      if (q && !r.family.toLowerCase().includes(q)) return false
      return true
    })
    if (sortBy === 'popularity') {
      return [...list].sort((a, b) => {
        const ra = rankOf(a.family) ?? Infinity
        const rb = rankOf(b.family) ?? Infinity
        return ra !== rb ? ra - rb : a.family.localeCompare(b.family)
      })
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query, source, showUnavailable, sortBy, catalogMap])

  useEffect(() => {
    setLimit(PAGE_SIZE)
  }, [query, source, showUnavailable, sortBy])

  const visible = filtered.slice(0, limit)
  const unavailableCount = rows.filter((r) => !r.available).length

  const handleLoad = async (family: string) => {
    const entry = catalogMap.get(family.toLowerCase())
    setLoading((s) => new Set(s).add(family))
    const ok = await loadGoogle(family, entry ? css2Query(entry) : undefined)
    setLoading((s) => {
      const n = new Set(s)
      n.delete(family)
      return n
    })
    onToast(ok ? `已加载：${family}` : `加载「${family}」失败，请检查网络或改用代理`)
  }

  const inputCls =
    'h-8 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-900 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100'

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <input
          className={`${inputCls} w-56`}
          placeholder="搜索字体名称…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className={inputCls} value={source} onChange={(e) => setSource(e.target.value as 'all' | FontSource)}>
          <option value="all">全部来源</option>
          <option value="local">本地字体</option>
          <option value="google">Google Fonts</option>
          <option value="custom">自定义字体</option>
        </select>
        <select
          className={inputCls}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'default' | 'popularity')}
        >
          <option value="default">默认排序</option>
          <option value="popularity">按热度排序</option>
        </select>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          <input
            type="checkbox"
            className="accent-indigo-600"
            checked={showUnavailable}
            onChange={(e) => setShowUnavailable(e.target.checked)}
          />
          显示未安装/未加载的字体（{unavailableCount}）
        </label>
        <span className="ml-auto text-xs text-zinc-400 dark:text-zinc-500">
          共 {filtered.length} 款{!showUnavailable && unavailableCount > 0 ? `，已隐藏 ${unavailableCount} 款不可用` : ''}
        </span>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        <span>
          <b className="text-emerald-600 dark:text-emerald-400">✓</b> 支持（有真实字形）
        </span>
        <span>
          <b className="text-amber-500">~</b> 可渲染（可能是浏览器合成）
        </span>
        <span>
          <b className="text-red-400">✗</b> 不支持
        </span>
        <span>
          <b className="text-zinc-300 dark:text-zinc-600">?</b> 未知
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              <th className="px-3 py-2.5 font-medium">字体</th>
              <th className="px-2 py-2.5 font-medium">热度</th>
              <th className="px-2 py-2.5 text-center font-medium">等宽</th>
              <th className="px-2 py-2.5 text-center font-medium">中文</th>
              <th className="px-2 py-2.5 text-center font-medium">拉丁</th>
              <th className="px-2 py-2.5 text-center font-medium">数字</th>
              <th className="px-2 py-2.5 text-center font-medium">粗体</th>
              <th className="px-2 py-2.5 text-center font-medium">斜体</th>
              <th className="px-3 py-2.5 font-medium">可用字重</th>
              <th className="px-3 py-2.5 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const rank = rankOf(r.family)
              return (
                <tr
                  key={r.family}
                  className={`border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50 ${
                    r.available ? '' : 'opacity-70'
                  }`}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-3">
                      <span
                        className="w-28 shrink-0 truncate text-lg text-zinc-800 dark:text-zinc-200"
                        style={{ fontFamily: `"${r.family}", sans-serif` }}
                      >
                        Aa 中文 0
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-zinc-800 dark:text-zinc-200">{r.family}</div>
                        <span className={`mt-0.5 inline-block rounded px-1.5 py-px text-[10px] ${SOURCE_CLS[r.source]}`}>
                          {SOURCE_LABEL[r.source]}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 text-xs text-zinc-400 tabular-nums dark:text-zinc-500">
                    {rank ? `#${rank}` : '—'}
                  </td>
                  <td className="px-2 text-center">
                    <Tri v={r.monospace} />
                  </td>
                  <td className="px-2 text-center">
                    <Tri v={r.cjk} />
                  </td>
                  <td className="px-2 text-center">
                    <Tri v={r.latin} />
                  </td>
                  <td className="px-2 text-center">
                    <Tri v={r.digits} />
                  </td>
                  <td className="px-2 text-center">
                    <Tri v={r.bold} />
                  </td>
                  <td className="px-2 text-center">
                    <Tri v={r.italic} />
                  </td>
                  <td className="px-3 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">{weightsLabel(r)}</td>
                  <td className="px-3 text-right">
                    {r.available ? (
                      <button
                        className="h-7 rounded-md border border-zinc-300 px-2.5 text-xs text-zinc-600 hover:border-indigo-400 hover:text-indigo-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
                        onClick={() => {
                          onUseFont(r)
                          navigate('/')
                        }}
                      >
                        用于对比
                      </button>
                    ) : r.source === 'google' ? (
                      <button
                        className="h-7 rounded-md bg-indigo-600 px-2.5 text-xs text-white hover:bg-indigo-500 disabled:opacity-50"
                        disabled={loading.has(r.family)}
                        onClick={() => handleLoad(r.family)}
                      >
                        {loading.has(r.family) ? '加载中…' : '加载并检测'}
                      </button>
                    ) : (
                      <span className="text-xs text-zinc-300 dark:text-zinc-600">未安装</span>
                    )}
                  </td>
                </tr>
              )
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-10 text-center text-sm text-zinc-400">
                  没有匹配的字体
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > limit && (
        <div className="mt-3 text-center">
          <button
            className="h-8 rounded-md border border-zinc-300 bg-white px-4 text-sm text-zinc-600 hover:border-indigo-400 hover:text-indigo-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
            onClick={() => setLimit((l) => l + PAGE_SIZE)}
          >
            显示更多（剩余 {filtered.length - limit} 款）
          </button>
        </div>
      )}

      <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
        检测说明：已加载字体按实际字形检测；未加载的 Google Fonts
        字体按官方目录元数据推断（粗体/斜体看变体，中文看子集覆盖，等宽看分类），「热度」为 Google Fonts 全球使用热度排名。
      </p>
    </div>
  )
}
