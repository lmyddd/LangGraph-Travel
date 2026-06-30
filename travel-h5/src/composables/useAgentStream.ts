// ============================================================
// useAgentStream — LangGraph V2 Agent SSE 流式连接管理
//
// 职责：
//   1. 优先使用 SSE 模式调用 /api/travel/recommend-v2
//   2. 实时更新每个 Agent 的状态（idle→running→complete|error）
//   3. SSE 失败时自动降级为 JSON 模式
//   4. 提供 abort() 用于组件卸载时清理
// ============================================================

import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { fetchAgentStream, travelPost } from '../utils/request'
import type { AgentName, AgentEvent, TripPlan } from '@shared/types'

// ---- 类型定义 ----

/** 单个 Agent 的实时状态 */
export interface AgentStateInfo {
  /** Agent 标识：researcher | weather | planner | budgeter */
  name: AgentName
  /** 中文标签 */
  label: string
  /** Vant 图标名 */
  icon: string
  /** 当前状态 */
  status: 'idle' | 'running' | 'complete' | 'error'
  /** 当前进度消息（agent_start 的 message 或 agent_progress 的 detail） */
  message: string
  /** 完成后的摘要（agent_complete 的 summary） */
  summary: string
  /** 错误信息（agent_error 的 error） */
  error: string
}

/** start() 调用参数 */
interface StartParams {
  city: string
  budget: number
  days: number
  travelers: number
  preferences: string
}

/** useAgentStream 返回类型 */
interface UseAgentStreamReturn {
  tripPlan: Ref<TripPlan | null>
  isLoading: Ref<boolean>
  errorMsg: Ref<string>
  agentStates: ComputedRef<AgentStateInfo[]>
  streamingContent: Ref<string>
  isStreaming: Ref<boolean>
  start: (params: StartParams) => Promise<void>
  abort: () => void
}

// ---- Agent 元数据 ----

const AGENT_META: Record<AgentName, { label: string; icon: string }> = {
  researcher: { label: '搜索景点', icon: 'search' },
  weather: { label: '天气查询', icon: 'cloud-o' },
  planner: { label: '行程规划', icon: 'edit' },
  budgeter: { label: '预算计算', icon: 'gold-coin-o' },
}

/** Agent 显示顺序 */
const AGENT_ORDER: AgentName[] = ['researcher', 'weather', 'planner', 'budgeter']

// ---- 内部工具 ----

/** 创建初始 Agent 状态 */
function createInitialAgentStates(): Map<AgentName, AgentStateInfo> {
  const map = new Map<AgentName, AgentStateInfo>()
  for (const name of AGENT_ORDER) {
    const meta = AGENT_META[name]
    map.set(name, {
      name,
      label: meta.label,
      icon: meta.icon,
      status: 'idle',
      message: '',
      summary: '',
      error: '',
    })
  }
  return map
}

// ---- Composable ----

