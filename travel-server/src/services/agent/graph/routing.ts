// ============================================================
// 条件边路由函数
//
// 这些函数在图的每个条件分叉点被调用，根据当前状态决定下一步。
// 每个函数返回一个字符串，对应目标节点的名称。
// ============================================================

import { AIMessage } from '@langchain/core/messages'
import type { State } from './state.js'

/**
 * Planner LLM → 下一步路由。
 *
 * 检查最后一条 AI 消息是否包含 tool_calls：
 * - 有 tool_calls → 去 planner_tools 执行工具
 * - 无 tool_calls → 去 reviewer 评审行程
 *
 * 安全阀：如果消息数量异常多（>30），直接去 reviewer 防止死循环
 */
export function shouldContinueToolLoop(state: State): 'planner_tools' | 'reviewer' {
  const { messages, error } = state

  // 已经出错，直接跳评审
  if (error) return 'reviewer'

  const lastMsg = messages[messages.length - 1]

  // 安全阀：消息过多，强制结束工具循环
  if (messages.length > 30) {
    console.warn(
      `[routing] 工具调用消息数已达 ${messages.length}，强制结束循环`
    )
    return 'reviewer'
  }

  // 检查最后一条消息是否有 tool_calls
  if (lastMsg && '_getType' in lastMsg) {
    const msgType = lastMsg._getType()
    if (msgType === 'ai') {
      // AIMessage 可能包含 tool_calls
      const toolCalls = (lastMsg as AIMessage).tool_calls
      if (toolCalls && toolCalls.length > 0) {
        return 'planner_tools'
      }
    }
    // ToolMessage → 回到 planner_llm 继续
    if (msgType === 'tool') {
      // 这里 planner_tools 的 edge 固定指向 planner_llm，
      // 不需要通过条件路由
    }
  }

  // 默认：去评审
  return 'reviewer'
}

/**
 * Reviewer → 下一步路由。
 *
 * 根据评审结果决定：
 * - reviewPassed === true  → 去 budgeter 继续
 * - reviewPassed === false → 回 planner_llm 修正
 */
export function shouldRevise(state: State): 'planner_llm' | 'budgeter' {
  const { reviewPassed, error } = state

  // 出错时直接去 budgeter（fail-open）
  if (error) return 'budgeter'

  if (reviewPassed) {
    return 'budgeter'
  }

  return 'planner_llm'
}
