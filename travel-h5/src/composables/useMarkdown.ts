/**
 * Markdown → HTML 渲染器
 * 基于 marked + highlight.js + KaTeX + DOMPurify 的成熟方案
 *
 * 管道流程：
 *   原始 Markdown → 提取保护数学公式 → marked 解析 → 代码高亮 → 还原数学公式 → DOMPurify 消毒 → HTML
 */

import { marked } from 'marked'
import DOMPurify from 'dompurify'

// ---- highlight.js（按需引入语言，减少打包体积）----
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import json from 'highlight.js/lib/languages/json'
import bash from 'highlight.js/lib/languages/bash'
import xml from 'highlight.js/lib/languages/xml'       // 同时覆盖 HTML
import css from 'highlight.js/lib/languages/css'
import sql from 'highlight.js/lib/languages/sql'
import yaml from 'highlight.js/lib/languages/yaml'
import markdownLang from 'highlight.js/lib/languages/markdown'
import plaintext from 'highlight.js/lib/languages/plaintext'

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts', typescript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('py', python)
hljs.registerLanguage('json', json)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('sh', bash)
hljs.registerLanguage('shell', bash)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('css', css)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('yml', yaml)
hljs.registerLanguage('markdown', markdownLang)
hljs.registerLanguage('md', markdownLang)
hljs.registerLanguage('plaintext', plaintext)
hljs.registerLanguage('text', plaintext)

// ---- KaTeX（懒加载，仅在首次需要时加载）----
let katexModule: typeof import('katex') | null = null
async function getKatex(): Promise<typeof import('katex')> {
  if (!katexModule) {
    katexModule = await import('katex')
  }
  return katexModule
}

// ---- 数学公式提取 ----

interface MathBlock {
  type: 'inline' | 'block'
  content: string
}

/**
 * 匹配数学公式的正则：
 * - $$...$$  块级公式
 * - $...$    行内公式（要求 $ 后非空白、$ 前非空白、且 $ 后不紧跟数字）
 * 注意：不支持 $ 内部嵌套 $
 */
const MATH_PATTERNS = [
  // 块级公式 $$...$$
  { regex: /\$\$([\s\S]+?)\$\$/g, type: 'block' as const },
  // 行内公式 $...$（排除 $100 这类货币符号）
  { regex: /\$([^\s\d$][^$\n]*?[^\s$])\$/g, type: 'inline' as const },
]

function extractMathBlocks(text: string): { processed: string; blocks: MathBlock[] } {
  const blocks: MathBlock[] = []

  // 先把所有可能冲突的标记替换为占位符
  let processed = text

  // 1. 先处理块级公式（$$...$$），它们包含 $ 符号，必须先处理
  processed = processed.replace(MATH_PATTERNS[0].regex, (_match, content) => {
    const idx = blocks.length
    blocks.push({ type: 'block', content: content.trim() })
    return `\n__MATH_BLOCK_${idx}__\n`
  })

  // 2. 再处理行内公式（$...$）
  processed = processed.replace(MATH_PATTERNS[1].regex, (_match, content) => {
    const idx = blocks.length
    blocks.push({ type: 'inline', content: content.trim() })
    return `__MATH_INLINE_${idx}__`
  })

  return { processed, blocks }
}

// ---- marked 扩展：代码高亮 ----

marked.use({
  renderer: {
    code({ text, lang }: { text: string; lang?: string }): string {
      // 尝试用指定语言高亮
      if (lang && hljs.getLanguage(lang)) {
        try {
          const highlighted = hljs.highlight(text, { language: lang }).value
          return `<pre><code class="hljs language-${lang}">${highlighted}</code></pre>\n`
        } catch {
          // 高亮失败，降级为无高亮
        }
      }

      // 自动检测语言
      if (!lang || !hljs.getLanguage(lang)) {
        try {
          const result = hljs.highlightAuto(text, [
            'javascript', 'typescript', 'python', 'json', 'bash',
            'xml', 'css', 'sql', 'yaml', 'markdown',
          ])
          if (result.language && result.language !== 'plaintext') {
            return `<pre><code class="hljs language-${result.language}">${result.value}</code></pre>\n`
          }
        } catch {
          // 降级
        }
      }

      // 无语言或自动检测失败：纯文本代码块
      const escaped = escapeHtml(text)
      return `<pre><code class="hljs">${escaped}</code></pre>\n`
    },
  },
})

// ---- 辅助 ----

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// ---- DOMPurify 配置 ----

const ALLOWED_TAGS = [
  // 标题和段落
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p',
  // 文本格式
  'strong', 'em', 'b', 'i', 'u', 's', 'del', 'sup', 'sub',
  // 链接和图片
  'a', 'img',
  // 代码
  'code', 'pre',
  // 列表
  'ul', 'ol', 'li',
  // 表格
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
  // 引用和分割
  'blockquote', 'hr', 'br',
  // KaTeX 需要的标签
  'span', 'div', 'svg', 'path', 'line', 'annotation',
  // 通用
  'section', 'article',
]

