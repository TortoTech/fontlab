import { useEffect, useMemo, useState } from 'react'
import { uid } from '../data'

interface Provider {
  id: string
  name: string
  baseURL: string
  apiKey: string
  models: string[]
}

interface ResultItem {
  key: string
  providerName: string
  model: string
  translation: string
  judge: string
  score: number | null
  status: 'pending' | 'translating' | 'judging' | 'done' | 'error'
  error?: string
}

const PROVIDERS_KEY = 'tortolab-providers-v1'
const SETTINGS_KEY = 'tortolab-translate-settings-v1'

const DEFAULT_PROMPT =
  '请将下面的文本翻译成英文。要求：忠实原意、表达流畅、保留原文风格。只输出译文，不要附加解释。'

const DEFAULT_JUDGE_PROMPT = `你是一位资深译审。请评估下面「译文」相对「原文」的翻译质量。

原文：
{source}

译文：
{translation}

按 1-10 分打分（信达雅综合），并给出不超过 100 字的评语。
严格按以下格式输出：
分数: <数字>
评语: <评语>`

interface Settings {
  prompt: string
  text: string
  judgePrompt: string
  selected: string[]
  judgeKey: string
}

const DEFAULT_SETTINGS: Settings = {
  prompt: DEFAULT_PROMPT,
  text: '',
  judgePrompt: DEFAULT_JUDGE_PROMPT,
  selected: [],
  judgeKey: '',
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return { ...fallback, ...(JSON.parse(raw) as T) }
  } catch {
    // ignore
  }
  return fallback
}

function loadProviders(): Provider[] {
  try {
    const raw = localStorage.getItem(PROVIDERS_KEY)
    if (raw) return JSON.parse(raw) as Provider[]
  } catch {
    // ignore
  }
  return []
}

async function callChat(p: Provider, model: string, content: string): Promise<string> {
  const url = p.baseURL.replace(/\/+$/, '') + '/chat/completions'
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.apiKey}` },
    body: JSON.stringify({ model, messages: [{ role: 'user', content }] }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}：${(await res.text()).slice(0, 200)}`)
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  return data.choices?.[0]?.message?.content ?? ''
}

async function listModels(p: Provider): Promise<string[]> {
  const url = p.baseURL.replace(/\/+$/, '') + '/models'
  const res = await fetch(url, { headers: { Authorization: `Bearer ${p.apiKey}` } })
  if (!res.ok) throw new Error(`HTTP ${res.status}：${(await res.text()).slice(0, 200)}`)
  const data = (await res.json()) as { data?: { id: string }[] }
  return (data.data ?? []).map((d) => d.id).sort((a, b) => a.localeCompare(b))
}

function parseScore(text: string): number | null {
  const m = text.match(/分数\s*[:：]\s*([\d.]+)/)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? n : null
}

const inputCls =
  'h-8 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-900 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100'
const areaCls =
  'w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100'
const labelCls = 'mb-1 block text-xs text-zinc-500 dark:text-zinc-400'
const cardCls = 'rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900'

