// ============================================================
// reviewerNode — LLM 质量评估与自我反思节点
//
// 这是 Agent "思考能力"的关键体现。
// Reviewer 从四个维度评估 Planner 生成的行程质量：
//   1. 完整性 (0-25)：每天是否有早/中/晚三个时间段
//   2. 真实性 (0-25)：门票价格是否合理，景点是否真实存在
//   3. 预算匹配 (0-25)：总费用是否在预算内
//   4. 天气适配 (0-25)：室内/室外活动安排是否匹配天气
//
// 评分 >= 70 → 通过，路由到 budgeter
// 评分 < 70 → 不通过，带具体反馈路由回 planner 修正（最多 3 轮）
// ============================================================

import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { parseTripPlan } from '../../schemas.js'
import { createLLM } from '../../utils/llm.js'
import type { State } from '../state.js'

// ---- 常量 ----
const PASS_THRESHOLD = 70
const MAX_ITERATIONS = 3

/**
 * 从 Planner 的原始输出中提取行程文本用于评审。
 * 如果 Zod 解析成功，格式化为可读文本；否则直接使用原始输出。
 */
function extractItineraryText(state: State): {
  itineraryText: string
  parseSuccess: boolean
} {
  const { rawPlannerOutput } = state

  if (!rawPlannerOutput) {
    return { itineraryText: '（Planner 未输出行程）', parseSuccess: false }
  }

  const { data, error } = parseTripPlan(rawPlannerOutput)

  if (data && data.dailyItinerary && data.dailyItinerary.length > 0) {
    // 格式化每日行程为可读文本
    const text = data.dailyItinerary
      .map((day) => {
        const summary = day.dailySummary ? `  概述: ${day.dailySummary}\n` : ''
        const slots = [
          `  上午: ${day.morning?.spot || day.morning?.name || '未安排'} (${day.morning?.ticket || '未知票价'}, ${day.morning?.duration || '未知时长'}) — ${day.morning?.description || ''}`,
          `  下午: ${day.afternoon?.spot || day.afternoon?.name || '未安排'} (${day.afternoon?.ticket || '未知票价'}, ${day.afternoon?.duration || '未知时长'}) — ${day.afternoon?.description || ''}`,
          `  晚上: ${day.evening?.spot || day.evening?.name || '未安排'} (${day.evening?.ticket || '未知票价'}, ${day.evening?.duration || '未知时长'}) — ${day.evening?.description || ''}`,
        ]
        return `第${day.day}天:\n${summary}${slots.join('\n')}`
      })
      .join('\n\n')

    return { itineraryText: text, parseSuccess: true }
  }

  // 解析失败，使用原始输出
  return {
    itineraryText: rawPlannerOutput.substring(0, 2000),
    parseSuccess: false,
  }
}

/**
 * 从 Planner 原始输出中尽力提取 dailyItinerary。
 *
 * 当 Zod 全量校验失败但 dailyItinerary 部分可能仍然可解析时使用。
 * 这是 fail-open 路径的兜底逻辑，避免「详细行程」整栏消失。
 */
function tryExtractDailyItinerary(
  raw: string
): import('../../schemas.js').DailyItinerary[] | undefined {
  // 策略 1：利用已有的 parseTripPlan（如果刚好能过 Zod）
  const { data } = parseTripPlan(raw)
  if (data?.dailyItinerary && data.dailyItinerary.length > 0) {
    return data.dailyItinerary
  }

  // 策略 2：从原始 JSON 中正则提取 dailyItinerary 数组
  try {
    const match = raw.match(/"dailyItinerary"\s*:\s*(\[[\s\S]*?\])/)
    if (match) {
      const arr = JSON.parse(match[1])
      if (Array.isArray(arr) && arr.length > 0) {
        return arr as import('../../schemas.js').DailyItinerary[]
      }
    }
  } catch {
    // 静默失败
  }

  return undefined
}

/** 解析 Reviewer LLM 输出的 JSON */
function parseReviewOutput(raw: string): {
  score: number
  passed: boolean
  feedback: string
  issues: string[]
  suggestions: string[]
} | null {
  const tryParse = (jsonStr: string) => {
    try {
      const obj = JSON.parse(jsonStr)
      return {
        score: typeof obj.score === 'number' ? obj.score : 50,
        passed: obj.passed === true,
        feedback:
          typeof obj.feedback === 'string' ? obj.feedback : '评审未能生成具体反馈',
        issues: Array.isArray(obj.issues) ? obj.issues : [],
        suggestions: Array.isArray(obj.suggestions) ? obj.suggestions : [],
      }
    } catch {
      return null
    }
  }

  // 策略 1：直接解析
  const direct = tryParse(raw)
  if (direct) return direct

  // 策略 2：提取 JSON 代码块
  const block = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (block) {
    const b = tryParse(block[1].trim())
    if (b) return b
  }

  // 策略 3：提取 { 到 }
  const first = raw.indexOf('{')
  const last = raw.lastIndexOf('}')
  if (first !== -1 && last > first) {
    const b = tryParse(raw.substring(first, last + 1))
    if (b) return b
  }

  return null
}

