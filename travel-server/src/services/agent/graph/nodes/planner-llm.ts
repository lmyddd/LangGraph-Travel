// ============================================================
// plannerLlmNode — LLM + Tool Calling 核心节点
//
// 这是整个图的核心智能节点。
// Planner 不仅基于已有数据生成行程，还能**主动调用工具**获取更多信息：
//   - 发现门票价格不明确 → 调用 search_attraction_details
//   - 两个景点间需要安排交通 → 调用 get_transport_options
//   - 需要安排用餐 → 调用 find_nearby_restaurants
//
// 工具调用循环：
//   planner_llm → (有 tool_calls?) → planner_tools → planner_llm → ...
//   planner_llm → (无 tool_calls?) → reviewer
//
// 支持反思修正：当 reviewer 反馈不合格时，本节点将反馈附加到对话中重新生成。
// ============================================================

import {
  HumanMessage,
  SystemMessage,
  AIMessage,
  type BaseMessage,
} from '@langchain/core/messages'
import { allPlannerTools } from '../tools/index.js'
import { createLLM } from '../../utils/llm.js'
import type { State } from '../state.js'

// ---- Prompt 构建 ----

/** 构建初始 System + Human prompt */
function buildInitialMessages(state: State): [SystemMessage, HumanMessage] {
  const { city, budget, days, travelers, preferences, attractions, weather, weatherTips } = state

  // 搜索结果文本
  const searchBlock =
    attractions && attractions.length > 0
      ? attractions
          .map(
            (a) =>
              `- **${a.name}**: ${a.description || ''}（来源: ${a.source || '未知'}）`
          )
          .join('\n')
      : '（暂无搜索结果，请使用 search_attraction_details 工具查询）'

  // 天气文本
  const weatherBlock = weather
    ? `温度: ${weather.temperature}\n天气: ${weather.condition}\n湿度: ${weather.humidity}`
    : '（暂无天气数据）'

  const weatherTipsBlock =
    weatherTips && weatherTips.length > 0
      ? weatherTips.map((t) => `- ${t}`).join('\n')
      : ''

  const systemMsg = new SystemMessage(
    `你是一个资深的旅游规划专家 AI。你的任务是为用户生成一份**信息丰富、细节翔实**的旅行行程，让用户感觉像有专业导游在带路。

## 核心理念：像导游一样规划
你的行程不应该是干巴巴的"去A景点→去B景点"。你应该像经验丰富的导游一样：
- 介绍每个景点的**历史背景和文化故事**（1-2句点睛即可）
- 告诉用户**怎么玩最值**（最佳游览路线、拍照机位、避开人流的技巧）
- 推荐**具体的美食**（不是"附近有小吃"，而是"出门左转50米的XX店的招牌菜YY"）
- 提供**实用的运营信息**（开放时间、预约要求、最佳到达时间）

## 核心原则
1. **真实性第一**：不要编造门票价格、开放时间——用工具查询。
2. **内容深度**：每个景点的 description 至少写 3-5 句，包含亮点、历史、体验特色。不要只写"这是XX城市著名景点"这种废话。
3. **交通可行**：景点间的交通方式要具体（如"地铁2号线 30分钟"），用工具查询。
4. **餐饮推荐**：为每天安排午餐和晚餐地点，用工具搜索附近美食。推荐要具体。
5. **天气适配**：根据天气合理安排室内/室外活动。
6. **预算控制**：各项费用之和不超过用户预算。

## 工具使用指南
你有以下工具可以使用：
- **search_attraction_details**：查询特定景点的门票、开放时间、攻略。**在填写任何景点的 ticket 字段前，先用这个工具查。**
- **get_transport_options**：查询两个地点间的交通方式。**在填写 transportation 字段前先用这个工具查。**
- **find_nearby_restaurants**：搜索景点附近美食。**为每天就近安排午餐和晚餐。**

## 重要规则
- 每天必须有上午、下午、晚上三个时间段的安排，每个时间段都要有景点/活动
- 不要留空 slot
- 合理安排：上午室外 → 中午吃饭 → 下午室内（热天）/ 室外（凉快天）→ 晚上美食/夜景
- 考虑景点间的距离，不要安排"上午在城东、下午在城西"这种不合理组合
- dailySummary 是对当天行程的**叙事性概览**（2-3句），描述当天的主题、节奏和亮点，让用户一目了然
- tips 面向用户出行实施（穿衣/预约/最佳时段），warnings 面向安全与体验风险（闭馆/高反/拥挤），不要把计划内部纠错写进去

## 门票价格格式（非常重要）
- ticket 字段填写**单人**门票价格，格式为纯数字+元，如 "60元"、"150元"
- **禁止**在 ticket 中写多人汇总价（如 "4人×150=600元"）、价格区间（如 "100-200元"）、或带说明文字的多价格（如 "旺季200元淡季120元"）
- 如果景点免费，ticket 填写 "免费"
- 用 search_attraction_details 工具核实门票价格后再填写，**严禁编造**

## 各字段撰写标准
- **description**：3-5句，覆盖景点亮点、历史背景、独特体验。不要泛泛而谈。
- **openingHours**：写上具体开放时间，区分旺季/淡季如有差异
- **spotTips**：2-3条实用贴士，如最佳游览时段、拍照机位、排队避开策略、游览顺序建议
- **nearbyFood**：推荐2-3个具体美食或餐厅，带上特色菜名
- **rating**：用星级表达推荐程度（★★★★★必去 / ★★★★☆推荐 / ★★★☆☆可选）
- **dailySummary**：当天行程的叙事概述，如"第1天以城市地标为主线，上午感受故宫的皇家气派，下午漫步胡同体验市井生活，晚上在簋街品味地道麻辣。"`
  )

  const humanMsg = new HumanMessage(
    `请为以下需求规划一份信息丰富的详细旅行行程：

## 用户需求
- 目的地：${city}
- 总预算：${budget} 元
- 旅行天数：${days} 天
- 旅行人数：${travelers || 1} 人
${preferences ? `- 旅行偏好：${preferences}` : ''}

## 搜索结果
${searchBlock}

## 天气信息
${weatherBlock}
${weatherTipsBlock ? `\n## 天气提示\n${weatherTipsBlock}` : ''}

---

## 输出要求
当你收集到足够的信息后，请以如下 JSON 格式输出最终行程（不要在 JSON 外加任何文字）：

{
  "success": true,
  "city": "${city}",
  "days": ${days},
  "totalBudget": ${budget},
  "dailyItinerary": [
    {
      "day": 1,
      "date": "第1天",
      "dailySummary": "第1天以城市地标为主线，上午感受故宫的皇家气派，深度了解明清历史；下午漫步胡同体验市井生活，在老字号茶馆歇脚品茗；晚上去簋街品味地道麻辣小龙虾，感受京城夜生活。全天节奏张弛有度，从宏大叙事到烟火日常。",
      "morning": {
        "spot": "景点名",
        "duration": "X小时",
        "ticket": "XX元（单人价格，如60元、免费）",
        "transportation": "具体的交通方式（如地铁2号线 30分钟）",
        "description": "详细介绍3-5句：包括景点亮点、历史背景、独特体验。要让用户感受到'这里值得去'。",
        "openingHours": "08:30-17:00（旺季）/ 09:00-16:00（淡季）",
        "address": "具体到街道门牌号",
        "spotTips": "①最佳游览时段是早上8:30一开门就进，避开10点后的旅行团高峰；②进门后先去XX殿看XX，这是精华所在；③建议租用讲解器（20元）或提前下载XX App的免费语音导览",
        "nearbyFood": "推荐：①XX路XX号的「XX老店」，招牌XX（人均40元）；②景点出口左手边「XX小吃」，XX面是本地人最爱",
        "rating": "★★★★★"
      },
      "afternoon": { ... },
      "evening": { ... }
    }
  ],
  "budgetBreakdown": {
    "accommodation": 住宿费,
    "food": 餐饮费,
    "transportation": 交通费,
    "tickets": 门票费,
    "other": 其他
  },
  "tips": ["至少3条：${city}具体的预约要求/最佳游览时段/穿衣建议，禁止通用废话"],
  "warnings": ["至少2条：${city}景点闭馆日/安全风险/拥挤提醒，禁止通用废话"]
}

## tips 编写规则（至少3条，每条必须针对本次出行的具体城市/景点/季节）
- tips 是给用户**出行执行时**的实用贴士，不是计划纠错
- 每条必须具体到城市/景点，禁止通用废话如"提前预订酒店""注意安全"
- 好的示例：「故宫需提前1-7天在官网预约，现场不售票」「西湖音乐喷泉仅每周五六晚19:00开放」「${city}夏季午后常有雷阵雨，建议上午游览户外景点」
- 差的示例：「建议提前预订」「注意天气变化」（太通用，任何城市都适用 = 无价值）
- 禁止把"门票价格不对""第X天安排不合理"这类计划纠错放到 tips 里

## warnings 编写规则（至少2条，每条必须针对本次行程的具体风险）
- warnings 是**行程执行中的风险提醒**，面向安全和体验
- 每条必须具体到城市/景点/季节，禁止通用废话
- 好的示例：「八达岭长城秋季风大注意保暖」「${city}部分山区路段无信号提前下载离线地图」「旺季故宫排队超2小时建议8点前到达」
- 差的示例：「注意人身安全」「保管好财物」（太通用）
- 禁止把预算超支、行程冲突等计划问题写进 warnings

**开始规划吧！先用工具查询关键景点信息，再生成信息丰富的完整行程。记住：要像导游一样，让用户感受到每个景点的价值和趣味。**`
  )

  return [systemMsg, humanMsg]
}

/** 构建修正 prompt（reviewer 反馈后） */
function buildRevisionMessage(feedback: string): HumanMessage {
  return new HumanMessage(
    `你上一轮生成的行程经过评审，存在以下问题，请根据反馈重新生成：

## 反馈意见
${feedback}

## 要求
1. 认真对待每一条反馈，做出相应修改
2. 如有需要，使用工具查询修改后所需的景点信息
3. 输出格式与之前一致（完整 JSON）`
  )
}

// ---- 节点主函数 ----

/**
 * Planner LLM 节点。
 *
 * 消息管理（v2 改进）：
 * - state.messages 始终包含完整对话历史，以 [system, human] 开头。
 * - 首次调用时将 [system, human] + AI 响应一起写入 state.messages。
 * - 后续调用直接使用 state.messages，不再重复构建 system/human。
 * - reviewFeedback 消费后立即清除，防止后续调用错误进入 revision 路径。
 */
export async function plannerLlmNode(state: State): Promise<Partial<State>> {
  const {
    city,
    budget,
    days,
    messages,
    plannerPromptBuilt,
    reviewFeedback,
    iterationCount,
    onEvent,
  } = state

  const isRevision = plannerPromptBuilt && !!reviewFeedback
  onEvent({
    type: 'agent_start',
    agent: 'planner',
    message: isRevision
      ? `🔄 正在根据评审反馈修改「${city}」行程（第${iterationCount + 1}次修正）...`
      : `📋 正在为「${city}」规划${days}天行程...`,
  })

  try {
    const llm = createLLM({ label: 'Planner', temperature: 0.7, streaming: true })
    const llmWithTools = llm.bindTools(allPlannerTools)

    // ---- 统一构建消息列表 ----
    // state.messages 始终是完整对话（首次为 []，之后以 [system, human] 开头）。
    // 不再区分 3 条路径 —— 只区分「首次构建」和「后续使用」。
    let currentMessages: BaseMessage[]

    if (!plannerPromptBuilt) {
      // 首次：构建 [system, human] 作为对话起点
      const [system, human] = buildInitialMessages(state)
      currentMessages = [system, human]
    } else {
      // 后续：state.messages 已是完整对话历史，直接使用
      currentMessages = [...messages]

      // reviewFeedback 有值 → 追加修正消息，然后清除（仅消费一次）
      if (reviewFeedback) {
        currentMessages.push(buildRevisionMessage(reviewFeedback))
      }
    }

    // ---- 安全截断（保护 tool_calls / tool_result 配对不被切断） ----
    if (currentMessages.length > 40) {
      currentMessages = safeTruncateMessages(currentMessages)
    }

    // ---- 防御性清洗：确保所有 tool_calls 都有匹配的 tool 消息 ----
    // DeepSeek API 严格校验：任何一个 assistant(tool_calls) 缺少 tool 回应 → 400 错误。
    // 正常情况下消息结构已经是正确的，此步骤作为最后防线防止 LangGraph 内部边界情况
    // 导致的孤儿 tool_calls（如 planner_tools 异常返回空对象）。
    currentMessages = sanitizeToolMessages(currentMessages)

    // ---- 调用 LLM（invoke 模式，保留 tool_calls） ----
    const response = await llmWithTools.invoke(currentMessages)
    const textContent = extractTextContent(response.content)

    // ---- 构建返回值 ----
    // 关键：如果消费了 reviewFeedback，必须把 revisionMsg 一起存入 state.messages，
    // 形成 user → assistant 交替，避免连续 assistant 消息触发 API 校验报错。
    const toolCalls = (response as AIMessage).tool_calls
    const msgsToStore: BaseMessage[] = []

    if (reviewFeedback) {
      // revisionMsg（HumanMessage）必须在 AI 响应之前存入，保证 user → assistant 交替
      msgsToStore.push(buildRevisionMessage(reviewFeedback))
    }

    if (plannerPromptBuilt) {
      msgsToStore.push(response as AIMessage)
    } else {
      // 首次：system + human + AI 响应一并写入 state.messages
      msgsToStore.push(...currentMessages, response as AIMessage)
    }

    const result: Partial<State> = {
      messages: msgsToStore,
      plannerPromptBuilt: true,
    }

    // 消费 reviewFeedback（防止后续调用再次进入 revision 路径）
    if (reviewFeedback) {
      result.reviewFeedback = ''
    }

    if (toolCalls && toolCalls.length > 0) {
      // ---- 有 tool_calls：路由到 planner_tools ----
      const toolNames = toolCalls
        .map((tc) => formatToolPurpose(tc.name || ''))
        .filter(Boolean)
        .join('、')

      onEvent({
        type: 'agent_progress',
        agent: 'planner',
        detail: `正在${toolNames || '查询更多信息'}，确保行程真实可靠...`,
      })

      return result
    }

    // ---- 无 tool_calls：LLM 输出了最终行程 JSON ----
    result.rawPlannerOutput = textContent

    const dayCount = extractDayCount(textContent) || days

    onEvent({
      type: 'agent_progress',
      agent: 'planner',
      detail: `行程方案已生成，共规划了 ${dayCount} 天的详细安排，正在交由评审系统审核...`,
    })

    return result
  } catch (error) {
    const msg =
      (error as { message?: string })?.message || 'Planner LLM 调用失败'
    console.error('[plannerLlmNode] 错误:', msg)
    onEvent({
      type: 'agent_error',
      agent: 'planner',
      error: msg,
    })
    return { error: msg }
  }
}

// ---- 工具函数 ----

/** 从 LangChain 内容中提取文本（兼容 string 和 content block 数组） */
function extractTextContent(content: unknown): string {
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

/** 将工具名翻译为自然语言动词短语 */
function formatToolPurpose(toolName: string): string {
  switch (toolName) {
    case 'search_attraction_details':
      return '核实景点信息'
    case 'get_transport_options':
      return '查询交通方式'
    case 'find_nearby_restaurants':
      return '搜索周边美食'
    default:
      return ''
  }
}

/**
 * 防御性清洗：扫描消息列表，确保所有 AIMessage(tool_calls) 都有匹配的 ToolMessage。
 *
 * DeepSeek API 严格校验：消息历史中任何一个 assistant(tool_calls) 缺少 tool 回应
 * → 整个请求 400 "insufficient tool messages"。
 *
 * 正常情况下不会出现孤儿 tool_calls，此函数作为最后防线：
 * 如果检测到有 tool_calls 但无对应 tool 回应的 AIMessage，移除其 tool_calls 字段。
 */
function sanitizeToolMessages(messages: BaseMessage[]): BaseMessage[] {
  // 收集所有 tool 消息中的 tool_call_id
  const respondedIds = new Set<string>()
  for (const msg of messages) {
    const id = (msg as unknown as Record<string, unknown>).tool_call_id
    if (typeof id === 'string' && id) {
      respondedIds.add(id)
    }
  }

  // 对每个 AIMessage 检查 tool_calls 完整性
  return messages.map((msg) => {
    const aiMsg = msg as AIMessage
    const toolCalls = aiMsg.tool_calls
    if (!toolCalls || toolCalls.length === 0) return msg

    const missing = toolCalls.filter((tc) => !tc.id || !respondedIds.has(tc.id))
    if (missing.length === 0) return msg

    console.warn(
      '[sanitize] 移除孤儿 tool_calls:',
      missing.map((tc) => `${tc.name || '?'}#${(tc.id || '').slice(0, 8)}`).join(', ')
    )
    // 创建不含 tool_calls 的新 AIMessage，保留原始 content
    return new AIMessage({ content: aiMsg.content })
  })
}

