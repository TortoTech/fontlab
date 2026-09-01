import type { CustomFont, FontPair, FontSource, Sample, SampleKey, Settings } from './types'

export const FONT_GROUPS: { label: string; fonts: string[] }[] = [
  {
    label: '中文字体',
    fonts: [
      'Microsoft YaHei',
      'Microsoft YaHei UI',
      'SimSun',
      'NSimSun',
      'SimHei',
      'KaiTi',
      'FangSong',
      'DengXian',
      'Noto Sans SC',
      'Noto Serif SC',
      'Source Han Sans SC',
      'Source Han Serif SC',
      'LXGW WenKai',
      'LXGW WenKai GB',
      'LXGW WenKai Screen',
      'LXGW WenKai Mono',
      'PingFang SC',
      'Hiragino Sans GB',
      'STSong',
      'STKaiti',
      'STFangsong',
      'OPPOSans',
      'HarmonyOS Sans SC',
      'MiSans',
      'ZCOOL XiaoWei',
      'ZCOOL QingKe HuangYou',
      'ZCOOL KuaiLe',
      'Ma Shan Zheng',
      'Zhi Mang Xing',
      'Long Cang',
      'Liu Jian Mao Cao',
      'Zpix',
    ],
  },
  {
    label: '英文字体',
    fonts: [
      'Arial',
      'Helvetica',
      'Helvetica Neue',
      'Times New Roman',
      'Georgia',
      'Garamond',
      'Palatino Linotype',
      'Baskerville Old Face',
      'Didot',
      'Futura',
      'Century Gothic',
      'Verdana',
      'Tahoma',
      'Trebuchet MS',
      'Segoe UI',
      'Optima',
      'Candara',
      'Gill Sans MT',
      'Rockwell',
      'Cambria',
      'Constantia',
      'Calibri',
    ],
  },
  {
    label: '等宽字体',
    fonts: [
      'Consolas',
      'Courier New',
      'Cascadia Code',
      'Cascadia Mono',
      'JetBrains Mono',
      'Fira Code',
      'Source Code Pro',
      'SF Mono',
      'Menlo',
      'Monaco',
      'Sarasa Mono SC',
      'Sarasa Gothic SC',
    ],
  },
]

export interface GoogleFont {
  family: string
  query: string
}

