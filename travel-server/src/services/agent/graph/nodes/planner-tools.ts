// ============================================================
// plannerToolsNode — 执行 Planner 请求的工具调用
//
// 从 messages 中提取最后一条 AIMessage 的 tool_calls，
// 逐一执行对应的工具函数，将结果作为 ToolMessage 写回 messages。
// ============================================================

import { ToolMessage, AIMessage } from '@langchain/core/messages'
import { allPlannerTools } from '../tools/index.js'
import type { State } from '../state.js'

// ---- 工具函数 ----

/** 将工具调用参数转为自然语言描述，避免向前端暴露代码 */
function formatToolCallLabel(
  toolName: string,
  args: Record<string, unknown>
): string {
  const name = String(args.name ?? '')
  const location = String(args.location ?? '')
  const from = String(args.from ?? '')
  const to = String(args.to ?? '')
  const city = String(args.city ?? '')

  switch (toolName) {
    case 'search_attraction_details':
      return name
        ? `正在查询「${name}」的详细信息（门票、开放时间、游玩攻略）`
        : `正在搜索景点详细信息`
    case 'get_transport_options':
      return from && to
        ? `正在查询从「${from}」到「${to}」的交通方式`
        : `正在查询交通出行方案`
    case 'find_nearby_restaurants':
      return location
        ? `正在搜索「${location}」附近的美食餐厅`
        : `正在搜索附近美食推荐`
    default:
      return `正在查询相关信息`
  }
}

/**
 * 执行 Planner 请求的工具调用。
 *
 * 工作流程：
 * 1. 从 state.messages 取最后一条 AI 消息
 * 2. 提取 tool_calls 数组
 * 3. 在工具名→工具的映射表中查找并执行
 * 4. 将工具结果封装为 ToolMessage，追加到 messages
 */
export async function plannerToolsNode(
  state: State
): Promise<Partial<State>> {
  const { messages, onEvent } = state

  const lastMsg = messages[messages.length - 1]

  // 尝试从 AIMessage 获取 tool_calls
  const toolCalls: Array<{ name?: string; id?: string; args?: Record<string, unknown> }> =
    lastMsg && '_getType' in lastMsg && lastMsg._getType() === 'ai'
      ? ((lastMsg as AIMessage).tool_calls ?? [])
      : []

  if (toolCalls.length === 0) {
    console.warn('[planner_tools] tool_calls 为空，跳过工具执行')
    onEvent({
      type: 'agent_progress',
      agent: 'planner',
      detail: 'Planner 已完成信息收集，正在生成行程...',
    })
    return { messages: [] }
  }

  const toolMessages: ToolMessage[] = []

  // 构建工具名 → 工具对象的映射表
  const toolMap: Record<string, (args: Record<string, unknown>) => Promise<string>> = {}
  for (const t of allPlannerTools) {
    toolMap[t.name] = async (args: Record<string, unknown>) => {
      // 工具联合类型导致 .invoke 签名不兼容，通过 any 桥接
      const toolAny = t as { invoke: (input: unknown) => Promise<unknown> }
      const result = await toolAny.invoke(args)
      return typeof result === 'string' ? result : JSON.stringify(result)
    }
  }

  for (const tc of toolCalls) {
    const toolName = tc.name || tc.id || 'unknown'
    const args = tc.args ?? {}

    // 将工具调用参数转为自然语言描述
    const toolLabel = formatToolCallLabel(toolName, args as Record<string, unknown>)

    onEvent({
      type: 'agent_progress',
      agent: 'planner',
      detail: `🔧 ${toolLabel}`,
    })

    try {
      const executor = toolMap[toolName]
      if (!executor) {
        toolMessages.push(
          new ToolMessage({
            content: `错误：未找到工具 "${toolName}"`,
            tool_call_id: tc.id!,
          })
        )
        continue
      }

      const content = await executor(args)

      toolMessages.push(
        new ToolMessage({
          content,
          tool_call_id: tc.id!,
        })
      )
    } catch (error) {
      const errMsg = (error as Error).message || '工具执行失败'
      console.error(`[plannerToolsNode] ${toolName} 执行失败:`, errMsg)
      toolMessages.push(
        new ToolMessage({
          content: `工具执行出错：${errMsg}`,
          tool_call_id: tc.id!,
        })
      )
    }
  }

  return {
    messages: toolMessages,
  }
}