/**
 * Reviewer 节点主函数。
 *
 * 评估 Planner 输出质量，决定是否通过。
 *
 * 输出：
 * - reviewPassed = true  → 路由到 budgeter
 * - reviewPassed = false → 路由回 planner（带 feedback）
 * - iterationCount >= 3 → 强制通过（fail-open）
 */
export async function reviewerNode(state: State): Promise<Partial<State>> {
  const { city, budget, days, weather, attractions, rawPlannerOutput, iterationCount, onEvent } = state

  onEvent({
    type: 'agent_start',
    agent: 'planner',
    message: `🔍 正在评估行程质量${iterationCount > 0 ? `（第${iterationCount + 1}轮评审）` : ''}...`,
  })

  const nextIteration = iterationCount + 1

  // 声明在 try 外层，确保 catch 块也能访问
  let dailyItinerary: import('../../schemas.js').DailyItinerary[] | undefined
  let llmTips: string[] = []
  let llmWarnings: string[] = []

  try {
    // 1. 解析 Planner 输出
    const { data: tripPlanData, error: parseError } =
      parseTripPlan(rawPlannerOutput)

    if (!tripPlanData || !tripPlanData.dailyItinerary) {
      // 尝试兜底提取（Zod 全量校验失败时，dailyItinerary 部分可能仍可解析）
      dailyItinerary = tryExtractDailyItinerary(rawPlannerOutput)

      // 解析失败 —— 如果还有重试次数，反馈给 Planner；否则直接通过
      if (nextIteration >= MAX_ITERATIONS) {
        onEvent({
          type: 'agent_complete',
          agent: 'planner',
          summary: dailyItinerary
            ? `行程解析失败但已达最大重试次数(${MAX_ITERATIONS})，已尽力提取 ${dailyItinerary.length} 天行程`
            : `行程解析失败但已达最大重试次数(${MAX_ITERATIONS})，接受当前输出`,
        })
        return {
          dailyItinerary,
          iterationCount: nextIteration,
          reviewPassed: true,
          reviewScore: 0,
          reviewFeedback: parseError || '无法解析 Planner 输出',
        }
      }

      onEvent({
        type: 'agent_progress',
        agent: 'planner',
        detail: `⚠️ 行程解析失败：${parseError}，将反馈给 Planner 重新生成`,
      })

      return {
        iterationCount: nextIteration,
        reviewPassed: false,
        reviewScore: 0,
        reviewFeedback: `输出格式无法解析：${parseError || '未知错误'}。请确保输出是严格的 JSON 格式，包含完整的 dailyItinerary 数组。`,
      }
    }

    // 存储解析成功的 dailyItinerary
    dailyItinerary = tripPlanData.dailyItinerary

    // 同时提取 LLM 生成的 tips 和 warnings（之前被遗漏，导致永远只展示天气提示）
    llmTips = tripPlanData.tips || []
    llmWarnings = tripPlanData.warnings || []

    // 2. 构建评审 prompt
    const { itineraryText } = extractItineraryText(state)

    const weatherText = weather
      ? `${weather.temperature}, ${weather.condition}`
      : '无天气数据'

    const attractionsText =
      attractions && attractions.length > 0
        ? attractions.map((a) => `- ${a.name}`).join('\n')
        : '无搜索结果'

    const systemMsg = new SystemMessage(
      `你是一个严格的旅游行程评审专家。请从以下四个维度评审行程质量，给出 0-100 分。

## 评分维度
1. **完整性** (0-25)：每天是否都安排了上午/下午/晚上三个时段的活动？是否有空 slot？
2. **真实性** (0-25)：景点名称是否真实存在？门票价格是否合理（中国景点门票通常 0-200 元）？描述是否合理？
3. **预算匹配** (0-25)：各项费用之和是否在预算以内？分配是否合理？
4. **天气适配** (0-25)：是否根据天气情况合理安排了室内/室外活动？

## 通过标准
- 总分 >= ${PASS_THRESHOLD} 分且无明显严重问题 → passed: true
- 总分 < ${PASS_THRESHOLD} → passed: false，提供具体可行的修改建议

## 输出格式（严格 JSON）
{
  "score": 85,
  "passed": true,
  "feedback": "整体评价（2-3句）",
  "issues": ["问题1", "问题2"],
  "suggestions": ["建议1", "建议2"]
}

评审要严格但公正。不要给虚假高分。`
    )

    const humanMsg = new HumanMessage(
      `请评审以下行程：

## 用户需求
- 目的地：${city}
- 预算：${budget} 元
- 天数：${days} 天

## 天气信息
${weatherText}

## 已知真实景点
${attractionsText}

## Planner 生成的行程
${itineraryText}

请逐项打分并给出评审结果。`
    )

    // 3. 调用 Reviewer LLM
    const llm = createLLM({ label: 'Reviewer', temperature: 0.3 })
    const response = await llm.invoke([systemMsg, humanMsg])

    const rawReview = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content)

    console.log('[reviewerNode] 评审原始输出:', rawReview.substring(0, 400))

    // 4. 解析评审结果
    const reviewResult = parseReviewOutput(rawReview)

    if (!reviewResult) {
      // 评审输出解析失败 —— fail-open
      onEvent({
        type: 'agent_complete',
        agent: 'planner',
        summary: '评审结果解析失败，接受当前行程',
      })
      return {
        dailyItinerary,
        tips: llmTips,
        warnings: llmWarnings,
        iterationCount: nextIteration,
        reviewPassed: true,
        reviewScore: PASS_THRESHOLD,
        reviewFeedback: '评审系统无法解析评审结果，自动通过',
      }
    }

    const { score, passed, feedback, issues, suggestions } = reviewResult
    const finalPassed = passed || nextIteration >= MAX_ITERATIONS

    // 5. 发送评审结果事件
    const scoreLabel = score >= 80 ? '🟢' : score >= PASS_THRESHOLD ? '🟡' : '🔴'
    const verb = finalPassed ? '✅ 通过' : '🔄 需修正'

    onEvent({
      type: 'agent_progress',
      agent: 'planner',
      detail: `${scoreLabel} 评分: ${score}/100 — ${verb}`,
    })

    if (issues.length > 0) {
      onEvent({
        type: 'agent_progress',
        agent: 'planner',
        detail: `发现 ${issues.length} 个问题：${issues.slice(0, 3).join('；')}`,
      })
    }

    // 构建完整反馈
    const fullFeedback = [
      `评分：${score}/100`,
      feedback,
      issues.length > 0 ? `\n问题列表：\n${issues.map((i) => `- ${i}`).join('\n')}` : '',
      suggestions.length > 0
        ? `\n改进建议：\n${suggestions.map((s) => `- ${s}`).join('\n')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n')

    onEvent({
      type: 'agent_complete',
      agent: 'planner',
      summary: `${scoreLabel} 行程质量评审 ${verb}（${score}/100，第${nextIteration}轮）`,
    })

    // 仅在评审通过（或达最大重试次数）时才将 Planner 生成的 tips/warnings 写入 state，
    // 避免修订循环中重复追加相同/相似的 tips/warnings（state 使用 APPEND reducer）。
    // 修订时仅返回反馈信息，tips/warnings 留到最终通过的轮次再写入。
    const result: Partial<State> = {
      dailyItinerary,
      iterationCount: nextIteration,
      reviewPassed: finalPassed,
      reviewScore: score,
      reviewFeedback: finalPassed ? '' : fullFeedback,
    }

    if (finalPassed) {
      result.tips = llmTips
      result.warnings = llmWarnings
    }

    return result
  } catch (error) {
    const msg = (error as Error).message || '未知错误'
    console.error('[reviewerNode] 评审失败:', msg)
    onEvent({
      type: 'agent_error',
      agent: 'planner',
      error: msg,
    })
    // Fail-open：评审异常时接受当前行程，保留已提取的 dailyItinerary
    // 如果异常发生在解析之前（dailyItinerary 为 undefined），尝试兜底提取
    const salvaged = dailyItinerary ?? tryExtractDailyItinerary(rawPlannerOutput)
    return {
      dailyItinerary: salvaged,
      tips: llmTips,
      warnings: llmWarnings,
      iterationCount: nextIteration,
      reviewPassed: true,
      reviewScore: PASS_THRESHOLD,
      reviewFeedback: `评审系统异常：${msg}，自动通过`,
    }
  }
}