/**
 * 安全截断消息列表，确保不破坏 tool_calls / tool_result 配对。
 *
 * 问题：简单 slice(-N) 可能切在 AIMessage(tool_calls) 和其 ToolMessages 之间，
 * 导致 API 报 "insufficient tool messages following tool_calls message"。
 *
 * 解决：从截断点向后扫描，如果第一个保留的消息是 ToolMessage，
 * 则继续向后移到非 ToolMessage 处，保证不以孤儿 ToolMessage 开头。
 */
function safeTruncateMessages(
  messages: BaseMessage[],
  maxKeep: number = 30
): BaseMessage[] {
  if (messages.length <= maxKeep) return messages

  // 保留第 0 条（SystemMessage）+ 最后 maxKeep-1 条
  let cutIndex = messages.length - maxKeep + 1

  // 截断点落在 ToolMessage 上 → 向后移动到安全位置
  // ToolMessage 有 tool_call_id 属性，其他消息类型没有
  while (
    cutIndex < messages.length - 1 &&
    'tool_call_id' in messages[cutIndex]
  ) {
    cutIndex++
  }

  return [messages[0], ...messages.slice(cutIndex)]
}

/** 从 Planner 输出中提取天数（用于自然语言摘要） */
function extractDayCount(raw: string): number | null {
  try {
    // 尝试从 JSON 中提取
    const match = raw.match(/"days"\s*:\s*(\d+)/)
    if (match) return parseInt(match[1], 10)
    // 统计 dailyItinerary 中 day 的数量
    const dayMatches = raw.match(/"day"\s*:\s*(\d+)/g)
    if (dayMatches) return dayMatches.length
  } catch {
    // 降级：返回 null
  }
  return null
}