export function useAgentStream(): UseAgentStreamReturn {
  // ---- 响应式状态 ----
  const tripPlan = ref<TripPlan | null>(null) as Ref<TripPlan | null>
  const isLoading = ref(false)
  const errorMsg = ref('')
  const streamingContent = ref('')
  const isStreaming = ref(false)

  // 内部 Map（非响应式逐字段追踪太复杂，用 reactive Map 替代）
  const _agentStates = ref<Map<AgentName, AgentStateInfo>>(createInitialAgentStates())

  /** 向组件暴露的 Agent 状态数组（按 AGENT_ORDER 排序） */
  const agentStates = computed<AgentStateInfo[]>(() => {
    const states = _agentStates.value
    return AGENT_ORDER.map((name) => {
      const s = states.get(name)
      return s ?? {
        name,
        label: AGENT_META[name].label,
        icon: AGENT_META[name].icon,
        status: 'idle' as const,
        message: '',
        summary: '',
        error: '',
      }
    })
  })

  // SSE 流控制器
  let abortController: AbortController | null = null

  // ---- Agent 事件处理 ----

  function handleAgentEvent(event: AgentEvent): void {
    switch (event.type) {
      case 'agent_start': {
        const states = new Map(_agentStates.value)
        const current = states.get(event.agent)
        if (current) {
          states.set(event.agent, {
            ...current,
            status: 'running',
            message: event.message,
            summary: '',
            error: '',
          })
          _agentStates.value = states
        }
        break
      }

      case 'agent_progress': {
        const states = new Map(_agentStates.value)
        const current = states.get(event.agent)
        if (current) {
          states.set(event.agent, {
            ...current,
            message: event.detail,
          })
          _agentStates.value = states
        }
        break
      }

      case 'agent_complete': {
        const states = new Map(_agentStates.value)
        const current = states.get(event.agent)
        if (current) {
          states.set(event.agent, {
            ...current,
            status: 'complete',
            summary: event.summary,
          })
          _agentStates.value = states
        }
        break
      }

      case 'agent_error': {
        const states = new Map(_agentStates.value)
        const current = states.get(event.agent)
        if (current) {
          states.set(event.agent, {
            ...current,
            status: 'error',
            error: event.error,
          })
          _agentStates.value = states
        }
        // agent_error 对非 Planner 来说是非致命的，继续运行
        break
      }

      case 'chunk': {
        // Planner 流式输出内容
        streamingContent.value += event.content
        isStreaming.value = true
        break
      }
    }
  }

  function handleComplete(data: TripPlan): void {
    tripPlan.value = data
    isLoading.value = false
    isStreaming.value = false

    // 将所有还在 running/idle 的 Agent 标记为 complete
    const states = new Map(_agentStates.value)
    for (const [name, s] of states) {
      if (s.status === 'running' || s.status === 'idle') {
        states.set(name, {
          ...s,
          status: 'complete',
          summary: s.summary || '已完成',
        })
      }
    }
    _agentStates.value = states
  }

  function handleError(error: string): void {
    errorMsg.value = error
    isLoading.value = false
    isStreaming.value = false
  }

  // ---- SSE 模式 ----

  async function trySSEMode(params: StartParams): Promise<boolean> {
    const { city, budget, days, travelers, preferences } = params
    return new Promise((resolve) => {
      fetchAgentStream(
        'recommend-v2',
        { city, budget, days, travelers, preferences },
        handleAgentEvent,
        (data) => {
          handleComplete(data)
          resolve(true)
        },
        (error) => {
          console.warn('[useAgentStream] SSE 模式失败，将降级为 JSON 模式:', error)
          // 重置 Agent 状态准备重试
          _agentStates.value = createInitialAgentStates()
          streamingContent.value = ''
          isStreaming.value = false
          resolve(false)
        }
      ).then((controller) => {
        abortController = controller
      })
    })
  }

  // ---- JSON 降级模式 ----

  async function tryJSONMode(params: StartParams): Promise<void> {
    const { city, budget, days, travelers, preferences } = params
    try {
      // 将所有 Agent 标记为完成（JSON 模式没有逐 Agent 进度）
      const states = new Map(_agentStates.value)
      for (const [name, s] of states) {
        if (s.status === 'idle' || s.status === 'running') {
          states.set(name, {
            ...s,
            status: 'complete',
            summary: '已完成（JSON 模式）',
          })
        }
      }
      _agentStates.value = states

      const result = await travelPost<TripPlan>('recommend-v2', {
        city,
        budget,
        days,
        travelers,
        preferences,
      })

      tripPlan.value = result
      isLoading.value = false
      errorMsg.value = ''
    } catch (error) {
      const msg =
        (error as { response?: { data?: { error?: string } }; message?: string })?.response?.data?.error ||
        (error as { message?: string })?.message ||
        '请求失败，请检查后端服务是否启动'
      handleError(msg)
    }
  }

  // ---- 公开方法 ----

  async function start(params: StartParams): Promise<void> {
    // 重置所有状态
    isLoading.value = true
    errorMsg.value = ''
    tripPlan.value = null
    streamingContent.value = ''
    isStreaming.value = false
    _agentStates.value = createInitialAgentStates()

    // 先尝试 SSE 模式
    const sseSuccess = await trySSEMode(params)

    // SSE 失败则降级为 JSON 模式
    if (!sseSuccess && isLoading.value) {
      await tryJSONMode(params)
    }
  }

  function abort(): void {
    if (abortController) {
      abortController.abort()
      abortController = null
    }
    isLoading.value = false
    isStreaming.value = false
  }

  return {
    tripPlan,
    isLoading,
    errorMsg,
    agentStates,
    streamingContent,
    isStreaming,
    start,
    abort,
  }
}
