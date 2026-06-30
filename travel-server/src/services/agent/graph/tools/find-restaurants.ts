// ============================================================
// find_nearby_restaurants 工具
//
// Planner Agent 可主动调用此工具，查找景点附近的餐厅和美食。
// 让行程规划不仅仅是"去哪玩"，还包含"去哪吃"。
// ============================================================

import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { searchAttractions } from '../../tools/search.js'

export const findNearbyRestaurantsTool = tool(
  async ({ location, city, budget }) => {
    const budgetLabel = budget <= 50 ? '便宜' : budget <= 150 ? '中等' : '高档'
    const query = `${city} ${location}附近 美食 餐厅推荐 ${budgetLabel} 人均消费`
    const results = await searchAttractions(query)

    if (results.length === 0) {
      // 降级：不限定预算
      const fallbackResults = await searchAttractions(
        `${city} ${location}附近 美食 餐厅推荐`
      )
      if (fallbackResults.length === 0) {
        return `未找到「${location}」附近的餐厅推荐。建议到达后使用大众点评或美团搜索。`
      }
      return fallbackResults
        .slice(0, 3)
        .map(
          (r, i) =>
            `${i + 1}. **${r.title}** — ${r.content.substring(0, 250)}${r.content.length > 250 ? '...' : ''}`
        )
        .join('\n\n')
    }

    return results
      .slice(0, 3)
      .map(
        (r, i) =>
          `${i + 1}. **${r.title}** — ${r.content.substring(0, 250)}${r.content.length > 250 ? '...' : ''}`
      )
      .join('\n\n')
  },
  {
    name: 'find_nearby_restaurants',
    description:
      '查找某个景点或地点附近的餐厅和美食推荐。' +
      '当需要为行程安排餐饮（午餐、晚餐推荐）时使用此工具。' +
      '可以按人均预算筛选，确保推荐的餐厅符合用户的消费水平。',
    schema: z.object({
      location: z
        .string()
        .describe('地点名称，用于搜索该地点附近的餐厅，例如"故宫附近"、"西湖边"'),
      city: z.string().describe('所在城市名称'),
      budget: z
        .number()
        .describe('用户为单餐设定的人均预算上限（元），例如 50、100、200'),
    }),
  }
)
