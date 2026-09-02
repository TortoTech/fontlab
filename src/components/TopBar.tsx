import { NavLink, useLocation } from 'react-router-dom'

interface Props {
  onAddFont: () => void
  onReset: () => void
}

const navCls = ({ isActive }: { isActive: boolean }) =>
  `flex h-8 items-center rounded-md px-3 text-sm ${
    isActive
      ? 'bg-zinc-200 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
      : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
  }`

export default function TopBar({ onAddFont, onReset }: Props) {
  const { pathname } = useLocation()
  const fontTools = pathname !== '/translate'
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/85 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/85">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
          Aa
        </span>
        <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">TortoLab</h1>
        <nav className="ml-2 flex items-center gap-1">
          <NavLink to="/" end className={navCls}>
            字体对比
          </NavLink>
          <NavLink to="/features" className={navCls}>
            特性矩阵
          </NavLink>
          <NavLink to="/translate" className={navCls}>
            翻译测试
          </NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {fontTools && (
            <button
              className="h-8 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-700 hover:border-indigo-400 hover:text-indigo-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
              onClick={onAddFont}
            >
              添加网络字体
            </button>
          )}
          {fontTools && (
            <button
              className="h-8 rounded-md px-3 text-sm text-zinc-400 hover:text-red-500 dark:text-zinc-500"
              onClick={onReset}
            >
              重置
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
