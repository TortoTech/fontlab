# 字体搭配实验室（FontLab）

> [!IMPORTANT]
> **本项目由 Qwen3.8 Max 开发**

> 在线预览：<https://tortotech.github.io/fontlab/>

对比不同字体搭配效果的网页工具：为每个组合分别配置中文标题字体、中文正文字体、英文混排字体、等宽字体与字重，实时预览标题 / 正文 / 引用 / 代码等示例文本。

## 功能

- 多组合并排对比，支持添加 / 复制 / 删除组合
- 每个组合独立配置：中文标题字体、中文正文字体、英文字体（混排回退）、等宽字体、标题 / 正文字重
- 内置常见中文 / 英文 / 等宽字体列表，自动检测本机是否安装，也可手动输入任意字体名
- 内置 Google Fonts 精选清单（思源黑体/宋体、霞鹜文楷、站酷系列、Inter、Playfair Display 等 40 余款），选中即按需加载，已保存到组合中的会在打开页面时自动加载
- 添加网络字体：CSS 链接（如 Google Fonts）、@font-face 代码、本地字体文件（.ttf/.otf/.woff/.woff2）
- 全局调节：字号、行高、标题比例、字距；示例文本预设（通用混合 / 技术文档 / 文学散文 / 营销文案 / 自定义）
- 一键复制该组合的 CSS 代码；深色 / 浅色模式；所有配置保存在 localStorage

## 开发

```sh
npm install
npm run dev      # 本地开发
npm run build    # 类型检查 + 生产构建
npm run lint     # oxlint
```

技术栈：React 19 + TypeScript + Vite 8 + Tailwind CSS v4。
