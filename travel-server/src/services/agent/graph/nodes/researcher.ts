// ============================================================
// researcherNode — 联网搜索目的地真实景点信息
//
// 包装现有的 Tavily 搜索工具。
// 结果存入 state.attractions，后续节点（Planner、Reviewer）使用。
// 搜索失败时返回空数组，不阻塞图执行。
// ============================================================

import { searchAttractions } from '../../tools/search.js'
import type { AttractionInfo } from '../../types.js'
import type { State } from '../state.js'

/**
 * 搜索目的地景点信息。
 *
 * 从 state 读取 city，调用 Tavily API 搜索真实数据，
 * 将结果写入 state.attractions。
 *
 * 通过 state.onEvent 实时推送进度事件给 SSE 客户端。
 */
export async function researcherNode(state: State): Promise<Partial<State>> {
  const { city, onEvent } = state

  onEvent({
    type: 'agent_start',
    agent: 'researcher',
    message: `🔍 正在搜索「${city}」真实景点信息...`,
  })

  try {
    const results = await searchAttractions(city)

    if (results.length === 0) {
      onEvent({
        type: 'agent_complete',
        agent: 'researcher',
        summary: `未找到「${city}」的搜索结果，Planner 将使用 LLM 自有知识`,
      })
      return { attractions: [] }
    }

    // 提取景点名称用于自然语言摘要
    const topNames = results
      .slice(0, 5)
      .map((r) => r.title.replace(/[【】\[\]]/g, '').trim())
      .filter(Boolean)

    const summaryText =
      topNames.length > 0
        ? `已找到「${topNames.join('、')}」等 ${results.length} 个热门景点，相关信息已提供给行程规划师`
        : `已找到 ${results.length} 条相关结果，信息已提供给行程规划师`

    onEvent({
      type: 'agent_progress',
      agent: 'researcher',
      detail: `搜索到 ${results.length} 条「${city}」相关信息`,
    })

    onEvent({
      type: 'agent_complete',
      agent: 'researcher',
      summary: summaryText,
    })

    // 映射为 AttractionInfo：后续 Planner prompt 和 Reviewer 验证都会用到
    const attractions: AttractionInfo[] = results.map((r) => ({
      name: r.title,
      description: r.content.substring(0, 200),
      source: r.url,
    }))

    return { attractions }
  } catch (error) {
    const msg = (error as Error).message || '未知错误'
    console.error('[researcherNode] 搜索失败:', msg)
    onEvent({
      type: 'agent_error',
      agent: 'researcher',
      error: msg,
    })
    // 非致命：返回空数组，Planner 仍可基于 LLM 自有知识生成
    return { attractions: [] }
  }
}
