/**
 * 追问推荐 —— 根据 AI 回复内容关键词生成建议追问
 */

interface SuggestionTrigger {
  keywords: string[]
  questions: string[]
}

const TRIGGERS: SuggestionTrigger[] = [
  {
    keywords: ['景点', '必去', '推荐', '打卡', '著名'],
    questions: ['这些景点怎么去？', '需要提前预约吗？', '附近有什么美食推荐？']
  },
  {
    keywords: ['美食', '好吃', '特色', '小吃', '餐厅', '火锅', '早茶'],
    questions: ['有什么特色小吃？', '人均消费大概多少？', '有推荐的餐馆吗？']
  },
  {
    keywords: ['交通', '地铁', '公交', '打车', '出行', '机场', '火车'],
    questions: ['地铁方便吗？', '打车大概多少钱？', '机场怎么去市区？']
  },
  {
    keywords: ['天气', '季节', '气候', '穿', '冷', '热', '下雨'],
    questions: ['适合穿什么衣服？', '这个季节天气如何？', '需要带雨具吗？']
  },
  {
    keywords: ['酒店', '住宿', '住', '民宿', '青旅'],
    questions: ['推荐住哪个区域？', '有没有性价比高的酒店？', '民宿和酒店哪个好？']
  },
  {
    keywords: ['预算', '费用', '价格', '省钱', '贵', '便宜', '消费'],
    questions: ['这个预算够吗？', '有哪些省钱技巧？', '大概需要准备多少现金？']
  },
  {
    keywords: ['攻略', '行程', '规划', '路线', '安排'],
    questions: ['帮我优化一下行程', '有没有更好的路线？', '时间会不会太赶？']
  }
]

/** 默认兜底追问 */
const DEFAULT_QUESTIONS = ['还有其他推荐吗？', '帮我规划一个详细行程', '有什么需要注意的？']

/**
 * 根据 AI 最后一条回复提取追问建议
 */
export function getSuggestions(lastAiMessage: string, count = 3): string[] {
  if (!lastAiMessage) return DEFAULT_QUESTIONS.slice(0, count)

  const results: string[] = []

  for (const trigger of TRIGGERS) {
    if (trigger.keywords.some((kw) => lastAiMessage.includes(kw))) {
      for (const q of trigger.questions) {
        if (!results.includes(q)) results.push(q)
      }
    }
  }

  // 去重后取最多 count 条，不足的用默认补充
  const unique = [...new Set(results)]
  while (unique.length < count) {
    const dq = DEFAULT_QUESTIONS[unique.length % DEFAULT_QUESTIONS.length]
    if (!unique.includes(dq)) unique.push(dq)
  }

  return unique.slice(0, count)
}