export const GOOGLE_FONT_GROUPS: { label: string; fonts: GoogleFont[] }[] = [
  {
    label: '中文字体 · Google Fonts',
    fonts: [
      { family: 'Noto Sans SC', query: 'Noto+Sans+SC:wght@100;300;400;500;700;900' },
      { family: 'Noto Serif SC', query: 'Noto+Serif+SC:wght@200;300;400;500;600;700;900' },
      { family: 'ZCOOL XiaoWei', query: 'ZCOOL+XiaoWei' },
      { family: 'ZCOOL QingKe HuangYou', query: 'ZCOOL+QingKe+HuangYou' },
      { family: 'ZCOOL KuaiLe', query: 'ZCOOL+KuaiLe' },
      { family: 'Ma Shan Zheng', query: 'Ma+Shan+Zheng' },
      { family: 'Zhi Mang Xing', query: 'Zhi+Mang+Xing' },
      { family: 'Long Cang', query: 'Long+Cang' },
      { family: 'Liu Jian Mao Cao', query: 'Liu+Jian+Mao+Cao' },
      { family: 'LXGW WenKai TC', query: 'LXGW+WenKai+TC:wght@300;400;700' },
      { family: 'LXGW WenKai Mono TC', query: 'LXGW+WenKai+Mono+TC:wght@300;400;700' },
    ],
  },
  {
    label: '英文字体 · Google Fonts',
    fonts: [
      { family: 'Inter', query: 'Inter:wght@100;200;300;400;500;600;700;800;900' },
      { family: 'Roboto', query: 'Roboto:wght@100;300;400;500;700;900' },
      { family: 'Open Sans', query: 'Open+Sans:wght@300;400;500;600;700;800' },
      { family: 'Lato', query: 'Lato:wght@100;300;400;700;900' },
      { family: 'Montserrat', query: 'Montserrat:wght@100;200;300;400;500;600;700;800;900' },
      { family: 'Poppins', query: 'Poppins:wght@100;200;300;400;500;600;700;800;900' },
      { family: 'Raleway', query: 'Raleway:wght@100;200;300;400;500;600;700;800;900' },
      { family: 'Work Sans', query: 'Work+Sans:wght@100;200;300;400;500;600;700;800;900' },
      { family: 'Manrope', query: 'Manrope:wght@200;300;400;500;600;700;800' },
      { family: 'Playfair Display', query: 'Playfair+Display:wght@400;500;600;700;800;900' },
      { family: 'Lora', query: 'Lora:wght@400;500;600;700' },
      { family: 'Merriweather', query: 'Merriweather:wght@300;400;700;900' },
      { family: 'Source Serif 4', query: 'Source+Serif+4:wght@200;300;400;500;600;700;800;900' },
      { family: 'EB Garamond', query: 'EB+Garamond:wght@400;500;600;700;800' },
      { family: 'Libre Baskerville', query: 'Libre+Baskerville:wght@400;700' },
      { family: 'Cormorant Garamond', query: 'Cormorant+Garamond:wght@300;400;500;600;700' },
      { family: 'Fraunces', query: 'Fraunces:wght@100;200;300;400;500;600;700;800;900' },
      { family: 'DM Serif Display', query: 'DM+Serif+Display' },
      { family: 'Crimson Pro', query: 'Crimson+Pro:wght@200;300;400;500;600;700;800;900' },
      { family: 'Space Grotesk', query: 'Space+Grotesk:wght@300;400;500;600;700' },
      { family: 'Bebas Neue', query: 'Bebas+Neue' },
    ],
  },
  {
    label: '等宽字体 · Google Fonts',
    fonts: [
      { family: 'JetBrains Mono', query: 'JetBrains+Mono:wght@100;200;300;400;500;600;700;800' },
      { family: 'Fira Code', query: 'Fira+Code:wght@300;400;500;600;700' },
      { family: 'Source Code Pro', query: 'Source+Code+Pro:wght@200;300;400;500;600;700;800;900' },
      { family: 'Roboto Mono', query: 'Roboto+Mono:wght@100;200;300;400;500;600;700' },
      { family: 'IBM Plex Mono', query: 'IBM+Plex+Mono:wght@100;200;300;400;500;600;700' },
      { family: 'Space Mono', query: 'Space+Mono:wght@400;700' },
    ],
  },
]

export const GOOGLE_FONT_MAP: Map<string, string> = new Map(
  GOOGLE_FONT_GROUPS.flatMap((g) => g.fonts.map((f) => [f.family, f.query] as [string, string])),
)

export interface FontEntry {
  family: string
  source: FontSource
}

export function allFontEntries(customFonts: CustomFont[]): FontEntry[] {
  const map = new Map<string, FontEntry>()
  FONT_GROUPS.forEach((g) =>
    g.fonts.forEach((f) => {
      if (!map.has(f)) map.set(f, { family: f, source: 'local' })
    }),
  )
  GOOGLE_FONT_GROUPS.forEach((g) => g.fonts.forEach((f) => map.set(f.family, { family: f.family, source: 'google' })))
  customFonts.forEach((c) => map.set(c.name, { family: c.name, source: 'custom' }))
  return [...map.values()]
}

export const WEIGHTS: { value: number; label: string }[] = [
  { value: 100, label: 'Thin 100' },
  { value: 200, label: 'ExtraLight 200' },
  { value: 300, label: 'Light 300' },
  { value: 400, label: 'Regular 400' },
  { value: 500, label: 'Medium 500' },
  { value: 600, label: 'SemiBold 600' },
  { value: 700, label: 'Bold 700' },
  { value: 800, label: 'ExtraBold 800' },
  { value: 900, label: 'Black 900' },
]

export const SAMPLE_LABELS: { key: SampleKey; label: string }[] = [
  { key: 'mixed', label: '通用混合' },
  { key: 'tech', label: '技术文档' },
  { key: 'literature', label: '文学散文' },
  { key: 'poster', label: '营销文案' },
  { key: 'custom', label: '自定义文本' },
]

