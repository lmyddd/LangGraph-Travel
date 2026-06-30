// ============================================================
// Tavily 搜索工具 — 为 Researcher Agent 提供实时景点信息
// ============================================================

export interface SearchResult {
  title: string
  url: string
  content: string
  score?: number
}

// ---- 内容清洗 ----

/**
 * 清洗外部数据中会导致 JSON 序列化失败的危险字符序列。
 *
 * 问题背景：
 * Tavily 返回的网页文本可能包含 \x、\u、\U 等字面字符序列。
 * 当这些内容被 LangChain 放入 ToolMessage → 序列化为 JSON 发给 LLM API 时，
 * API 的 JSON 解析器会将 \x 误认为 hex escape，如果后面不跟 2 个合法 hex 字符，
 * 就会报 "unexpected end of hex escape"。
 *
 * 解决：将这些反斜杠字面量转义为双反斜杠，使 JSON 序列化后保持字面含义。
 */
function sanitizeJsonString(s: string): string {
  // 修复不完整的 \xHH（要求 \x 后跟恰好 2 个 hex，否则转义反斜杠）
  s = s.replace(/\\x(?![0-9a-fA-F]{2})/g, '\\\\x')
  // 修复不完整的 \uHHHH（要求 \u 后跟恰好 4 个 hex）
  s = s.replace(/\\u(?![0-9a-fA-F]{4})/g, '\\\\u')
  // 修复不完整的 \UHHHHHHHH（要求 \U 后跟恰好 8 个 hex）
  s = s.replace(/\\U(?![0-9a-fA-F]{8})/g, '\\\\U')
  return s
}

/** 单条内容最大长度（避免 ToolMessage 过大撑破 API 请求限制） */
const MAX_CONTENT_LENGTH = 2000

function cleanContent(text: string): string {
  return sanitizeJsonString(text).substring(0, MAX_CONTENT_LENGTH)
}

interface TavilyResponse {
  results?: SearchResult[]
  answer?: string
  query?: string
}

/**
 * 使用 Tavily Search API 搜索目的地景点信息。
 * Tavily 是专为 AI Agent 设计的搜索引擎，返回干净的结构化内容。
 */
export async function searchAttractions(
  city: string,
  apiKey?: string
): Promise<SearchResult[]> {
  const key = apiKey || process.env.TAVILY_API_KEY
  if (!key) {
    console.warn('[Tavily] 未配置 TAVILY_API_KEY，跳过搜索')
    return []
  }

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        query: `${city} 必去景点 门票价格 开放时间 旅游攻略`,
        search_depth: 'advanced',
        max_results: 8,
        include_answer: true,
      }),
    })

    if (!response.ok) {
      console.warn(`[Tavily] 搜索失败: HTTP ${response.status}`)
      return []
    }

    const data = (await response.json()) as TavilyResponse
    const cleaned = (data.results || []).map((r) => ({
      title: sanitizeJsonString(r.title),
      url: r.url,
      content: cleanContent(r.content),
      score: r.score,
    }))

    console.log(cleaned)

    return cleaned
  } catch (error) {
    console.warn('[Tavily] 搜索异常:', (error as Error).message)
    return []
  }
}

/**
 * 将 Tavily 搜索结果格式化为 LLM 可用的文本摘要。
 * 减少 token 消耗，只保留关键信息。
 */
export function formatSearchResults(results: SearchResult[]): string {
  if (results.length === 0) return '（暂无搜索结果）'
  // console.log(results);
  
  return results
    .map(
      (r, i) =>
        `${i + 1}. **${r.title}**\n   ${r.content.substring(0, 300)}${r.content.length > 300 ? '...' : ''}`
    )
    .join('\n\n')
}
