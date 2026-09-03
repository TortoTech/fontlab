import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { catalogFeatures, css2Query, loadCatalog, loadFeatures } from '../catalog'
import type { OfflineFeatures } from '../catalog'
import type { CatalogFont } from '../catalog'
import { allFontEntries } from '../data'
import { detectFont } from '../detect'
import type { FontFeatureResult, TriState } from '../detect'
import { analyzeLocalFont, LOCAL_CURATED_FAMILIES, queryLocalFonts } from '../localFonts'
import type { LocalFontAnalysis, LocalFontInfo } from '../localFonts'
import { downloadFamilyZip, officialDownloadUrl } from '../downloads'
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

const TH_STICKY =
  'sticky top-0 z-10 bg-white py-2.5 shadow-[inset_0_-1px_0_#e4e4e7] dark:bg-zinc-900 dark:shadow-[inset_0_-1px_0_#27272a]'
const TD_STICKY =
  'sticky left-0 z-10 bg-white group-hover:bg-zinc-50 dark:bg-zinc-900 dark:group-hover:bg-zinc-800'

function Tri({ v }: { v: TriState }) {
  const m = TRI_META[v]
  return (
    <span className={`inline-block w-5 text-center text-sm font-bold ${m.cls}`} title={m.tip}>
      {m.icon}
    </span>
  )
}

const SCRIPT_LABEL: [string, string][] = [
  ['chinese-simplified', '简中'],
  ['chinese-traditional', '繁中'],
  ['japanese', '日文'],
  ['korean', '韩文'],
  ['arabic', '阿拉伯'],
  ['hebrew', '希伯来'],
  ['greek', '希腊'],
  ['cyrillic', '西里尔'],
  ['thai', '泰文'],
  ['devanagari', '天城文'],
  ['latin', '拉丁'],
]

function langLabel(subsets: string[] | undefined, pl?: string): string {
  if (pl) return pl
  if (!subsets?.length) return '—'
  const labels = SCRIPT_LABEL.filter(([k]) => subsets.includes(k)).map(([, v]) => v)
  if (labels.length === 0) return subsets[0]
  return labels.length > 2 ? `${labels.slice(0, 2).join('/')} +${labels.length - 2}` : labels.join('/')
}

function figuresLabel(r: FontFeatureResult): string {
  if (!r.figures) return '—'
  const f = r.figures
  if (f.def === 'unknown') return f.onum === 'yes' ? '支持旧式' : '—'
  if (f.def === 'oldstyle') return f.onum === 'yes' ? '旧式·可齐线' : '旧式'
  return f.onum === 'yes' ? '齐线·可旧式' : '齐线'
}

function applyFeatures(r: FontFeatureResult, f: OfflineFeatures): FontFeatureResult {
  const has = (t: string): TriState => (f.ft.includes(t) ? 'yes' : 'no')
  const onum = has('onum')
  return {
    ...r,
    cjk: f.cjk !== undefined ? (f.cjk ? 'yes' : 'no') : r.cjk,
    latin: f.lat !== undefined ? (f.lat ? 'yes' : 'no') : r.latin,
    digits: f.dig !== undefined ? (f.dig ? 'yes' : 'no') : r.digits,
    monospace: f.mono !== undefined ? (f.mono ? 'yes' : 'no') : r.monospace,
    liga: has('liga'),
    tnum: has('tnum'),
    smcp: has('smcp'),
    frac: has('frac'),
    sups: has('sups'),
    subs: has('subs'),
    ordn: has('ordn'),
    figures: r.figures ? { ...r.figures, onum } : { def: f.fd ?? 'unknown', onum },
  }
}

function weightsLabel(r: FontFeatureResult): string {
  if (!r.available && r.weights.length > 0) return r.weights.length > 5 ? `${r.weights.length} 档` : r.weights.join(' ')
  if (!r.available || r.weights.length === 0) return '—'
  if (r.isVariable) return `可变 ${r.weights[0]}–${r.weights[r.weights.length - 1]}`
  return r.weights.length <= 5 ? r.weights.join(' ') : `${r.weights.length} 档`
}

type ColKey =
  | 'style'
  | 'lang'
  | 'cjk'
  | 'latin'
  | 'digits'
  | 'figures'
  | 'tnum'
  | 'liga'
  | 'frac'
  | 'supsub'
  | 'ordn'
  | 'mono'
  | 'bold'
  | 'italic'
  | 'smcp'
  | 'weights'
  | 'axes'

