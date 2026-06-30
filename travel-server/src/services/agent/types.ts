// ============================================================
// Agent 系统共享类型定义
// ============================================================

/** 所有 Agent 的名称 */
export type AgentName = 'researcher' | 'planner' | 'budgeter' | 'weather'

/** 景点搜索结果 */
export interface AttractionInfo {
  name: string
  description?: string
  estimatedTicket?: string
  estimatedDuration?: string
  tips?: string
  source?: string // 信息来源 URL
}

/** 天气数据 */
export interface WeatherData {
  city: string
  temperature: string    // 温度范围，如 "18°C ~ 25°C"
  condition: string      // 天气状况，如 "晴"、"小雨"
  humidity: string
  windSpeed: string
  daily: WeatherDay[]
}

export interface WeatherDay {
  date: string
  tempMax: number
  tempMin: number
  condition: string
  precipitation: number  // 降水概率 0-100
}

/** SSE 流式事件 —— 推送给前端 */
export type AgentEvent =
  | { type: 'agent_start'; agent: AgentName; message: string }
  | { type: 'agent_progress'; agent: AgentName; detail: string }
  | { type: 'agent_complete'; agent: AgentName; summary: string }
  | { type: 'agent_error'; agent: AgentName; error: string }
  | { type: 'chunk'; agent: AgentName; content: string }
  | { type: 'complete'; data: import('@shared/types').TripPlan }

/** Agent 事件的回调函数签名 */
export type EventCallback = (event: AgentEvent) => void
