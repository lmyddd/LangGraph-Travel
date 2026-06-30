// ============================================================
// graph/index.ts — LangGraph Agent 系统公开 API
//
// 对外暴露两个核心函数：
//   runGraphV2(input)      — 运行图，返回最终状态
//   extractTripPlan(state) — 从最终状态提取 TripPlan
//
// 以及流式处理辅助：
//   createGraphRunner(input) — 返回编译好的图 + 初始状态
// ============================================================

import { buildRecommendationGraph } from './builder.js'
import { parseTripPlan, type TripPlan } from '../schemas.js'
import type { GraphInput, State } from './state.js'

/**
 * 运行 LangGraph 旅游推荐图（非流式模式）。
 *
 * 图在内部执行所有节点，最终返回完整的 State。
 * SSE 事件通过 input.onEvent 回调在节点内部实时推送。
 *
 * @param input - 用户输入（city, budget, days）和可选 onEvent 回调
 * @returns 图的最终状态
 */
export async function runGraphV2(input: GraphInput): Promise<State> {
  const { city, budget, days, travelers, preferences, onEvent } = input

  const graph = buildRecommendationGraph()

  const initialState = {
    city,
    budget,
    days,
    travelers,
    preferences,
    onEvent: onEvent || (() => {}),
    messages: [],
    attractions: [],
    weatherTips: [],
    tips: [],
    warnings: [],
    iterationCount: 0,
    plannerPromptBuilt: false,
    reviewPassed: false,
    reviewScore: 0,
    reviewFeedback: '',
    rawPlannerOutput: '',
  }

  // 使用 invoke 获取最终状态（SSE 事件已通过 onEvent 回调实时推送）
  const finalState = await graph.invoke(initialState)

  // 在开发环境下打印每个节点的执行日志
  if (process.env.NODE_ENV === 'development') {
    console.log('[LangGraph] 图执行完成，最终状态 keys:', Object.keys(finalState))
  }

  return finalState as State
}

/**
 * 从图的最终状态中提取 TripPlan。
 *
 * 优先使用 finalizer 组装好的数据，如果不存在则从 rawPlannerOutput 解析。
 */
export function extractTripPlan(state: State): TripPlan {
  const { city, days, budget, dailyItinerary, budgetBreakdown, tips, warnings, error } = state

  if (error) {
    return {
      success: false,
      city,
      days,
      totalBudget: budget,
      error,
    }
  }

  // 如果 dailyItinerary 已由 reviewer 解析好，直接组装
  if (dailyItinerary && dailyItinerary.length > 0) {
    // 尝试从 rawPlannerOutput 中提取 LLM 生成的 tips/warnings
    // （reviewer 可能已在 state 中设置了它们，但作为兜底这里再次提取并合并）
    let llmTips: string[] = []
    let llmWarnings: string[] = []
    if (state.rawPlannerOutput) {
      const { data } = parseTripPlan(state.rawPlannerOutput)
      if (data) {
        llmTips = data.tips || []
        llmWarnings = data.warnings || []
      }
    }

    // 合并：LLM 城市专属 tips + weather/budget tips（去重）
    // state.tips 可能包含 weather/budget 贡献的 tips（reviewer 修订时不再追加 planner tips）
    const mergedTips = deduplicateStrings([...llmTips, ...tips])
    const mergedWarnings = deduplicateStrings([...llmWarnings, ...warnings])

    return {
      success: true,
      city,
      days,
      totalBudget: budget,
      dailyItinerary,
      budgetBreakdown,
      tips: mergedTips.length > 0 ? mergedTips : undefined,
      warnings: mergedWarnings.length > 0 ? mergedWarnings : undefined,
    }
  }

  // 降级：从 rawPlannerOutput 解析
  if (state.rawPlannerOutput) {
    const { data } = parseTripPlan(state.rawPlannerOutput)
    if (data) {
      // 合并：LLM 城市专属 tips + state 中的 weather/budget tips
      const llmTips = data.tips || []
      const llmWarnings = data.warnings || []
      const mergedTips = deduplicateStrings([...llmTips, ...tips])
      const mergedWarnings = deduplicateStrings([...llmWarnings, ...warnings])

      return {
        ...data,
        budgetBreakdown: budgetBreakdown || data.budgetBreakdown,
        tips: mergedTips.length > 0 ? mergedTips : undefined,
        warnings: mergedWarnings.length > 0 ? mergedWarnings : undefined,
      }
    }
  }

  // 完全失败
  return {
    success: false,
    city,
    days,
    totalBudget: budget,
    error: '无法生成有效行程',
  }
}

// ---- 内部工具 ----

/**
 * 字符串数组去重，同时过滤空字符串和纯标点条目。
 *
 * 比 [...new Set(arr)] 更严格：会 trim 后比较，
 * 并将完全相同（trim 后）的条目视为重复，保留首次出现的版本。
 */
function deduplicateStrings(items: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of items) {
    const key = item.trim()
    if (!key || key.length < 4) continue // 跳过空字符串和过短的条目（如 "注意安全"）
    if (seen.has(key)) continue
    seen.add(key)
    result.push(item.trim())
  }
  return result
}