const SAMPLES: Record<Exclude<SampleKey, 'custom'>, Sample> = {
  mixed: {
    h1: '字体搭配实验室',
    h1En: 'Font Pairing Lab',
    h2: '中文与英文的混排韵律',
    paras: [
      '好的排版（Typography）让阅读成为享受。当方块字与 Latin letters 在同一段落中交织时，字重、行高与留白的微妙平衡，决定了页面的气质与呼吸感。数字 0123456789、标点「」，以及 ABC 的大小写形态，同样是细节所在。',
      'The quick brown fox jumps over the lazy dog. Typography is the craft of endowing human language with a durable visual form — 1234567890.',
    ],
    quote: '字如其人，文如其声；排版之于内容，犹如音色之于旋律。',
    code: 'const theme = {\n  heading: "Noto Serif SC",\n  body: "Noto Sans SC",\n  size: 16,\n};',
    caption: '图 1-1 · 示例文本 Caption · Aug 2026',
  },
  tech: {
    h1: '快速开始',
    h1En: 'Getting Started',
    h2: '1. 安装与配置 Installation',
    paras: [
      '通过包管理器安装依赖：运行 npm install @acme/ui 后，在入口文件引入样式表。注意 peerDependencies 中要求 React 18 及以上版本。',
      'Import the component styles in your entry file, then wrap your application with the <Provider> to enable theming and dark mode support.',
    ],
    quote: '约定优于配置（Convention over Configuration）—— 让常见场景开箱即用。',
    code: 'npm install @acme/ui\n\nimport { Button, Provider } from "@acme/ui";\n\nexport default () => (\n  <Provider theme="light">\n    <Button variant="primary">Hello</Button>\n  </Provider>\n);',
    caption: 'Listing 1-1 · 组件基础用法 · v2.4.0',
  },
  literature: {
    h1: '春昼短',
    h1En: 'A Short Spring Day',
    h2: '三月的信',
    paras: [
      '三月的风从檐下经过，把昨夜的雨声折叠起来。桌上摊开的书页被光穿过，字句便有了温度；读到会心处，窗外的玉兰恰好落下第一瓣。',
      'Spring passes like a sentence left unfinished. What remains is the light on the wall, the smell of paper, and the quiet certainty that some words are worth keeping.',
    ],
    quote: '人间有味是清欢。',
    caption: '—— 摘自《春日札记》，第 7 页',
  },
  poster: {
    h1: 'NEW SEASON 新风尚',
    h1En: 'Autumn / Winter Collection 2026',
    h2: '为日常注入一点仪式感',
    paras: [
      '轻量、耐用、触手可及。全系列采用可回收材质，现已登陆线下门店与官方小程序。会员尊享首发折扣，限时两周。',
      'Designed for everyday rituals. Crafted with recycled materials, available now in stores and online worldwide.',
    ],
    quote: '少，即是多。Less, but better.',
    caption: '* 活动详情以门店公示为准 · 最终解释权归品牌所有',
  },
}

export function getSample(settings: Settings): Sample {
  if (settings.sample === 'custom') {
    return {
      h1: settings.customTitle.trim() || '自定义标题',
      paras: settings.customBody
        .split(/\n+/)
        .map((t) => t.trim())
        .filter(Boolean),
    }
  }
  return SAMPLES[settings.sample] ?? SAMPLES.mixed
}

export const DEFAULT_SETTINGS: Settings = {
  baseSize: 16,
  lineHeight: 1.8,
  headingScale: 2,
  letterSpacing: 0,
  sample: 'mixed',
  customTitle: '自定义标题',
  customBody: '在这里输入自定义的测试文本。\n可以用空行分隔多个段落。',
  theme: 'light',
  view: 'grid',
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function defaultPairs(): FontPair[] {
  return [
    {
      id: uid(),
      name: '宋体标题 · 黑体正文',
      headingZh: 'Noto Serif SC',
      bodyZh: 'Noto Sans SC',
      latin: 'Georgia',
      mono: 'Consolas',
      headingWeight: 700,
      bodyWeight: 400,
    },
    {
      id: uid(),
      name: '黑体标题 · 宋体正文',
      headingZh: 'Noto Sans SC',
      bodyZh: 'Noto Serif SC',
      latin: 'Lora',
      mono: 'JetBrains Mono',
      headingWeight: 700,
      bodyWeight: 400,
    },
    {
      id: uid(),
      name: '楷体人文风',
      headingZh: 'Microsoft YaHei',
      bodyZh: 'KaiTi',
      latin: 'EB Garamond',
      mono: 'Courier New',
      headingWeight: 600,
      bodyWeight: 400,
    },
  ]
}
