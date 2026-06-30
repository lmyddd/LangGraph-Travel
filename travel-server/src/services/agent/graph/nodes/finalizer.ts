// ============================================================
// finalizerNode — 组装最终 TripPlan 并发出完成事件
//
// 汇聚所有上游节点的输出，组装为统一的 TripPlan 结构，
// 通过 onEvent 回调发送 'complete' SSE 事件。
//
// tips/warnings 去重说明：
// state.tips 和 state.warnings 使用 APPEND reducer，多个节点
//（weather、reviewer、budgeter）都会贡献。在组装最终结果前，
// 会与 Planner 原始输出中的 tips/warnings 合并去重，确保
// 不重复展示。
// ============================================================

import { parseTripPlan, type TripPlan } from '../../schemas.js'
import type { State } from '../state.js'

/**
 * 最终组装节点。
 *
 * 从 state 提取各节点的输出：
 * - dailyItinerary（reviewer 解析和验证过的）
 * - budgetBreakdown（budgeter 计算的）
 * - tips（weather + planner + budgeter 贡献的，去重后）
 * - warnings（planner 生成的，去重后）
 *
 * 组装完毕后在 state 中返回最终结果（供调用者 extractTripPlan 使用）。
 */
export async function finalizerNode(state: State): Promise<Partial<State>> {
  const {
    city,
    budget,
    days,
    dailyItinerary,
    budgetBreakdown,
    tips,
    warnings,
    rawPlannerOutput,
    error,
    onEvent,
  } = state

  // 如果有全局错误，生成错误响应
  if (error) {
    const errorPlan: TripPlan = {
      success: false,
      city,
      days,
      totalBudget: budget,
      error,
    }

    onEvent({
      type: 'complete',
      data: errorPlan,
    })

    // 将错误信息也存入 tips，方便前端展示
    return {
      tips: [...tips, `❌ 系统错误：${error}`],
    }
  }

  // ---- 合并并去重 tips/warnings ----
  // 从 Planner 原始输出中提取 LLM 生成的 tips/warnings
  let llmTips: string[] = []
  let llmWarnings: string[] = []
  if (rawPlannerOutput) {
    const { data } = parseTripPlan(rawPlannerOutput)
    if (data) {
      llmTips = data.tips || []
      llmWarnings = data.warnings || []
    }
  }

  // 合并：LLM 城市专属 tips + state 中 weather/budget 贡献的 tips
  // 使用 Set 去重（state.tips 可能因修订循环包含旧 planner tips，
  // 但从 reviewer 修复后，修订时不再追加 planner tips，此去重作为安全兜底）
  const mergedTips = [...new Set([...llmTips, ...tips])]
  const mergedWarnings = [...new Set([...llmWarnings, ...warnings])]

  // 组装成功响应
  const finalPlan: TripPlan = {
    success: true,
    city,
    days,
    totalBudget: budget,
    dailyItinerary: dailyItinerary || [],
    budgetBreakdown,
    tips: mergedTips.length > 0 ? mergedTips : undefined,
    warnings: mergedWarnings.length > 0 ? mergedWarnings : undefined,
  }

  onEvent({
    type: 'complete',
    data: finalPlan,
  })

  // 注意：不将 mergedTips/mergedWarnings 写回 state，
  // 因为 state.tips/warnings 使用 APPEND reducer，写回会导致重复。
  // extractTripPlan 会自行从 rawPlannerOutput + state 合并去重。
  return {}
}