interface ColDef {
  key: ColKey
  label: string
  center?: boolean
  defaultOn: boolean
}

const COLUMNS: ColDef[] = [
  { key: 'style', label: '风格', defaultOn: true },
  { key: 'lang', label: '语言', defaultOn: true },
  { key: 'cjk', label: '中文', center: true, defaultOn: true },
  { key: 'latin', label: '拉丁', center: true, defaultOn: true },
  { key: 'digits', label: '数字', center: true, defaultOn: true },
  { key: 'figures', label: '数字风格', defaultOn: true },
  { key: 'tnum', label: '表格数字', center: true, defaultOn: true },
  { key: 'liga', label: '连字', center: true, defaultOn: false },
  { key: 'frac', label: '分数', center: true, defaultOn: false },
  { key: 'supsub', label: '上/下标', center: true, defaultOn: false },
  { key: 'ordn', label: '序数', center: true, defaultOn: false },
  { key: 'mono', label: '等宽', center: true, defaultOn: true },
  { key: 'bold', label: '粗体', center: true, defaultOn: true },
  { key: 'italic', label: '斜体', center: true, defaultOn: true },
  { key: 'smcp', label: '小型大写', center: true, defaultOn: true },
  { key: 'weights', label: '可用字重', defaultOn: true },
  { key: 'axes', label: '可变轴', defaultOn: true },
]

const COLS_KEY = 'fontlab-matrix-cols-v1'

function Cell({ col, r, cat }: { col: ColDef; r: FontFeatureResult; cat?: CatalogFont }) {
  const tc = 'px-2 text-center'
  const tx = 'max-w-28 truncate px-2 text-xs text-zinc-500 dark:text-zinc-400'
  switch (col.key) {
    case 'style':
      return (
        <td className={tx} title={cat?.cl?.join(' / ')}>
          {cat?.cl?.length ? cat.cl.join('/') : '—'}
        </td>
      )
    case 'lang':
      return (
        <td className={tx} title={cat?.s?.join(' ')}>
          {langLabel(cat?.s, cat?.pl)}
        </td>
      )
    case 'cjk':
      return (
        <td className={tc}>
          <Tri v={r.cjk} />
        </td>
      )
    case 'latin':
      return (
        <td className={tc}>
          <Tri v={r.latin} />
        </td>
      )
    case 'digits':
      return (
        <td className={tc}>
          <Tri v={r.digits} />
        </td>
      )
    case 'figures':
      return (
        <td
          className="max-w-32 truncate px-2 text-xs text-zinc-500 dark:text-zinc-400"
          title="默认数字风格 / 是否支持旧式数字（onum 特性）"
        >
          {figuresLabel(r)}
        </td>
      )
    case 'tnum':
      return (
        <td className={tc} title="是否支持表格数字（tnum，数字等宽对齐）">
          <Tri v={r.tnum} />
        </td>
      )
    case 'liga':
      return (
        <td className={tc} title="是否支持连字（liga）">
          <Tri v={r.liga} />
        </td>
      )
    case 'frac':
      return (
        <td className={tc} title="是否支持分数（frac）">
          <Tri v={r.frac} />
        </td>
      )
    case 'supsub': {
      const v: TriState =
        r.sups === 'yes' && r.subs === 'yes'
          ? 'yes'
          : r.sups === 'yes' || r.subs === 'yes'
            ? 'maybe'
            : r.sups === 'unknown' || r.subs === 'unknown'
              ? 'unknown'
              : 'no'
      return (
        <td className={tc} title="上标/下标（sups / subs），~ 表示仅支持其一">
          <Tri v={v} />
        </td>
      )
    }
    case 'ordn':
      return (
        <td className={tc} title="是否支持序数（ordn）">
          <Tri v={r.ordn} />
        </td>
      )
    case 'mono':
      return (
        <td className={tc}>
          <Tri v={r.monospace} />
        </td>
      )
    case 'bold':
      return (
        <td className={tc}>
          <Tri v={r.bold} />
        </td>
      )
    case 'italic':
      return (
        <td className={tc}>
          <Tri v={r.italic} />
        </td>
      )
    case 'smcp':
      return (
        <td className={tc} title="是否支持真实小型大写字母（smcp）">
          <Tri v={r.smcp} />
        </td>
      )
    case 'weights':
      return <td className="px-3 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">{weightsLabel(r)}</td>
    case 'axes':
      return (
        <td className={tx} title={cat?.ax?.join(' / ')}>
          {cat?.ax?.length ? cat.ax.map((a) => a.split(' ')[0]).join('/') : '—'}
        </td>
      )
  }
}