export default function TranslateLab() {
  const [providers, setProviders] = useState<Provider[]>(loadProviders)
  const [settings, setSettings] = useState<Settings>(() => load(SETTINGS_KEY, DEFAULT_SETTINGS))
  const [results, setResults] = useState<ResultItem[]>([])
  const [running, setRunning] = useState(false)
  const [showProviders, setShowProviders] = useState(providers.length === 0)
  const [fetching, setFetching] = useState<Set<string>>(new Set())
  const [fetchErr, setFetchErr] = useState<Record<string, string>>({})
  const [modelQuery, setModelQuery] = useState('')

  useEffect(() => {
    localStorage.setItem(PROVIDERS_KEY, JSON.stringify(providers))
  }, [providers])

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  }, [settings])

  const allModels = useMemo(
    () =>
      providers.flatMap((p) =>
        p.models.map((m) => ({ key: `${p.id}::${m}`, provider: p, model: m })),
      ),
    [providers],
  )

  const findModel = (key: string) => allModels.find((m) => m.key === key)

  const patchProvider = (id: string, patch: Partial<Provider>) =>
    setProviders((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)))

  const fetchModels = async (p: Provider) => {
    setFetching((s) => new Set(s).add(p.id))
    setFetchErr((m) => ({ ...m, [p.id]: '' }))
    try {
      const models = await listModels(p)
      patchProvider(p.id, { models })
    } catch (err) {
      setFetchErr((m) => ({ ...m, [p.id]: err instanceof Error ? err.message : String(err) }))
    } finally {
      setFetching((s) => {
        const n = new Set(s)
        n.delete(p.id)
        return n
      })
    }
  }

  const patchResult = (key: string, patch: Partial<ResultItem>) =>
    setResults((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const run = async () => {
    const judge = findModel(settings.judgeKey)
    const picks = settings.selected
      .map((k) => findModel(k))
      .filter((m): m is NonNullable<typeof m> => Boolean(m))
    if (picks.length === 0 || !settings.text.trim()) return
    setRunning(true)
    setResults(
      picks.map((m) => ({
        key: m.key,
        providerName: m.provider.name,
        model: m.model,
        translation: '',
        judge: '',
        score: null,
        status: 'pending',
      })),
    )
    await Promise.all(
      picks.map(async (m) => {
        try {
          patchResult(m.key, { status: 'translating' })
          const translation = await callChat(m.provider, m.model, settings.prompt + '\n\n' + settings.text)
          patchResult(m.key, { translation, status: judge ? 'judging' : 'done' })
          if (!judge) return
          const judgeOut = await callChat(
            judge.provider,
            judge.model,
            settings.judgePrompt.replace('{source}', settings.text).replace('{translation}', translation),
          )
          patchResult(m.key, { judge: judgeOut, score: parseScore(judgeOut), status: 'done' })
        } catch (err) {
          patchResult(m.key, { status: 'error', error: err instanceof Error ? err.message : String(err) })
        }
      }),
    )
    setRunning(false)
  }

  const sorted = [...results].sort((a, b) => (b.score ?? -1) - (a.score ?? -1))

  return (
    <div className="flex flex-col gap-4">
      <section className={cardCls}>
        <button
          className="flex w-full items-center justify-between text-sm font-medium text-zinc-800 dark:text-zinc-200"
          onClick={() => setShowProviders((v) => !v)}
        >
          AI 提供商（{providers.length}）
          <span className="text-xs text-zinc-400">{showProviders ? '收起' : '展开'}</span>
        </button>
        {showProviders && (
          <div className="mt-3 flex flex-col gap-3">
            {providers.map((p) => (
              <div key={p.id} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                  <label>
                    <span className={labelCls}>名称</span>
                    <input className={`${inputCls} w-full`} value={p.name} onChange={(e) => patchProvider(p.id, { name: e.target.value })} />
                  </label>
                  <label>
                    <span className={labelCls}>Base URL（OpenAI 兼容）</span>
                    <input
                      className={`${inputCls} w-full`}
                      placeholder="https://api.openai.com/v1"
                      value={p.baseURL}
                      onChange={(e) => patchProvider(p.id, { baseURL: e.target.value })}
                    />
                  </label>
                  <label>
                    <span className={labelCls}>API Key</span>
                    <input
                      className={`${inputCls} w-full`}
                      type="password"
                      value={p.apiKey}
                      onChange={(e) => patchProvider(p.id, { apiKey: e.target.value })}
                    />
                  </label>
                  <div className="flex items-end justify-end">
                    <button
                      className="h-8 rounded-md px-3 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                      onClick={() => setProviders((ps) => ps.filter((x) => x.id !== p.id))}
                    >
                      删除
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    className="h-8 rounded-md border border-zinc-300 px-3 text-sm text-zinc-600 hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
                    disabled={fetching.has(p.id) || !p.baseURL.trim()}
                    onClick={() => void fetchModels(p)}
                  >
                    {fetching.has(p.id) ? '获取中…' : p.models.length ? '重新获取模型列表' : '获取模型列表'}
                  </button>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    {p.models.length ? `${p.models.length} 个模型` : '未获取'}
                  </span>
                  {fetchErr[p.id] && <span className="text-xs text-red-500">{fetchErr[p.id]}</span>}
                </div>
              </div>
            ))}
            <button
              className="h-8 self-start rounded-md bg-indigo-600 px-3 text-sm text-white hover:bg-indigo-500"
              onClick={() =>
                setProviders((ps) => [...ps, { id: uid(), name: `提供商 ${ps.length + 1}`, baseURL: '', apiKey: '', models: [] }])
              }
            >
              + 添加提供商
            </button>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              提供商需为 OpenAI 兼容接口（/chat/completions）且允许浏览器跨域调用；配置与密钥仅保存在本机 localStorage。
            </p>
          </div>
        )}
      </section>

      <section className={`${cardCls} grid grid-cols-1 gap-3 lg:grid-cols-2`}>
        <label>
          <span className={labelCls}>翻译提示词</span>
          <textarea className={areaCls} rows={4} value={settings.prompt} onChange={(e) => setSettings((s) => ({ ...s, prompt: e.target.value }))} />
        </label>
        <label>
          <span className={labelCls}>裁判提示词（{'{source}'} / {'{translation}'} 为占位符）</span>
          <textarea className={areaCls} rows={4} value={settings.judgePrompt} onChange={(e) => setSettings((s) => ({ ...s, judgePrompt: e.target.value }))} />
        </label>
        <label className="lg:col-span-2">
          <span className={labelCls}>测试文本</span>
          <textarea className={areaCls} rows={6} placeholder="输入要翻译的文本…" value={settings.text} onChange={(e) => setSettings((s) => ({ ...s, text: e.target.value }))} />
        </label>
        <div>
          <span className={labelCls}>测试模型（可多选）</span>
          <input
            className={`${inputCls} mb-1.5 w-full`}
            placeholder="搜索模型…"
            value={modelQuery}
            onChange={(e) => setModelQuery(e.target.value)}
          />
          <div className="max-h-40 overflow-y-auto rounded-md border border-zinc-200 p-2 dark:border-zinc-700">
            {allModels.length === 0 && <p className="text-xs text-zinc-400">请先配置提供商并获取模型列表</p>}
            {providers.map((p) => {
              const shown = p.models.filter((m) => m.toLowerCase().includes(modelQuery.trim().toLowerCase()))
              return shown.length ? (
                <div key={p.id} className="mb-1.5">
                  <p className="mb-0.5 text-xs font-medium text-zinc-400">{p.name}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {shown.map((m) => {
                      const key = `${p.id}::${m}`
                      return (
                        <label key={m} className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                          <input
                            type="checkbox"
                            className="accent-indigo-600"
                            checked={settings.selected.includes(key)}
                            onChange={(e) =>
                              setSettings((s) => ({
                                ...s,
                                selected: e.target.checked ? [...s.selected, key] : s.selected.filter((k) => k !== key),
                              }))
                            }
                          />
                          {m}
                        </label>
                      )
                    })}
                  </div>
                </div>
              ) : null
            })}
          </div>
        </div>
        <div className="flex flex-col justify-end gap-2">
          <label>
            <span className={labelCls}>裁判模型</span>
            <select className={`${inputCls} w-full`} value={settings.judgeKey} onChange={(e) => setSettings((s) => ({ ...s, judgeKey: e.target.value }))}>
              <option value="">不裁判</option>
              {allModels.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.provider.name} / {m.model}
                </option>
              ))}
            </select>
          </label>
          <button
            className="h-9 rounded-md bg-indigo-600 text-sm text-white hover:bg-indigo-500 disabled:opacity-50"
            disabled={running || settings.selected.length === 0 || !settings.text.trim()}
            onClick={() => void run()}
          >
            {running ? '运行中…' : `开始测试（${settings.selected.length} 个模型）`}
          </button>
        </div>
      </section>

      {sorted.length > 0 && (
        <section className="flex flex-col gap-3">
          {sorted.map((r) => (
            <div key={r.key} className={cardCls}>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  {r.providerName} / {r.model}
                </span>
                {r.score !== null && (
                  <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-semibold text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                    {r.score} 分
                  </span>
                )}
                <span className="ml-auto text-xs text-zinc-400">
                  {r.status === 'translating' && '翻译中…'}
                  {r.status === 'judging' && '裁判中…'}
                  {r.status === 'done' && '完成'}
                  {r.status === 'error' && `失败：${r.error}`}
                </span>
              </div>
              {r.translation && (
                <pre className="mb-2 whitespace-pre-wrap rounded-md bg-zinc-50 p-3 text-sm leading-6 text-zinc-700 dark:bg-zinc-950/60 dark:text-zinc-300">
                  {r.translation}
                </pre>
              )}
              {r.judge && (
                <pre className="whitespace-pre-wrap rounded-md bg-amber-50/60 p-3 text-xs leading-5 text-zinc-600 dark:bg-amber-950/20 dark:text-zinc-400">
                  {r.judge}
                </pre>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
