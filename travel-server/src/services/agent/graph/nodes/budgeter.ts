// ============================================================
// budgeterNode — 根据行程精确计算和优化预算分配
//
// 包装现有的 calculateBudget + analyzeBudget 纯数学工具。
// 不需要 LLM，纯算法计算。
// ============================================================

import { calculateBudget, analyzeBudget } from '../../tools/calculator.js'
import type { BudgetBreakdown } from '../../schemas.js'
import type { State } from '../state.js'

/**
 * 根据 Planner 生成的每日行程，精确计算预算分配。
 *
 * 策略：
 * - 从行程中提取所有景点门票，累加求和
 * - 住宿按预算的 25%/天 估算
 * - 餐饮 120 元/天
 * - 交通占预算的 15%
 * - 其他 = 总预算 - 已分配（确保不超）
 *
 * 计算完成后更新 tips（如超预算警告）。
 */
export async function budgeterNode(state: State): Promise<Partial<State>> {
  const { budget, days, travelers, dailyItinerary, onEvent } = state

  onEvent({
    type: 'agent_start',
    agent: 'budgeter',
    message: '💰 正在计算预算分配...',
  })

  try {
    const breakdown: BudgetBreakdown = calculateBudget(
      budget,
      days,
      dailyItinerary,
      travelers || 1
    )
    const analysis = analyzeBudget(breakdown, budget)

    const sum =
      breakdown.accommodation +
      breakdown.food +
      breakdown.transportation +
      breakdown.tickets +
      breakdown.other

    const tips: string[] = []

    // 预算明细进度
    onEvent({
      type: 'agent_progress',
      agent: 'budgeter',
      detail: `住宿约${breakdown.accommodation}元，餐饮约${breakdown.food}元，交通约${breakdown.transportation}元，门票约${breakdown.tickets}元，其他约${breakdown.other}元`,
    })

    // 仅当预算偏紧时给出出行省钱建议；预算充裕时不画蛇添足（Planner 已提供城市特色 tips）
    if (analysis.isOverBudget) {
      tips.push(`预算较紧（预估 ¥${sum} / 计划 ¥${budget}），建议优先地铁/公交出行、提前在线比价预订酒店、关注景点淡季折扣`)
    }

    if (analysis.isOverBudget) {
      onEvent({
        type: 'agent_progress',
        agent: 'budgeter',
        detail: `⚠️ ${analysis.suggestion}`,
      })
    }

    onEvent({
      type: 'agent_complete',
      agent: 'budgeter',
      summary:
        analysis.isOverBudget
          ? `预算略超，已生成优化建议`
          : `预算分配完成，总计 ¥${sum}`,
    })

    return { budgetBreakdown: breakdown, tips }
  } catch (error) {
    const msg = (error as Error).message || '未知错误'
    console.error('[budgeterNode] 预算计算失败:', msg)
    onEvent({
      type: 'agent_error',
      agent: 'budgeter',
      error: msg,
    })
    // 降级：按比例简单分配
    return {
      budgetBreakdown: {
        accommodation: Math.round(budget * 0.4),
        food: Math.round(budget * 0.25),
        transportation: Math.round(budget * 0.15),
        tickets: Math.round(budget * 0.1),
        other: Math.round(budget * 0.1),
      },
    }
  }
}
