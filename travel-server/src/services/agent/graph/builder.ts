// ============================================================
// buildRecommendationGraph — 构建 LangGraph 旅游推荐状态图
//
// 图拓扑：
//
//   START
//     ├──▶ researcher    ──┐
//     └──▶ weather_info  ──┤
//                           ├──▶ planner_llm ◀──┐
//                           │       │            │
//                           │       ├─ tools? ──▶ planner_tools ──┘
//                           │       │
//                           │       └─ no tools? ──▶ reviewer
//                           │                         │
//                           │           ┌─ passed? ───┤
//                           │           │              │
//                           │           │  not passed? ┘ (loop to planner_llm)
//                           │           │
//                           │           ▼
//                           └─────▶ budgeter
//                                     │
//                                     ▼
//                                 finalizer ──▶ END
//
// 关键特性：
// - 并行数据采集（researcher + weather_info）
// - 工具调用循环（planner_llm ↔ planner_tools）
// - 自我反思修正（reviewer → planner_llm 循环，最多 3 轮）
//
// 注意：LangGraph 中节点名不能与 state channel 名重复。
//       weather 节点改名为 weather_info 以避免与 state.weather 冲突。
// ============================================================

import { StateGraph, START, END } from '@langchain/langgraph'
import { GraphState } from './state.js'
import { researcherNode } from './nodes/researcher.js'
import { weatherNode } from './nodes/weather.js'
import { plannerLlmNode } from './nodes/planner-llm.js'
import { plannerToolsNode } from './nodes/planner-tools.js'
import { reviewerNode } from './nodes/reviewer.js'
import { budgeterNode } from './nodes/budgeter.js'
import { finalizerNode } from './nodes/finalizer.js'
import { shouldContinueToolLoop, shouldRevise } from './routing.js'

/**
 * 构建编译好的 LangGraph 旅游推荐图。
 *
 * 使用链式调用确保 TypeScript 正确推断所有节点名称到类型系统。
 * 每次调用返回一个新的编译图实例。
 */
export function buildRecommendationGraph() {
  const workflow = new StateGraph(GraphState)
    // ==========================================================
    // 添加所有节点（节点名不能与 state channel 名冲突）
    //   weather_info → 对应 state.weather channel
    // ==========================================================
    .addNode('researcher', researcherNode)
    .addNode('weather_info', weatherNode)
    .addNode('planner_llm', plannerLlmNode)
    .addNode('planner_tools', plannerToolsNode)
    .addNode('reviewer', reviewerNode)
    .addNode('budgeter', budgeterNode)
    .addNode('finalizer', finalizerNode)

    // ==========================================================
    // START → 并行启动 researcher 和 weather_info
    // ==========================================================
    .addEdge(START, 'researcher')
    .addEdge(START, 'weather_info')

    // ==========================================================
    // researcher + weather_info → planner_llm（两者完成后进入 planner）
    // ==========================================================
    .addEdge('researcher', 'planner_llm')
    .addEdge('weather_info', 'planner_llm')

    // ==========================================================
    // planner_llm → 条件路由：有 tool_calls → tools，否则 → reviewer
    // ==========================================================
    .addConditionalEdges('planner_llm', shouldContinueToolLoop, {
      planner_tools: 'planner_tools',
      reviewer: 'reviewer',
    })

    // ==========================================================
    // planner_tools → planner_llm（工具结果返回，继续对话）
    // ==========================================================
    .addEdge('planner_tools', 'planner_llm')

    // ==========================================================
    // reviewer → 条件路由：通过 → budgeter，不通过 → planner_llm 修正
    // ==========================================================
    .addConditionalEdges('reviewer', shouldRevise, {
      planner_llm: 'planner_llm',
      budgeter: 'budgeter',
    })

    // ==========================================================
    // budgeter → finalizer → END
    // ==========================================================
    .addEdge('budgeter', 'finalizer')
    .addEdge('finalizer', END)

  return workflow.compile()
}
