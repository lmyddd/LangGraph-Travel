import { z } from 'zod'

// ============================================================
// Zod Schema —— 运行时验证 LLM 输出的 JSON 结构
// 同时提供 TypeScript 类型：z.infer<typeof TripPlanSchema>
// ============================================================

/** 景点信息 */
export const SpotInfoSchema = z.object({
  spot: z.string().optional().describe('景点名称'),
  name: z.string().optional().describe('景点名称（备选字段）'),
  duration: z.string().optional().describe('建议游览时长，如"3小时"'),
  ticket: z.string().optional().describe('门票价格，如"60元"'),
  transportation: z.string().optional().describe('交通方式建议'),
  description: z.string().optional().describe('景点详细介绍（3-5句，包含亮点、历史背景、特色体验）'),
  openingHours: z.string().optional().describe('开放时间，如"08:30-17:00（旺季）/ 09:00-16:00（淡季）"'),
  address: z.string().optional().describe('详细地址'),
  spotTips: z.string().optional().describe('景点贴士（2-3条：最佳拍照点、避开人流技巧、游览顺序建议等）'),
  nearbyFood: z.string().optional().describe('周边美食推荐（具体菜名或餐厅特色）'),
  rating: z.string().optional().describe('推荐指数，如"★★★★☆"'),
})

/** 每日行程 */
export const DailyItinerarySchema = z.object({
  day: z.number().describe('第几天，从1开始'),
  date: z.string().optional().describe('日期标签，如"第1天"'),
  dailySummary: z.string().optional().describe('每日概览（一段话概述当天行程亮点、主题和节奏安排）'),
  morning: SpotInfoSchema.describe('上午行程'),
  afternoon: SpotInfoSchema.describe('下午行程'),
  evening: SpotInfoSchema.describe('晚间活动'),
})

/** 预算分解 */
export const BudgetBreakdownSchema = z.object({
  accommodation: z.number().describe('住宿费用（元）'),
  food: z.number().describe('餐饮费用（元）'),
  transportation: z.number().describe('交通费用（元）'),
  tickets: z.number().describe('门票费用（元）'),
  other: z.number().describe('其他费用（元）'),
})

/** 完整行程规划 —— LLM 输出必须符合此结构 */
export const TripPlanSchema = z.object({
  success: z.boolean().describe('是否成功'),
  city: z.string().optional().describe('目的地城市'),
  days: z.number().optional().describe('旅行天数'),
  totalBudget: z.union([z.number(), z.string()]).optional().describe('总预算'),
  dailyItinerary: z.array(DailyItinerarySchema).optional().describe('每日行程安排'),
  budgetBreakdown: BudgetBreakdownSchema.optional().describe('预算明细'),
  tips: z.array(z.string()).optional().describe('旅行小贴士'),
  warnings: z.array(z.string()).optional().describe('注意事项'),
  error: z.string().optional().describe('错误信息（失败时）'),
})

// ---- 导出推断类型 ----
export type SpotInfo = z.infer<typeof SpotInfoSchema>
export type DailyItinerary = z.infer<typeof DailyItinerarySchema>
export type BudgetBreakdown = z.infer<typeof BudgetBreakdownSchema>
export type TripPlan = z.infer<typeof TripPlanSchema>

/**
 * 安全解析 LLM 输出的 JSON，带 Zod 验证。
 * 解析失败时返回 null 和错误信息。
 */
export function parseTripPlan(raw: string): { data: TripPlan | null; error?: string } {
  // 策略 1：直接解析
  try {
    const obj = JSON.parse(raw)
    const result = TripPlanSchema.safeParse(obj)
    if (result.success) return { data: result.data }
    return { data: null, error: `Zod validation failed: ${result.error.message}` }
  } catch {
    // 继续
  }

  // 策略 2：提取 ```json ... ``` 代码块
  const jsonBlock = raw.match(/```json\s*\n?([\s\S]*?)\n?```/)
  if (jsonBlock) {
    try {
      const obj = JSON.parse(jsonBlock[1].trim())
      const result = TripPlanSchema.safeParse(obj)
      if (result.success) return { data: result.data }
      return { data: null, error: `Zod validation failed: ${result.error.message}` }
    } catch {
      // 继续
    }
  }

  // 策略 3：提取第一个 { 到最后一个 }
  const firstBrace = raw.indexOf('{')
  const lastBrace = raw.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      const obj = JSON.parse(raw.substring(firstBrace, lastBrace + 1))
      const result = TripPlanSchema.safeParse(obj)
      if (result.success) return { data: result.data }
      return { data: null, error: `Zod validation failed: ${result.error.message}` }
    } catch {
      // 失败
    }
  }

  return { data: null, error: '无法从LLM输出中提取有效的JSON' }
}
