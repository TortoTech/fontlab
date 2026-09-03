import { useEffect, useMemo, useState } from 'react'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { generateText, streamText } from 'ai'
import { jsonrepair } from 'jsonrepair'
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
  id: string
  providerName: string
  model: string
  translation: string
  judge: string
  score: number | null
  follow: number | null
  ttft: number | null
  tps: number | null
  status: 'pending' | 'translating' | 'judging' | 'done' | 'error'
  error?: string
}

const PROVIDERS_KEY = 'tortolab-providers-v1'
const SETTINGS_KEY = 'tortolab-translate-settings-v1'

const DEFAULT_PROMPT =
  '请将下面的文本翻译成英文。要求：忠实原意、表达流畅、保留原文风格。只输出译文，不要附加解释。'

const LEGACY_JUDGE_PROMPTS = [
  `你是一位资深译审。请评估下面「译文」相对「原文」的翻译质量。

原文：
{source}

译文：
{translation}

按 1-10 分打分（信达雅综合），并给出不超过 100 字的评语。
严格按以下格式输出：
分数: <数字>
评语: <评语>`,
  `你是一位资深译审。请评估「译文」相对「原文」的翻译质量，并检查译文是否遵循「翻译要求」。

翻译要求：
{prompt}

原文：
{source}

译文：
{translation}

按 1-10 分打分：
- 质量分：信达雅综合水平
- 遵循分：对翻译要求的遵循程度（风格、格式、约束等）

严格按以下格式输出：
质量分: <数字>
遵循分: <数字>
评语: <不超过 100 字的评语>`,
]

const DEFAULT_JUDGE_PROMPT = `你是一位资深译审。请逐条评估各译文相对「原文」的翻译质量，并检查是否遵循「翻译要求」。

翻译要求：
{prompt}

原文：
{source}

译文：
{translations}

每条译文按 1-10 分打分：
- quality：信达雅综合水平
- follow：对翻译要求的遵循程度（风格、格式、约束等）

只输出 JSON 数组，不要输出任何其他内容：
[{"id": "<译文编号，如 T1>", "quality": <数字>, "follow": <数字>, "comment": "<不超过 50 字的评语>"}]`

interface Settings {
  prompt: string
  text: string
  judgePrompt: string
  selected: string[]
  judgeKey: string
  reasoning: string
}

