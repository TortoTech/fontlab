import { useState } from 'react'
import { bufToBase64, guessFamilyFromUrl, guessMime, parseFamilyFromCss } from '../fontUtils'
import type { CustomFont } from '../types'

type Kind = 'url' | 'css' | 'file'

interface Props {
  customFonts: CustomFont[]
  onClose: () => void
  onAdd: (font: CustomFont) => Promise<void>
  onRemove: (name: string) => void
}

export default function FontModal({ customFonts, onClose, onAdd, onRemove }: Props) {
  const [kind, setKind] = useState<Kind>('url')
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [css, setCss] = useState('')
  const [files, setFiles] = useState<FileList | null>(null)
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const inputCls =
    'w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100'
  const segBtn = (active: boolean) =>
    `flex-1 rounded-md px-3 py-1.5 text-sm ${
      active
        ? 'bg-indigo-600 text-white'
        : 'bg-white text-zinc-600 hover:text-zinc-900 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
    }`

  const submit = async () => {
    setBusy(true)
    setStatus(null)
    try {
      if (kind === 'url') {
        const href = url.trim()
        if (!href) throw new Error('请输入字体 CSS 链接')
        const family = name.trim() || guessFamilyFromUrl(href)
        if (!family) throw new Error('无法自动识别字体名称，请手动填写「字体族名称」')
        await onAdd({ kind: 'link', name: family, href })
        setStatus({ ok: true, msg: `已加载「${family}」` })
      } else if (kind === 'css') {
        const text = css.trim()
        if (!text) throw new Error('请输入 @font-face CSS')
        const family = name.trim() || parseFamilyFromCss(text)
        if (!family) throw new Error('无法自动识别字体名称，请手动填写「字体族名称」')
        await onAdd({ kind: 'css', name: family, css: text })
        setStatus({ ok: true, msg: `已加载「${family}」` })
      } else {
        const family = name.trim()
        if (!family) throw new Error('请先填写「字体族名称」')
        if (!files?.length) throw new Error('请选择字体文件')
        for (const file of Array.from(files)) {
          const b64 = bufToBase64(await file.arrayBuffer())
          const mime = file.type || guessMime(file.name)
          await onAdd({
            kind: 'css',
            name: family,
            css: `@font-face{font-family:"${family}";src:url(data:${mime};base64,${b64});font-display:swap;}`,
          })
        }
        setStatus({ ok: true, msg: `已加载「${family}」（${files.length} 个文件）` })
      }
    } catch (err) {
      setStatus({ ok: false, msg: err instanceof Error ? err.message : '加载失败' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-5 shadow-2xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">添加网络字体</h3>

        <div className="mb-4 flex gap-1 rounded-lg border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-950">
          <button className={segBtn(kind === 'url')} onClick={() => setKind('url')}>
            CSS 链接
          </button>
          <button className={segBtn(kind === 'css')} onClick={() => setKind('css')}>
            @font-face 代码
          </button>
          <button className={segBtn(kind === 'file')} onClick={() => setKind('file')}>
            本地字体文件
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
            字体族名称
            <input
              className={inputCls}
              value={name}
              placeholder={kind === 'url' ? '留空可自动从链接识别（如 Noto Serif SC）' : '如 Noto Serif SC'}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          {kind === 'url' && (
            <>
              <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                字体 CSS 链接
                <input
                  className={inputCls}
                  value={url}
                  placeholder="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700&display=swap"
                  onChange={(e) => setUrl(e.target.value)}
                />
              </label>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                支持 Google Fonts 及任意托管字体的 CSS 链接。注意：Google Fonts 在部分地区需要代理才能访问。
              </p>
            </>
          )}

          {kind === 'css' && (
            <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
              @font-face CSS
              <textarea
                className={`${inputCls} font-mono text-xs`}
                rows={6}
                value={css}
                placeholder={'@font-face {\n  font-family: "MyFont";\n  src: url("https://example.com/my.woff2") format("woff2");\n}'}
                onChange={(e) => setCss(e.target.value)}
              />
            </label>
          )}

          {kind === 'file' && (
            <>
              <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                字体文件（.ttf / .otf / .woff / .woff2，可多选）
                <input
                  type="file"
                  className="text-sm text-zinc-600 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-600 file:px-3 file:py-1.5 file:text-sm file:text-white hover:file:bg-indigo-500 dark:text-zinc-300"
                  accept=".ttf,.otf,.woff,.woff2"
                  multiple
                  onChange={(e) => setFiles(e.target.files)}
                />
              </label>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                本地文件会转换为内嵌数据保存在浏览器中，刷新页面后仍可使用；文件过大可能超出浏览器存储限制。
              </p>
            </>
          )}

          {status && (
            <p className={`text-sm ${status.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
              {status.msg}
            </p>
          )}

          <div className="mt-1 flex justify-end gap-2">
            <button
              className="h-9 rounded-md border border-zinc-300 px-4 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
              onClick={onClose}
            >
              关闭
            </button>
            <button
              className="h-9 rounded-md bg-indigo-600 px-4 text-sm text-white hover:bg-indigo-500 disabled:opacity-50"
              disabled={busy}
              onClick={submit}
            >
              {busy ? '加载中…' : '加载字体'}
            </button>
          </div>
        </div>

        {customFonts.length > 0 && (
          <div className="mt-5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <h4 className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">已加载的自定义字体</h4>
            <ul className="flex flex-col gap-1.5">
              {customFonts.map((f) => (
                <li key={f.name} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <span className="flex-1 truncate">{f.name}</span>
                  <span className="text-xs text-zinc-400">{f.kind === 'link' ? '链接' : 'CSS / 文件'}</span>
                  <button
                    className="rounded px-2 py-0.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                    onClick={() => {
                      if (window.confirm(`移除字体「${f.name}」？`)) onRemove(f.name)
                    }}
                  >
                    移除
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
