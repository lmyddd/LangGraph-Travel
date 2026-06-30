// ============================================================
// search_attraction_details 工具
//
// Planner Agent 可主动调用此工具，获取特定景点的详细信息：
// 门票价格、开放时间、游玩攻略等。
// 底层复用现有 Tavily 搜索。
// ============================================================

import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { searchAttractions } from '../../tools/search.js'

export const searchAttractionDetailsTool = tool(
  async ({ name, city }) => {
    const query = `${city} ${name} 旅游攻略 门票价格 开放时间 必玩推荐`
    const results = await searchAttractions(query)

    if (results.length === 0) {
      return `未找到「${name}」的详细信息。建议直接搜索"${name} 官网"获取最新信息。`
    }

    // 只取前 3 条，控制 token 消耗
    return results
      .slice(0, 3)
      .map(
        (r, i) =>
          `${i + 1}. **${r.title}**\n   ${r.content.substring(0, 400)}${r.content.length > 400 ? '...' : ''}\n   📎 来源: ${r.url}`
      )
      .join('\n\n')
  },
  {
    name: 'search_attraction_details',
    description:
      '搜索某个特定景点的详细信息，包括门票价格、开放时间、游玩攻略、注意事项。' +
      '当你需要获取某个景点的精确信息（如门票多少钱、几点开门）时，调用此工具。' +
      '不要凭空编造门票价格和开放时间——先用这个工具查。',
    schema: z.object({
      name: z.string().describe('景点名称，例如"故宫博物院"、"西湖"、"大雁塔"'),
      city: z.string().describe('所在城市名称，例如"北京"、"杭州"、"西安"'),
    }),
  }
)
