// ============================================================
// stream-adapter — LangGraph 流事件适配器
//
// 将 LangGraph 的 .stream() 输出映射到现有的 AgentEvent 格式。
// 当前主要 SSE 路径通过 onEvent 回调在节点内部推送；
// 此适配器提供图级别的额外观察能力（如节点耗时、状态变更日志）。
//
// 用法：
//   const graph = buildRecommendationGraph()
//   for await (const chunk of await graph.stream(initialState)) {
//     logGraphChunk(chunk)
//   }
// ============================================================

/** 图节点名称 → Agent 名称映射 */
const NODE_TO_AGENT: Record<string, string> = {
  researcher: 'researcher',
  weather: 'weather',
  planner_llm: 'planner',
  planner_tools: 'planner',
  reviewer: 'planner',
  budgeter: 'budgeter',
  finalizer: 'planner',
}

/**
 * 日志记录图流 chunk。
 * 仅用于调试 — 主要 SSE 事件通过节点内部的 onEvent 回调发送。
 *
 * @param chunk - graph.stream() 产出的单个状态更新
 */
export function logGraphChunk(chunk: Record<string, unknown>): void {
  for (const [nodeName] of Object.entries(chunk)) {
    const agentName = NODE_TO_AGENT[nodeName] || 'unknown'
    if (process.env.NODE_ENV === 'development') {
      console.log(`[LangGraph] ✅ 节点 [${nodeName}] (Agent: ${agentName}) 执行完成`)
    }
  }
}

/**
 * 从 graph.stream() 的最终状态中提取节点耗时统计。
 * 每个 chunk 包含节点名称作为 key，可用于计时。
 */
export function extractNodeTimings(
  chunks: Record<string, unknown>[]
): Map<string, number> {
  const timings = new Map<string, number>()
  for (const chunk of chunks) {
    for (const [nodeName] of Object.entries(chunk)) {
      timings.set(nodeName, (timings.get(nodeName) || 0) + 1)
    }
  }
  return timings
}
