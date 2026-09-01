# 字体搭配实验室（FontLab）

> [!IMPORTANT]
> **本项目由 Qwen3.8 Max 开发**

> 在线预览：<https://tortotech.github.io/fontlab/>

对比不同字体搭配效果的网页工具：为每个组合分别配置中文标题字体、中文正文字体、英文混排字体、等宽字体与字重，实时预览标题 / 正文 / 引用 / 代码等示例文本。

## 功能

### 字体对比（首页）

- 多组合并排对比，支持添加 / 复制 / 删除组合
- 每个组合独立配置：中文标题字体、中文正文字体、英文字体（混排回退）、等宽字体、标题 / 正文字重
- 内置常见中文 / 英文 / 等宽字体列表，自动检测本机是否安装，也可手动输入任意字体名
- 内置 Google Fonts 精选清单（思源黑体/宋体、霞鹜文楷、站酷系列、Inter、Playfair Display 等 40 余款），选中即按需加载，已保存到组合中的会在打开页面时自动加载
- 添加网络字体：CSS 链接（如 Google Fonts）、@font-face 代码、本地字体文件（.ttf/.otf/.woff/.woff2）
- 全局调节：字号、行高、标题比例、字距；示例文本预设（通用混合 / 技术文档 / 文学散文 / 营销文案 / 自定义）
- 一键复制该组合的 CSS 代码；深色 / 浅色模式；所有配置保存在 localStorage

### 特性矩阵（`#/features`）

- 覆盖 Google Fonts **全量目录**（约 1900+ 家族，构建时优先拉取站点元数据 `fonts.google.com/metadata/fonts`，失败回退 Web Fonts Developer API；含热度排名、设计师、收录日期、风格分类，CI 中另经 sparse clone 合并开源仓库的字体介绍）+ 本地清单 + 自定义字体
- 表格对比各字体特性：风格、语言、中文、拉丁、数字、数字风格（齐线/旧式）、表格数字（tnum）、等宽、粗体、斜体、小型大写（smcp）、可用字重、可变轴，另可开启连字（liga）、分数（frac）、上/下标（sups/subs）、序数（ordn）列；列显示可在头部「列」下拉中自定义并持久化
- 检测方式：已加载字体按实际字形检测（等宽=字符宽度测量，粗体/斜体=读取真实字形或渲染对比推断）；未加载的 Google 字体按官方目录元数据推导，无需下载；本地字体在 Chrome/Edge 授权后经 Local Font Access API 精确检测（真实字重/斜体 + fontkit 解析字形表判断中文覆盖，支持 .ttc 集合字体），不支持或未授权时自动回退到宽度对比启发式
- 默认只显示已安装/已加载的字体；勾选后可浏览全部目录并一键「加载并检测」（自动按变体拼装 css2 请求，含斜体）
- 可将任意字体一键加入对比页

> 目录拉取使用的 API key 仅存放于 GitHub Actions Secrets，构建时使用，不进入客户端代码。

## 开发

```sh
npm install
npm run dev      # 本地开发
npm run build    # 类型检查 + 生产构建
npm run lint     # oxlint
```

技术栈：React 19 + TypeScript + Vite 8 + Tailwind CSS v4。
