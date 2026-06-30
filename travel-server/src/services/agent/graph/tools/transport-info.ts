// ============================================================
// get_transport_options 工具
//
// Planner Agent 可主动调用此工具，查询两个地点之间的交通方式。
// 帮助生成更实用的行程（而不是只说"地铁"或"公交"）。
// ============================================================

import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { searchAttractions } from '../../tools/search.js'

export const getTransportOptionsTool = tool(
  async ({ from, to, city }) => {
    const query = `${city} 从${from}到${to} 交通方式 怎么去 地铁 公交 打车`
    const results = await searchAttractions(query)

    if (results.length === 0) {
      return (
        `未找到从「${from}」到「${to}」的具体交通信息。` +
        `建议根据${city}当地的公共交通情况，选择地铁、公交或出租车出行。`
      )
    }

    return results
      .slice(0, 2)
      .map(
        (r, i) =>
          `${i + 1}. ${r.content.substring(0, 350)}${r.content.length > 350 ? '...' : ''}`
      )
      .join('\n\n')
  },
  {
    name: 'get_transport_options',
    description:
      '查询从一个地点到另一个地点的交通方式。' +
      '当需要在行程中安排两个景点之间的交通时使用此工具，获取地铁线路、公交路线、预计耗时等信息。' +
      '确保行程中的交通方式具体、可行。',
    schema: z.object({
      from: z.string().describe('出发地点名称，例如"天安门广场"'),
      to: z.string().describe('目的地点名称，例如"故宫博物院"'),
      city: z.string().describe('所在城市名称'),
    }),
  }
)