const DEFAULT_SETTINGS: Settings = {
  prompt: DEFAULT_PROMPT,
  text: '',
  judgePrompt: DEFAULT_JUDGE_PROMPT,
  selected: [],
  judgeKey: '',
  reasoning: '',
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

function loadSettings(): Settings {
  const s = load(SETTINGS_KEY, DEFAULT_SETTINGS)
  if (LEGACY_JUDGE_PROMPTS.includes(s.judgePrompt)) s.judgePrompt = DEFAULT_JUDGE_PROMPT
  return s
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

function makeProvider(p: Provider) {
  return createOpenAICompatible({
    name: p.id,
    apiKey: p.apiKey,
    baseURL: p.baseURL.replace(/\/+$/, ''),
    includeUsage: true,
  })
}

interface GenOpts {
  reasoning: string
}

function genParams(p: Provider, o: GenOpts) {
  return {
    providerOptions: o.reasoning ? { [p.id]: { reasoningEffort: o.reasoning } } : undefined,
  }
}

async function callChat(p: Provider, model: string, content: string, o: GenOpts): Promise<string> {
  const { text } = await generateText({
    model: makeProvider(p)(model),
    prompt: content,
    ...genParams(p, o),
  })
  return text
}

interface StreamResult {
  text: string
  completionTokens: number | null
  ttft: number | null
}

async function callChatStream(
  p: Provider,
  model: string,
  content: string,
  o: GenOpts,
): Promise<StreamResult> {
  const result = streamText({
    model: makeProvider(p)(model),
    prompt: content,
    ...genParams(p, o),
  })
  const t0 = performance.now()
  let ttft: number | null = null
  let text = ''
  for await (const chunk of result.textStream) {
    if (ttft === null) ttft = performance.now() - t0
    text += chunk
  }
  if (!text) throw new Error('流式响应为空')
  const usage = await result.usage
  return { text, completionTokens: usage?.outputTokens ?? null, ttft }
}

function estimateTokens(s: string): number {
  let cjk = 0
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0
    if (cp >= 0x3000 && cp <= 0x9fff) cjk++
  }
  return Math.max(1, Math.round(cjk + (s.length - cjk) / 4))
}

async function listModels(p: Provider): Promise<string[]> {
  const url = p.baseURL.replace(/\/+$/, '') + '/models'
  const res = await fetch(url, { headers: { Authorization: `Bearer ${p.apiKey}` } })
  if (!res.ok) throw new Error(`HTTP ${res.status}：${(await res.text()).slice(0, 200)}`)
  const data = (await res.json()) as { data?: { id: string }[] }
  return (data.data ?? []).map((d) => d.id).sort((a, b) => a.localeCompare(b))
}

interface JudgeEntry {
  id?: string | number
  quality?: number | string
  follow?: number | string
  comment?: string
}

function parseJudgeJson(text: string): JudgeEntry[] {
  const tryParse = (t: string): JudgeEntry[] => {
    const data: unknown = JSON.parse(jsonrepair(t))
    if (Array.isArray(data)) return data as JudgeEntry[]
    if (data && typeof data === 'object') {
      const wrapped = (data as Record<string, unknown>).results
      if (Array.isArray(wrapped)) return wrapped as JudgeEntry[]
    }
    return []
  }
  try {
    const r = tryParse(text)
    if (r.length) return r
  } catch {
    // fallthrough to slice
  }
  const s = text.indexOf('[')
  const e = text.lastIndexOf(']')
  if (s >= 0 && e > s) {
    try {
      return tryParse(text.slice(s, e + 1))
    } catch {
      // ignore
    }
  }
  return []
}

const toNum = (v: unknown): number | null => {
  const n = Number(v)
  return v !== undefined && v !== null && v !== '' && Number.isFinite(n) ? n : null
}

const inputCls =
  'h-8 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-900 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100'
const areaCls =
  'w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100'
const labelCls = 'mb-1 block text-xs text-zinc-500 dark:text-zinc-400'
const cardCls = 'rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900'

export default function TranslateLab() {
  const [providers, setProviders] = useState<Provider[]>(loadProviders)
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [results, setResults] = useState<ResultItem[]>([])
  const [running, setRunning] = useState(false)
  const [showProviders, setShowProviders] = useState(providers.length === 0)
  const [fetching, setFetching] = useState<Set<string>>(new Set())
  const [fetchErr, setFetchErr] = useState<Record<string, string>>({})
  const [modelQuery, setModelQuery] = useState('')
  const [judgeOpen, setJudgeOpen] = useState(false)
  const [judgeQuery, setJudgeQuery] = useState('')

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
    const genOpts: GenOpts = { reasoning: settings.reasoning }
    setRunning(true)
    setResults(
      picks.map((m, i) => ({
        key: m.key,
        id: `T${i + 1}`,
        providerName: m.provider.name,
        model: m.model,
        translation: '',
        judge: '',
        score: null,
        follow: null,
        ttft: null,
        tps: null,
        status: 'pending' as const,
      })),
    )
    const outcomes: { id: string; key: string; model: string; translation: string | null }[] = await Promise.all(
      picks.map(async (m, i) => {
        const id = `T${i + 1}`
        try {
          patchResult(m.key, { status: 'translating' })
          const content = settings.prompt + '\n\n' + settings.text
          let translation: string
          let ttft: number | null = null
          let tps: number | null = null
          try {
            const t0 = performance.now()
            const sr = await callChatStream(m.provider, m.model, content, genOpts)
            const total = performance.now() - t0
            translation = sr.text
            ttft = sr.ttft
            const tokens = sr.completionTokens ?? estimateTokens(translation)
            const genMs = ttft !== null ? Math.max(total - ttft, 1) : total
            tps = Math.round((tokens * 1000) / genMs)
          } catch {
            translation = await callChat(m.provider, m.model, content, genOpts)
          }
          patchResult(m.key, { translation, ttft, tps, status: judge ? 'judging' : 'done' })
          return { id, key: m.key, model: m.model, translation }
        } catch (err) {
          patchResult(m.key, { status: 'error', error: err instanceof Error ? err.message : String(err) })
          return { id, key: m.key, model: m.model, translation: null }
        }
      }),
    )
    if (judge) {
      const doneOnes = outcomes.filter((o) => o.translation !== null)
      if (doneOnes.length > 0) {
        const block = doneOnes.map((o) => `${o.id}（模型：${o.model}）:\n${o.translation}`).join('\n\n')
        const content = settings.judgePrompt
          .replace('{prompt}', settings.prompt)
          .replace('{source}', settings.text)
          .replace('{translations}', block)
        try {
          const out = await callChat(judge.provider, judge.model, content, { reasoning: '' })
          const byId = new Map(parseJudgeJson(out).map((e) => [String(e.id), e]))
          for (const o of doneOnes) {
            const e = byId.get(o.id)
            patchResult(o.key, {
              status: 'done',
              score: toNum(e?.quality),
              follow: toNum(e?.follow),
              judge: typeof e?.comment === 'string' ? e.comment : '',
            })
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          for (const o of doneOnes) patchResult(o.key, { status: 'done', error: `裁判失败：${msg}` })
        }
        setResults((rs) => rs.map((r) => (r.status === 'judging' ? { ...r, status: 'done' } : r)))
      }
    }
    setRunning(false)
  }

  const sorted = [...results].sort(
    (a, b) => a.model.localeCompare(b.model) || a.providerName.localeCompare(b.providerName),
  )

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
          <span className={labelCls}>裁判提示词（{'{prompt}'} / {'{source}'} / {'{translations}'} 为占位符，裁判一次请求、JSON 输出）</span>
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
          <div>
            <span className={labelCls}>裁判模型（输入可搜索）</span>
            <div className="relative">
              <input
                className={`${inputCls} w-full`}
                placeholder="不裁判（输入以搜索模型）"
                value={judgeOpen ? judgeQuery : (() => { const j = findModel(settings.judgeKey); return j ? `${j.provider.name} / ${j.model}` : '' })()}
                onFocus={() => {
                  setJudgeOpen(true)
                  setJudgeQuery('')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setJudgeOpen(false)
                    setJudgeQuery('')
                  }
                }}
                onChange={(e) => {
                  setJudgeQuery(e.target.value)
                  setJudgeOpen(true)
                }}
              />
              {judgeOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setJudgeOpen(false)} />
                  <div className="absolute left-0 top-9 z-30 max-h-56 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                    <button
                      className="block w-full rounded px-2 py-1.5 text-left text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      onClick={() => {
                        setSettings((s) => ({ ...s, judgeKey: '' }))
                        setJudgeOpen(false)
                      }}
                    >
                      不裁判
                    </button>
                    {allModels
                      .filter((m) =>
                        `${m.provider.name} ${m.model}`.toLowerCase().includes(judgeQuery.trim().toLowerCase()),
                      )
                      .map((m) => (
                        <button
                          key={m.key}
                          className="block w-full truncate rounded px-2 py-1.5 text-left text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                          onClick={() => {
                            setSettings((s) => ({ ...s, judgeKey: m.key }))
                            setJudgeOpen(false)
                          }}
                        >
                          {m.provider.name} / {m.model}
                        </button>
                      ))}
                  </div>
                </>
              )}
            </div>
          </div>
          <label>
            <span className={labelCls}>思考等级（仅测试模型，裁判不受影响；取决于提供商支持）</span>
            <select
              className={`${inputCls} w-full`}
              value={settings.reasoning}
              onChange={(e) => setSettings((s) => ({ ...s, reasoning: e.target.value }))}
            >
              <option value="">默认</option>
              <option value="none">none（关闭）</option>
              <option value="minimal">minimal</option>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
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
                    质量 {r.score}
                  </span>
                )}
                {r.follow !== null && (
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                    遵循 {r.follow}
                  </span>
                )}
                {(r.ttft !== null || r.tps !== null) && (
                  <span
                    className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500 tabular-nums dark:bg-zinc-800 dark:text-zinc-400"
                    title="首字耗时 / 生成速度（输出 token ÷（完成 − 首字）；无 usage 时按字符估算 token）"
                  >
                    {r.ttft !== null ? `首字 ${(r.ttft / 1000).toFixed(2)}s` : ''}
                    {r.ttft !== null && r.tps !== null ? ' · ' : ''}
                    {r.tps !== null ? `${r.tps} tok/s` : ''}
                  </span>
                )}
                <span className="ml-auto text-xs text-zinc-400">
                  {r.status === 'translating' && '翻译中…'}
                  {r.status === 'judging' && '裁判中…'}
                  {r.status === 'done' && (r.error ?? '完成')}
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
