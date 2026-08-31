interface Props {
  onAddPair: () => void
  onAddFont: () => void
  onReset: () => void
}

export default function TopBar({ onAddPair, onAddFont, onReset }: Props) {
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/85 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/85">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
          Aa
        </span>
        <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">字体搭配实验室</h1>
        <span className="hidden text-xs text-zinc-400 sm:inline dark:text-zinc-500">Font Pairing Lab</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            className="h-8 rounded-md bg-indigo-600 px-3 text-sm text-white hover:bg-indigo-500"
            onClick={onAddPair}
          >
            + 添加组合
          </button>
          <button
            className="h-8 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-700 hover:border-indigo-400 hover:text-indigo-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
            onClick={onAddFont}
          >
            添加网络字体
          </button>
          <button
            className="h-8 rounded-md px-3 text-sm text-zinc-400 hover:text-red-500 dark:text-zinc-500"
            onClick={onReset}
          >
            重置
          </button>
        </div>
      </div>
    </header>
  )
}
