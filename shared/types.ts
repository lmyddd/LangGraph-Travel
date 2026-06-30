// ============================================================
// travel-AI 共享类型定义
// 前后端共享，确保 API 契约一致
// ============================================================

// ---------- 通用 API 响应 ----------
export interface ApiResponse<T = unknown> {
  /** 请求是否成功 */
  success: boolean
  /** 响应数据（泛型，成功时返回） */
  data?: T
  /** 错误信息（失败时返回） */
  error?: string
}

// ---------- 用户认证 ----------
export interface User {
  /** 用户唯一标识 */
  userId: number
  /** 用户名（登录账号） */
  username: string
  /** 昵称（展示用） */
  nickname?: string
  /** 头像 URL */
  avatar?: string
  /** 账号创建时间 */
  createdAt: string
}

export interface AuthPayload {
  /** JWT 认证令牌 */
  token: string
  /** 当前登录用户信息 */
  user: User
}

// ---------- 行程规划 ----------
export interface SpotInfo {
  /** 景点唯一标识或简称 */
  spot?: string
  /** 景点名称 */
  name?: string
  /** 建议游玩时长，如 "2-3小时" */
  duration?: string
  /** 门票信息，如 "60元/人" */
  ticket?: string
  /** 到达方式，如 "地铁2号线 → 步行5分钟" */
  transportation?: string
  /** 景点简介 */
  description?: string
  /** 开放时间，如 "08:30-17:00（旺季）/ 09:00-16:00（淡季）" */
  openingHours?: string
  /** 详细地址 */
  address?: string
  /** 景点贴士（最佳拍照点、避开人流技巧等） */
  spotTips?: string
  /** 周边美食推荐 */
  nearbyFood?: string
  /** 推荐指数 1-5，如 "★★★★☆" */
  rating?: string
}

export interface DailyItinerary {
  /** 行程第几天（从 1 开始） */
  day: number
  /** 日期，如 "2025-06-24" */
  date?: string
  /** 每日概览（一段话概述当天行程亮点） */
  dailySummary?: string
  /** 上午景点 */
  morning: SpotInfo
  /** 下午景点 */
  afternoon: SpotInfo
  /** 晚间景点 / 活动 */
  evening: SpotInfo
}

export interface BudgetBreakdown {
  /** 住宿费用（元） */
  accommodation: number
  /** 餐饮费用（元） */
  food: number
  /** 交通费用（元） */
  transportation: number
  /** 门票费用（元） */
  tickets: number
  /** 其他杂项费用（元） */
  other: number
}

export interface TripPlan {
  /** 是否生成成功 */
  success: boolean
  /** 目标城市 */
  city?: string
  /** 行程天数 */
  days?: number
  /** 总预算（可能为数值或 "弹性" 等描述） */
  totalBudget?: number | string
  /** 每日行程安排 */
  dailyItinerary?: DailyItinerary[]
  /** 预算明细 */
  budgetBreakdown?: BudgetBreakdown
  /** 旅行贴士 */
  tips?: string[]
  /** 注意事项 / 警告 */
  warnings?: string[]
  /** 错误信息（失败时返回） */
  error?: string
  /** AI 原始返回文本（调试用） */
  rawResponse?: string
}

// ---------- 聊天 / 流式 ----------
export interface ChatMessage {
  /** 消息唯一标识 */
  id: number
  /** 消息角色：用户或 AI */
  role: 'user' | 'ai'
  /** 消息正文 */
  content: string
  /** 消息发送时间 */
  timestamp: string
}

export interface StreamChunk {
  /** 事件类型 */
  type: 'chunk'
  /** 流式输出的文本片段 */
  content: string
}

export interface StreamComplete {
  /** 事件类型 */
  type: 'complete'
  /** 最终生成结果 */
  data: {
    /** 是否成功 */
    success: boolean
    /** 完整回复内容 */
    reply: string
  }
}

export interface StreamError {
  /** 事件类型 */
  type: 'error'
  /** 错误描述 */
  error: string
}

/** SSE 流事件联合类型 */
export type StreamEvent = StreamChunk | StreamComplete | StreamError

// ---------- Agent 事件（多 Agent 编排的 SSE 推送） ----------

/** Agent 名称 */
export type AgentName = 'researcher' | 'planner' | 'budgeter' | 'weather'

/** Agent 状态事件 */
export type AgentEvent =
  | { type: 'agent_start'; agent: AgentName; message: string }
  | { type: 'agent_progress'; agent: AgentName; detail: string }
  | { type: 'agent_complete'; agent: AgentName; summary: string }
  | { type: 'agent_error'; agent: AgentName; error: string }
  | { type: 'chunk'; agent: AgentName; content: string }
  | { type: 'complete'; data: TripPlan }
  | { type: 'error'; error: string }
