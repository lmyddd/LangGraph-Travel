// ============================================================
// 预算计算工具 — 为 Budgeter Agent 提供精确的数学计算
// ============================================================

import type { BudgetBreakdown } from '../schemas.js'
import type { DailyItinerary } from '@shared/types'

/** 单个景点门票价格上限（元），超出视为 LLM 幻觉或格式错误 */
const MAX_TICKET_PER_SPOT = 500

/** 整个行程门票总费用上限（元），超出使用 LLM 生成的 budgetBreakdown 兜底 */
const MAX_TOTAL_TICKETS = 5000

/**
 * 从 ticket 字符串中提取价格数字。
 *
 * LLM 可能输出各种格式：
 *   - "60元"           → 60
 *   - "150元/人"       → 150
 *   - "旺季200元，淡季120元" → 200（取第一个数字）
 *   - "联票280元/人"     → 280
 *   - "免费"            → 0（跳过）
 *
 * 策略：提取字符串中第一个合理的数字（>0 且 <= MAX_TICKET_PER_SPOT），
 * 避免 LLM 多价格描述被错误拼接。
 */
function extractTicketPrice(ticketStr: string): number | null {
  if (!ticketStr) return null

  // 匹配所有数字（含小数）
  const matches = ticketStr.match(/\d+(?:\.\d+)?/g)
  if (!matches || matches.length === 0) return null

  // 遍历所有匹配到的数字，返回第一个在合理范围内的
  for (const m of matches) {
    const num = parseFloat(m)
    if (num > 0 && num <= MAX_TICKET_PER_SPOT) {
      return num
    }
  }

  // 所有数字都超出上限 → 记录警告并取第一个（可能是 LLM 幻觉）
  const firstNum = parseFloat(matches[0])
  if (firstNum > MAX_TICKET_PER_SPOT) {
    console.warn(
      `[calculator] 可疑门票价格: "${ticketStr}" → ${firstNum}元（超过单景点上限${MAX_TICKET_PER_SPOT}元），已忽略`
    )
    return null
  }

  return null
}

/**
 * 根据行程和总预算，计算各项费用的合理分配。
 *
 * 策略：
 * - 住宿：按城市级别的均价 × 天数
 * - 餐饮：每人每天 80-150 元
 * - 交通：市内交通 + 可能的城际交通
 * - 门票：从行程中提取的景点门票总和 × 人数
 * - 其他：剩余预算 / 应急储备
 */
export function calculateBudget(
  totalBudget: number,
  days: number,
  itinerary?: DailyItinerary[],
  travelers: number = 1
): BudgetBreakdown {
  // 1. 从行程中累加门票费用（每人每天）
  let ticketsPerPerson = 0
  let warnedSpots = 0
  if (itinerary) {
    for (const day of itinerary) {
      for (const slot of [day.morning, day.afternoon, day.evening]) {
        const ticketStr = slot?.ticket
        if (ticketStr) {
          const price = extractTicketPrice(ticketStr)
          if (price !== null) {
            ticketsPerPerson += price
          } else if (!/免费|无|免票|不需|无需|无门票/i.test(ticketStr)) {
            // 非免费但无法提取有效价格 → 记录警告
            console.warn(
              `[calculator] 无法从门票字段提取有效价格: "${ticketStr}"`
            )
          }
        }
      }
    }
  }

  // 门票总费用 = 每人门票 × 人数
  const ticketsTotal = ticketsPerPerson * travelers

  // 门票总费用合理性检查：异常高时使用预算比例兜底
  let tickets: number
  if (ticketsTotal > MAX_TOTAL_TICKETS && itinerary && itinerary.length > 0) {
    console.warn(
      `[calculator] 门票总费用 ¥${ticketsTotal} 异常偏高（${travelers}人 × ¥${ticketsPerPerson}/人），降级为预算比例估算`
    )
    tickets = Math.round(totalBudget * 0.15)
  } else if (ticketsTotal > 0) {
    tickets = Math.round(ticketsTotal)
  } else {
    // 无法从行程提取门票 → 按预算 10% 估算
    tickets = Math.round(totalBudget * 0.1)
  }

  // 2. 住宿费（按城市级别估算）
  const accommodationPerDay = Math.round((totalBudget * 0.25) / days)
  const accommodation = accommodationPerDay * days

  // 3. 餐饮费（每人每天约 120 元）
  const foodPerDay = 120 * travelers
  const food = foodPerDay * days

  // 4. 交通费
  const transportation = Math.round(totalBudget * 0.15)

  // 5. 其他 = 总预算 - 已分配
  const allocated = accommodation + food + transportation + tickets
  const other = Math.max(0, totalBudget - allocated)

  return {
    accommodation: Math.round(accommodation),
    food: Math.round(food),
    transportation: Math.round(transportation),
    tickets: Math.round(tickets),
    other: Math.round(other),
  }
}

/**
 * 检查预算是否合理，生成建议。
 */
export function analyzeBudget(
  breakdown: BudgetBreakdown,
  totalBudget: number
): { isOverBudget: boolean; suggestion?: string } {
  const sum =
    breakdown.accommodation +
    breakdown.food +
    breakdown.transportation +
    breakdown.tickets +
    breakdown.other

  if (sum > totalBudget) {
    const over = sum - totalBudget
    return {
      isOverBudget: true,
      suggestion: `预算超出 ¥${over}。建议：减少住宿标准（当前 ¥${breakdown.accommodation}）或选择免费景点替代收费景点（当前门票 ¥${breakdown.tickets}）。`,
    }
  }

  if (breakdown.other > totalBudget * 0.3) {
    return {
      isOverBudget: false,
      suggestion: `其他费用占比过高（¥${breakdown.other}，${Math.round((breakdown.other / totalBudget) * 100)}%），建议细化分配。`,
    }
  }

  return { isOverBudget: false }
}
