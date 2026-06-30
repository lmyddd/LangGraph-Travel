import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages'
import 'dotenv/config'
import { runGraphV2, extractTripPlan } from './agent/graph/index.js'
import { createLLMSafe } from './agent/utils/llm.js'
import type { EventCallback } from './agent/types.js'
import type { TripPlan } from './agent/schemas.js'

/**
 * 将 LangChain 响应内容统一转成字符串，兼容 string / content block 数组。
 */
function toTextContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof (item as { text?: string }).text === 'string')
          return (item as { text: string }).text
        return ''
      })
      .join('')
  }
  return ''
}

class TravelService {
  private llm: ChatOpenAI | null = null
  private initError: string = ''

  constructor() {
    this.initLLM()
  }

  private mapModelError(error: unknown): string {
    const message = (error as { message?: string })?.message || '模型调用失败'
    if (/MODEL_NOT_FOUND/i.test(message)) {
      return '模型不可用：请检查 MODEL_PROVIDER、对应 *_MODEL 是否可用，以及 *_BASE_URL 是否填写正确。'
    }
    return message
  }

  private initLLM(): void {
    const { llm, error } = createLLMSafe({
      label: 'TravelService',
      temperature: 0.7,
      streaming: true,
    })
    this.llm = llm
    this.initError = error || ''
  }

  // ============================================================
  // LangGraph 多 Agent 推荐（工具调用 + 自我反思）
  // ============================================================

  /**
   * 使用 LangGraph 状态图生成旅游规划。
   *
   * 特性：
   * - Planner Agent 可主动调用工具（搜索详情、交通、美食）
   * - Reviewer 节点评估质量，不合格则反馈给 Planner 修正（最多 3 轮）
   * - 动态路由：Planner ↔ Tools 循环、Planner → Review → 修正循环
   * - 每个节点通过 onEvent 实时推送 SSE 事件
   *
   * @param city    - 目的地城市
   * @param budget  - 预算（元）
   * @param days    - 天数
   * @param onEvent - SSE 事件回调，实时推送每个 Agent 的状态
   * @returns TripPlan（Zod 验证过的结构化输出）
   */
  async recommendV2(
    city: string,
    budget: number,
    days: number,
    travelers: number = 1,
    preferences: string = '',
    onEvent?: EventCallback
  ): Promise<TripPlan> {
    // 参数校验
    if (budget < 100 || days < 1 || days > 30) {
      throw new Error('预算不能低于100元，天数必须在1-30天之间')
    }

    const emit = onEvent || (() => {})

    // 运行 LangGraph 状态图（内部节点通过 emit 推送 SSE 事件）
    const finalState = await runGraphV2({
      city,
      budget,
      days,
      travelers,
      preferences,
      onEvent: emit,
    })

    // 从最终状态提取 TripPlan
    return extractTripPlan(finalState)
  }

  // ============================================================
  // 简单对话（保留，不经过 Agent 编排）
  // ============================================================

  /**
   * 流式对话（支持多轮对话上下文）。
   *
   * @param message        - 用户当前输入
   * @param streamCallback - 流式 token 回调
   * @param history        - 历史对话 [{ role: 'user'|'ai', content: '...' }]
   *                         按时间升序（最早在前），最近的在最后
   */
  async chat(
    message: string,
    streamCallback?: (chunk: string) => void,
    history: Array<{ role: string; content: string }> = []
  ): Promise<{ success: boolean; reply?: string; error?: string }> {
    if (!this.llm) {
      return {
        success: false,
        error: this.initError || '模型未初始化，请检查服务端配置。',
      }
    }

    // 构建消息列表：system → history → 当前消息
    const messages: Array<SystemMessage | HumanMessage | AIMessage> = [
      new SystemMessage('你是一个友好的旅游规划师，请用中文回复用户。回答要简洁有用。'),
    ]

    // 拼接历史对话（只保留最近 20 轮 = 40 条）
    const recentHistory = history.slice(-40)
    for (const h of recentHistory) {
      if (h.role === 'user') {
        messages.push(new HumanMessage(h.content))
      } else if (h.role === 'ai') {
        messages.push(new AIMessage(h.content))
      }
    }

    // 当前用户消息
    messages.push(new HumanMessage(message))

    try {
      const stream = await this.llm.stream(messages)
      let fullResponse = ''

      for await (const chunk of stream) {
        const content = toTextContent(chunk.content)
        if (content.trim() === '') continue
        fullResponse += content
        if (streamCallback) {
          streamCallback(content)
        }
      }

      return { success: true, reply: fullResponse }
    } catch (error) {
      return { success: false, error: this.mapModelError(error) }
    }
  }
}

export default new TravelService()
