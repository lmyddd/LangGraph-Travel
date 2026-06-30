// ============================================================
// GraphState — LangGraph 状态定义
//
// 使用 Annotation.Root() 定义所有图节点间流转的状态字段。
// 每个字段可指定 reducer（合并策略）和 default（初始值）。
//
// 图执行流程中，节点通过返回部分 state 来更新对应字段，
// LangGraph 自动按 reducer 合并到全局状态。
// ============================================================

import { Annotation } from '@langchain/langgraph'
import type { BaseMessage } from '@langchain/core/messages'
import type { EventCallback, AttractionInfo, WeatherData } from '../types.js'
import type { DailyItinerary, BudgetBreakdown } from '../schemas.js'

export const GraphState = Annotation.Root({
  // ==========================================================
  // 用户输入（只读，图运行期间不变）
  // ==========================================================
  city: Annotation<string>,
  budget: Annotation<number>,
  days: Annotation<number>,
  travelers: Annotation<number>,
  preferences: Annotation<string>,


  // reducer（合并策略）和 default（初始值）
  // reducer: (prev, next) => next → 替换（覆盖旧值）
  // reducer: (prev, next) => [...prev, ...next] → 追加（用于 messages、tips）
  // ==========================================================
  // Researcher 输出
  // ==========================================================
  attractions: Annotation<AttractionInfo[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),

  // ==========================================================
  // Weather 输出
  // ==========================================================
  weather: Annotation<WeatherData | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  weatherTips: Annotation<string[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),

  // ==========================================================
  // Planner 对话状态（tool-calling 循环）
  //
  // messages 使用追加 reducer，工具调用结果累加进对话历史。
  // plannerPromptBuilt 标记初始 prompt 是否已构建（避免重复）。
  // ==========================================================
  messages: Annotation<BaseMessage[]>({
    reducer: (current, update) => [...(current ?? []), ...update],
    default: () => [],
  }),
  plannerPromptBuilt: Annotation<boolean>({
    reducer: (_prev, next) => next,
    default: () => false,
  }),
  dailyItinerary: Annotation<DailyItinerary[] | undefined>({
    reducer: (_prev, next) => next,
    default: () => undefined,
  }),
  rawPlannerOutput: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => '',
  }),

  // ==========================================================
  // Reviewer 反思状态
  // ==========================================================
  reviewScore: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),
  reviewFeedback: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => '',
  }),
  reviewPassed: Annotation<boolean>({
    reducer: (_prev, next) => next,
    default: () => false,
  }),

  // ==========================================================
  // Budgeter 输出
  // ==========================================================
  budgetBreakdown: Annotation<BudgetBreakdown | undefined>({
    reducer: (_prev, next) => next,
    default: () => undefined,
  }),

  // ==========================================================
  // 最终输出容器（追加合并：各节点贡献的 tips/warnings 都会保留）
  // ==========================================================
  tips: Annotation<string[]>({
    reducer: (current, update) => [...(current ?? []), ...(update ?? [])],
    default: () => [],
  }),
  warnings: Annotation<string[]>({
    reducer: (current, update) => [...(current ?? []), ...(update ?? [])],
    default: () => [],
  }),

  // ==========================================================
  // 流控制
  // ==========================================================
  /** Plan→Review→Revise 循环计数，最多 3 轮 */
  iterationCount: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),
  /** 全局错误信息，非空时 finalizer 会生成错误响应 */
  error: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),

  // ==========================================================
  // SSE 事件回调（替换语义：图运行时设置一次，不随节点更新变化）
  // ==========================================================
  onEvent: Annotation<EventCallback>({
    reducer: (_prev, next) => next,
    default: () => (() => {}),
  }),
})

/** 图的完整状态类型 */
export type State = typeof GraphState.State

/** 图调用时的输入类型（只需用户输入 + 可选回调） */
export interface GraphInput {
  city: string
  budget: number
  days: number
  travelers: number
  preferences: string
  onEvent?: EventCallback
}
