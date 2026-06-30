/**
 * 轻量级 Markdown → HTML 渲染器
 * 无依赖，纯正则实现，约 80 行
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * 将 Markdown 文本渲染为 HTML 字符串
 * 支持：**粗体** *斜体* `代码` [链接](url) ## 标题 - 列表 1. 有序列表 换行
 */
export function renderMarkdown(text: string): string {
  if (!text) return ''

  // 1. 提取并保护行内代码，避免被后续正则破坏
  const codeFragments: string[] = []
  let processed = text.replace(/`([^`]+)`/g, (_, code) => {
    codeFragments.push(escapeHtml(code))
    return `%%CODE_${codeFragments.length - 1}%%`
  })

  // 2. 先转义 HTML（除了我们生成的占位符）
  processed = escapeHtml(processed)

  // 3. 还原代码占位符
  processed = processed.replace(/%%CODE_(\d+)%%/g, (_, i) => {
    return `<code class="inline-code">${codeFragments[parseInt(i)]}</code>`
  })

  // 4. 处理标题（## 开头）
  processed = processed.replace(/^### (.+)$/gm, '<h4 class="md-h4">$1</h4>')
  processed = processed.replace(/^## (.+)$/gm, '<h3 class="md-h3">$1</h3>')

  // 5. 处理粗体 **text**
  processed = processed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

  // 6. 处理斜体 *text*（但不匹配列表项的 *）
  processed = processed.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '<em>$1</em>')

  // 7. 处理链接 [text](url)
  processed = processed.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="md-link">$1</a>'
  )

  // 8. 处理无序列表（- 或 * 开头）
  processed = processed.replace(/^(\s*)[-*] (.+)$/gm, (_, indent, content) => {
    const level = Math.floor(indent.length / 2)
    const paddingLeft = level * 20
    return `<li class="md-li" style="padding-left:${paddingLeft}px">${content}</li>`
  })

  // 9. 处理有序列表（1. 开头）
  processed = processed.replace(/^\d+\. (.+)$/gm, '<li class="md-li-ordered">$1</li>')

  // 10. 包裹连续的 <li> 为 <ul> 或 <ol>
  processed = processed.replace(/((?:<li class="md-li"[^>]*>.*?<\/li>\n?)+)/g, '<ul class="md-ul">$1</ul>')
  processed = processed.replace(/((?:<li class="md-li-ordered">.*?<\/li>\n?)+)/g, '<ol class="md-ol">$1</ol>')

  // 11. 换行 → <br>（在非块级元素后）
  processed = processed.replace(/\n/g, '<br>')

  return processed
}