const ALLOWED_ATTR = [
  // 链接
  'href', 'target', 'rel', 'title',
  // 图片
  'src', 'alt', 'width', 'height',
  // 样式（KaTeX 行内样式需要）
  'style',
  // 类名（hljs + KaTeX 需要）
  'class',
  // ARIA
  'aria-hidden', 'role',
  // 数据属性（数学公式 hydration 需要）
  'data-latex',
  // SVG 属性
  'viewBox', 'd', 'fill', 'stroke', 'stroke-width', 'transform',
  'fill-rule', 'clip-rule', 'stroke-linecap', 'stroke-linejoin',
]

function sanitize(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: true,
    ALLOW_ARIA_ATTR: true,
  })
}

// ---- 公开 API ----

/**
 * 同步渲染 Markdown（用于流式场景）
 *
 * 数学公式不会被 KaTeX 渲染，而是保留为带 data-latex 属性的占位符。
 * 调用方需要在合适时机调用 hydrateMath() 对 DOM 中的占位符进行 KaTeX 渲染。
 *
 * @param text - 原始 Markdown 文本
 * @returns HTML 字符串（数学公式为占位符，其他全部渲染完成）
 */
export function renderMarkdownSync(text: string): string {
  if (!text) return ''

  // 1. 提取并保护数学公式
  const { processed: textWithoutMath, blocks: mathBlocks } = extractMathBlocks(text)

  // 2. marked 解析（同步）
  let html: string
  try {
    html = marked.parse(textWithoutMath, { async: false }) as string
  } catch {
    // 解析失败时返回转义后的原文
    html = escapeHtml(text).replace(/\n/g, '<br>')
  }

  // 3. 还原数学公式（暂不渲染 KaTeX，留占位符给 hydration）
  if (mathBlocks.length > 0) {
    html = html.replace(/__MATH_(BLOCK|INLINE)_(\d+)__/g, (_match, type, idxStr) => {
      const block = mathBlocks[parseInt(idxStr)]
      if (!block) return ''
      const escaped = escapeAttr(block.content)
      if (type === 'BLOCK') {
        return (
          `<div class="math-block" data-latex="${escaped}" style="text-align:center;margin:12px 0;">` +
          `<code>$$${escapeHtml(block.content)}$$</code>` +
          `</div>`
        )
      }
      return (
        `<span class="math-inline" data-latex="${escaped}">` +
        `<code>$${escapeHtml(block.content)}$</code>` +
        `</span>`
      )
    })
  }

  // 4. XSS 消毒
  return sanitize(html)
}

/**
 * 异步渲染 Markdown（完整版，包含 KaTeX 数学公式渲染）
 *
 * 适合非流式场景，一次性获得完整渲染结果。
 * 流式场景请使用 renderMarkdownSync() + hydrateMathElement()。
 *
 * @param text - 原始 Markdown 文本
 * @returns HTML 字符串（完全渲染，包含 KaTeX）
 */
export async function renderMarkdown(text: string): Promise<string> {
  if (!text) return ''

  // 1. 提取并保护数学公式
  const { processed: textWithoutMath, blocks: mathBlocks } = extractMathBlocks(text)

  // 2. marked 解析
  let html: string
  try {
    html = marked.parse(textWithoutMath, { async: false }) as string
  } catch {
    html = escapeHtml(text).replace(/\n/g, '<br>')
  }

  // 3. 还原数学公式（用 KaTeX 渲染）
  if (mathBlocks.length > 0) {
    const katex = await getKatex()
    html = html.replace(/__MATH_(BLOCK|INLINE)_(\d+)__/g, (_match, type, idxStr) => {
      const block = mathBlocks[parseInt(idxStr)]
      if (!block) return ''
      try {
        return katex.renderToString(block.content, {
          throwOnError: false,
          displayMode: type === 'BLOCK',
          trust: false,
        })
      } catch {
        // KaTeX 渲染失败，显示原始 LaTeX
        if (type === 'BLOCK') {
          return `<pre><code>$$${escapeHtml(block.content)}$$</code></pre>`
        }
        return `<code>$${escapeHtml(block.content)}$</code>`
      }
    })
  }

  // 4. XSS 消毒
  return sanitize(html)
}

/**
 * 对 DOM 中带 data-latex 属性的占位符进行 KaTeX 渲染
 *
 * 配合 renderMarkdownSync() 使用，在 DOM 挂载后调用。
 * 渲染完成后会移除 data-latex 属性，避免重复渲染。
 *
 * @param container - 包含数学公式占位符的容器元素
 * @returns 实际渲染的公式数量
 */
export async function hydrateMathElements(container: HTMLElement): Promise<number> {
  const mathElements = container.querySelectorAll<HTMLElement>(
    '.math-block[data-latex], .math-inline[data-latex]'
  )
  if (mathElements.length === 0) return 0

  const katex = await getKatex()
  let count = 0

  mathElements.forEach((el) => {
    const latex = el.dataset.latex
    if (!latex) return
    try {
      const isBlock = el.classList.contains('math-block')
      const rendered = katex.renderToString(latex, {
        throwOnError: false,
        displayMode: isBlock,
        trust: false,
      })
      el.innerHTML = rendered
      el.removeAttribute('data-latex')
      el.classList.remove('math-block', 'math-inline')
      count++
    } catch {
      // 渲染失败保留原文
      el.removeAttribute('data-latex')
      el.classList.remove('math-block', 'math-inline')
    }
  })

  return count
}