export default function FeatureMatrix({ customFonts, fontTick, loadGoogle, onUseFont, onToast }: Props) {
  const [catalog, setCatalog] = useState<CatalogFont[]>([])
  const [featuresMap, setFeaturesMap] = useState<Map<string, OfflineFeatures> | null>(null)
  const [query, setQuery] = useState('')
  const [source, setSource] = useState<'all' | FontSource>('all')
  const [showUnavailable, setShowUnavailable] = useState(false)
  const [sortBy, setSortBy] = useState<'default' | 'popularity'>('default')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [loading, setLoading] = useState<Set<string>>(new Set())
  const [downloading, setDownloading] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<string | null>(null)
  const [localInfo, setLocalInfo] = useState<Map<string, LocalFontInfo> | null>(null)
  const [localAnalysis, setLocalAnalysis] = useState<Map<string, LocalFontAnalysis>>(() => new Map())
  const [localStatus, setLocalStatus] = useState<'pending' | 'on' | 'off'>('pending')
  const [colsOpen, setColsOpen] = useState(false)
  const [cols, setCols] = useState<Record<string, boolean>>(() => {
    const base: Record<string, boolean> = {}
    COLUMNS.forEach((c) => (base[c.key] = c.defaultOn))
    try {
      return { ...base, ...(JSON.parse(localStorage.getItem(COLS_KEY) ?? '{}') as Record<string, boolean>) }
    } catch {
      return base
    }
  })
  const booting = useRef(false)
  const navigate = useNavigate()

  useEffect(() => {
    localStorage.setItem(COLS_KEY, JSON.stringify(cols))
  }, [cols])

  const activeCols = COLUMNS.filter((c) => cols[c.key])
  const colCount = activeCols.length + 2

  const bootLocal = useCallback(async () => {
    if (booting.current) return
    booting.current = true
    const res = await queryLocalFonts()
    if (res.status === 'needs-activation') {
      booting.current = false
      const retry = () => void bootLocal()
      window.addEventListener('pointerdown', retry, { once: true })
      window.addEventListener('keydown', retry, { once: true })
      return
    }
    if (res.status !== 'ok' || !res.result) {
      setLocalStatus('off')
      return
    }
    setLocalStatus('on')
    setLocalInfo(res.result.info)
    const { blobs } = res.result
    const queue = LOCAL_CURATED_FAMILIES.filter((k) => blobs.has(k))
    const worker = async () => {
      for (;;) {
        const key = queue.shift()
        if (!key) return
        const getBlob = blobs.get(key)
        if (!getBlob) continue
        const a = await analyzeLocalFont(getBlob)
        if (a.cjk !== null || a.onum !== null) setLocalAnalysis((m) => new Map(m).set(key, a))
      }
    }
    void worker()
    void worker()
  }, [])

  useEffect(() => {
    void bootLocal()
  }, [bootLocal])

  useEffect(() => {
    let alive = true
    loadCatalog().then((c) => {
      if (alive) setCatalog(c?.fonts ?? [])
    })
    loadFeatures().then((m) => {
      if (alive) setFeaturesMap(m)
    })
    return () => {
      alive = false
    }
  }, [])

  const customFt = useMemo(() => {
    const m = new Map<string, OfflineFeatures>()
    customFonts.forEach((c) => {
      if (c.ft) m.set(c.name.toLowerCase(), { ft: c.ft, fd: c.fd })
    })
    return m
  }, [customFonts])

  const live = useMemo(
    () =>
      allFontEntries(customFonts).map((e) => {
        let r = detectFont(e.family, e.source)
        const key = e.family.toLowerCase()
        const cft = customFt.get(key)
        if (cft) r = applyFeatures(r, cft)
        if (r.available && r.source === 'local' && localInfo) {
          const info = localInfo.get(key)
          if (info) {
            r = {
              ...r,
              bold: info.weights.some((w) => w >= 600) ? 'yes' : 'no',
              italic: info.italic ? 'yes' : 'no',
              weights: info.weights,
              isVariable: false,
            }
          }
        }
        if (r.available) {
          const an = localAnalysis.get(key)
          if (an) {
            if (an.cjk !== null) r = { ...r, cjk: an.cjk ? 'yes' : 'no' }
            if (an.onum !== null && r.figures) {
              r = { ...r, figures: { ...r.figures, onum: an.onum ? 'yes' : 'no' } }
            }
            if (an.tnum !== null) r = { ...r, tnum: an.tnum ? 'yes' : 'no' }
            if (an.smcp !== null) r = { ...r, smcp: an.smcp ? 'yes' : 'no' }
            if (an.liga !== null) r = { ...r, liga: an.liga ? 'yes' : 'no' }
            if (an.frac !== null) r = { ...r, frac: an.frac ? 'yes' : 'no' }
            if (an.sups !== null) r = { ...r, sups: an.sups ? 'yes' : 'no' }
            if (an.subs !== null) r = { ...r, subs: an.subs ? 'yes' : 'no' }
            if (an.ordn !== null) r = { ...r, ordn: an.ordn ? 'yes' : 'no' }
          }
        }
        return r
      }),
    // fontTick 变化代表字体加载状态更新，需要重新检测
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customFonts, fontTick, localInfo, localAnalysis, customFt],
  )

  const catalogMap = useMemo(() => new Map(catalog.map((f) => [f.f.toLowerCase(), f])), [catalog])

  const rows = useMemo(() => {
    const seen = new Set<string>()
    const withMeta = (r: FontFeatureResult): FontFeatureResult => {
      let out = r
      if (!out.available && out.source === 'google') {
        const entry = catalogMap.get(out.family.toLowerCase())
        if (entry) out = catalogFeatures(entry)
      }
      if (out.source === 'google') {
        const ft = featuresMap?.get(out.family.toLowerCase())
        if (ft) out = applyFeatures(out, ft)
      }
      return out
    }
    const enriched = live.map((r) => {
      seen.add(r.family.toLowerCase())
      return withMeta(r)
    })
    const extra = catalog
      .filter((f) => !seen.has(f.f.toLowerCase()))
      .map((f) => withMeta(detectFont(f.f, 'google')))
    return [...enriched, ...extra]
  }, [live, catalog, catalogMap, featuresMap])

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

  const handleDownload = async (family: string) => {
    setDownloading((s) => new Set(s).add(family))
    try {
      const ok = await downloadFamilyZip(family)
      if (!ok) window.open(officialDownloadUrl(family), '_blank', 'noopener')
    } catch {
      window.open(officialDownloadUrl(family), '_blank', 'noopener')
    } finally {
      setDownloading((s) => {
        const n = new Set(s)
        n.delete(family)
        return n
      })
    }
  }

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
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
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
        <div className="relative">
          <button className={inputCls} onClick={() => setColsOpen((o) => !o)}>
            列 ▾
          </button>
          {colsOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setColsOpen(false)} />
              <div className="absolute left-0 top-9 z-30 w-72 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                <div className="grid grid-cols-3 gap-x-2 gap-y-1.5">
                  {COLUMNS.map((c) => (
                    <label
                      key={c.key}
                      className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300"
                    >
                      <input
                        type="checkbox"
                        className="accent-indigo-600"
                        checked={cols[c.key]}
                        onChange={(e) => setCols((m) => ({ ...m, [c.key]: e.target.checked }))}
                      />
                      {c.label}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
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

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
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
        <span className="ml-auto text-zinc-400 dark:text-zinc-500">
          {localStatus === 'on'
            ? '本地字体精确检测：已启用'
            : localStatus === 'pending'
              ? '本地字体精确检测：等待授权…'
              : '本地字体精确检测：不可用，使用启发式'}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full border-collapse text-sm" style={{ minWidth: 320 + activeCols.length * 76 }}>
          <thead>
            <tr className="text-left text-xs text-zinc-500 dark:text-zinc-400">
              <th className={`${TH_STICKY} left-0 z-20 w-72 max-w-72 px-3 font-medium`}>字体</th>
              {activeCols.map((c) => (
                <th key={c.key} className={`${TH_STICKY} px-2 font-medium ${c.center ? 'text-center' : ''}`}>
                  {c.label}
                </th>
              ))}
              <th className={`${TH_STICKY} px-3 text-right font-medium`}>操作</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const cat = catalogMap.get(r.family.toLowerCase())
              const hasDetail = Boolean(cat && (cat.desc || cat.cl?.length || cat.y || cat.d?.length))
              const isOpen = expanded === r.family
              return (
                <Fragment key={r.family}>
                  <tr
                    className={`group border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50 ${
                      r.available ? '' : 'opacity-70'
                    } ${isOpen ? 'bg-zinc-50 dark:bg-zinc-800/50' : ''}`}
                  >
                    <td className={`${TD_STICKY} max-w-72 px-3 py-2`}>
                      <div className="flex items-center gap-3">
                        <span
                          className="w-28 shrink-0 truncate text-lg text-zinc-800 dark:text-zinc-200"
                          style={{ fontFamily: `"${r.family}", sans-serif` }}
                        >
                          Aa 中文 0
                        </span>
                        <div className="min-w-0">
                          <button
                            className={`block max-w-full truncate font-medium text-zinc-800 dark:text-zinc-200 ${
                              hasDetail ? 'cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400' : 'cursor-default'
                            }`}
                            title={hasDetail ? (isOpen ? '收起介绍' : '查看介绍') : undefined}
                            onClick={() => hasDetail && setExpanded(isOpen ? null : r.family)}
                          >
                            {r.family}
                          </button>
                          <span className={`mt-0.5 inline-block rounded px-1.5 py-px text-[10px] ${SOURCE_CLS[r.source]}`}>
                            {SOURCE_LABEL[r.source]}
                          </span>
                        </div>
                      </div>
                    </td>
                    {activeCols.map((c) => (
                      <Cell key={c.key} col={c} r={r} cat={cat ?? undefined} />
                    ))}
                    <td className="px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {r.source === 'google' && (
                          <button
                            className="inline-flex h-7 items-center rounded-md border border-zinc-300 px-2.5 text-xs text-zinc-600 hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
                            disabled={downloading.has(r.family)}
                            onClick={() => void handleDownload(r.family)}
                            title="在当前页打包下载可安装字体（ttf zip）"
                          >
                            {downloading.has(r.family) ? '打包中…' : '下载'}
                          </button>
                        )}
                        {r.available ? (
                          <button
                            className="h-7 rounded-md border border-zinc-300 px-2.5 text-xs text-zinc-600 hover:border-indigo-400 hover:text-indigo-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
                            onClick={() => {
                              onUseFont(r)
                              navigate('/')
                            }}
                          >
                            对比
                          </button>
                        ) : r.source === 'google' ? (
                          <button
                            className="h-7 rounded-md bg-indigo-600 px-2.5 text-xs text-white hover:bg-indigo-500 disabled:opacity-50"
                            disabled={loading.has(r.family)}
                            onClick={() => handleLoad(r.family)}
                          >
                            {loading.has(r.family) ? '加载中…' : '加载'}
                          </button>
                        ) : (
                          <span className="text-xs text-zinc-300 dark:text-zinc-600">未安装</span>
                        )}
                      </div>
                    </td>
                  </tr>
                  {isOpen && cat && (
                    <tr className="border-b border-zinc-100 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-800/30">
                      <td colSpan={colCount} className="px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">
                        {cat.desc && <p className="mb-1.5 max-w-3xl leading-5">{cat.desc}</p>}
                        <p className="flex flex-wrap gap-x-4 gap-y-1">
                          {cat.d && cat.d.length > 0 && <span>设计师：{cat.d.join('、')}</span>}
                          {cat.cl && cat.cl.length > 0 && <span>风格：{cat.cl.join(' / ')}</span>}
                          {(cat.ps || cat.pl) && (
                            <span>主要文字/语言：{[cat.ps, cat.pl].filter(Boolean).join(' / ')}</span>
                          )}
                          {cat.y && <span>收录于 {cat.y}</span>}
                        </p>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-3 py-10 text-center text-sm text-zinc-400">
                  没有匹配的字体
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > limit && (
        <div className="text-center">
          <button
            className="h-8 rounded-md border border-zinc-300 bg-white px-4 text-sm text-zinc-600 hover:border-indigo-400 hover:text-indigo-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
            onClick={() => setLimit((l) => l + PAGE_SIZE)}
          >
            显示更多（剩余 {filtered.length - limit} 款）
          </button>
        </div>
      )}
    </div>
  )
}
