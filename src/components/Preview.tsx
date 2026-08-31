import { bodyStack, headingStack, monoStack } from '../fontUtils'
import type { FontPair, Sample, Settings } from '../types'

interface Props {
  pair: FontPair
  settings: Settings
  sample: Sample
}

export default function Preview({ pair, settings, sample }: Props) {
  const head = headingStack(pair)
  const body = bodyStack(pair)
  const mono = monoStack(pair)
  const base = settings.baseSize
  const lh = settings.lineHeight
  const ls = `${settings.letterSpacing}em`
  const h1Size = base * settings.headingScale
  const h2Size = base * settings.headingScale * 0.62

  return (
    <div
      className="rounded-lg border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-950/60"
      style={{ fontSize: base, lineHeight: lh, letterSpacing: ls }}
    >
      <h1
        className="mb-1"
        style={{ fontFamily: head, fontWeight: pair.headingWeight, fontSize: h1Size, lineHeight: 1.3 }}
      >
        {sample.h1}
        {sample.h1En && (
          <span
            className="block opacity-80"
            style={{ fontSize: h1Size * 0.5, fontWeight: Math.max(pair.headingWeight - 200, 100) }}
          >
            {sample.h1En}
          </span>
        )}
      </h1>
      {sample.h2 && (
        <h2
          className="mb-3 mt-4 border-b border-zinc-200 pb-2 dark:border-zinc-800"
          style={{ fontFamily: head, fontWeight: pair.headingWeight, fontSize: h2Size, lineHeight: 1.35 }}
        >
          {sample.h2}
        </h2>
      )}
      {sample.paras.map((p, i) => (
        <p
          key={i}
          className={i > 0 ? 'mt-3' : 'mt-3'}
          style={{ fontFamily: body, fontWeight: pair.bodyWeight, lineHeight: lh }}
        >
          {p}
        </p>
      ))}
      {sample.quote && (
        <blockquote
          className="mt-4 border-l-[3px] border-indigo-400 pl-4 text-zinc-600 dark:border-indigo-500 dark:text-zinc-300"
          style={{ fontFamily: body }}
        >
          {sample.quote}
        </blockquote>
      )}
      {sample.code && (
        <pre
          className="mt-4 overflow-x-auto rounded-md bg-zinc-100 p-3 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
          style={{ fontFamily: mono, fontSize: base * 0.85, lineHeight: 1.6 }}
        >
          <code>{sample.code}</code>
        </pre>
      )}
      {sample.caption && (
        <p className="mt-4 text-zinc-400 dark:text-zinc-500" style={{ fontFamily: body, fontSize: base * 0.8 }}>
          {sample.caption}
        </p>
      )}
    </div>
  )
}
