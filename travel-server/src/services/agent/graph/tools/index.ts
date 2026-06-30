// ============================================================
// Planner 工具注册表
//
// 所有可被 Planner Agent 调用的工具集中于此。
// 工具使用 @langchain/core/tools 的 tool() 定义，
// 通过 ChatOpenAI.bindTools() 绑定到 LLM。
// ============================================================

import { searchAttractionDetailsTool } from './search-details.js'
import { getTransportOptionsTool } from './transport-info.js'
import { findNearbyRestaurantsTool } from './find-restaurants.js'

/** Planner Agent 可调用的全部工具 */
export const allPlannerTools = [
  searchAttractionDetailsTool,
  getTransportOptionsTool,
  findNearbyRestaurantsTool,
]

export {
  searchAttractionDetailsTool,
  getTransportOptionsTool,
  findNearbyRestaurantsTool,
}
