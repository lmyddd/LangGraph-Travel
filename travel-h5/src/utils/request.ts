import axios, { type AxiosResponse } from 'axios'
import { useUserStore } from '../store/user'
import type { AgentEvent, TripPlan } from '@shared/types'

// ============================================================
// 两个 axios 实例：auth（认证）和 travel（业务）
// 开发环境下通过 Vite proxy 转发到 http://127.0.0.1:3300
// 生产环境下由 Nginx 反向代理统一处理
// ============================================================

/** 认证相关 API：/api/auth/* */
const authRequest = axios.create({
  baseURL: '/api/auth',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

/** 旅游业务 API：/api/travel/* */
const travelRequest = axios.create({
  baseURL: '/api/travel',
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
})

/** 行程管理基础请求 */
const tripsRequest = axios.create({
  baseURL: '/api/trips',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// ---- 请求拦截器：自动挂载 JWT Token ----
const authInterceptor = (config: any) => {
  const userStore = useUserStore()
  if (userStore.token) {
    config.headers.Authorization = `Bearer ${userStore.token}`
  }
  return config
}

authRequest.interceptors.request.use(authInterceptor, (e) => Promise.reject(e))
travelRequest.interceptors.request.use(authInterceptor, (e) => Promise.reject(e))
tripsRequest.interceptors.request.use(authInterceptor, (e) => Promise.reject(e))


// ---- 响应拦截器：统一解包 data ----
const unwrapResponse = (response: AxiosResponse) => response.data

authRequest.interceptors.response.use(unwrapResponse, (e) => Promise.reject(e))
travelRequest.interceptors.response.use(unwrapResponse, (e) => Promise.reject(e))
tripsRequest.interceptors.response.use(unwrapResponse, (e) => Promise.reject(e))

// ============================================================
// 认证 API
// ============================================================
export function authPost<T = unknown>(url: string, data?: unknown): Promise<T> {
  return authRequest.post<T>(url, data) as Promise<T>
}

export function authGet<T = unknown>(url: string): Promise<T> {
  return authRequest.get<T>(url) as Promise<T>
}

export function authPut<T = unknown>(url: string, data?: unknown): Promise<T> {
  return authRequest.put<T>(url, data) as Promise<T>
}

// ============================================================
// 旅游业务 API
// ============================================================
export function travelPost<T = unknown>(url: string, data?: unknown): Promise<T> {
  return travelRequest.post<T>(url, data) as Promise<T>
}

export function travelGet<T = unknown>(url: string, params?: unknown): Promise<T> {
  return travelRequest.get<T>(url, { params }) as Promise<T>
}

// ============================================================
// 行程管理 API（/api/trips/*）
// ============================================================

export function tripsGet<T = unknown>(url: string, params?: unknown): Promise<T> {
  return tripsRequest.get<T>(url, { params }) as Promise<T>
}

export function tripsDelete<T = unknown>(url: string): Promise<T> {
  return tripsRequest.delete<T>(url) as Promise<T>
}

// ============================================================
// SSE 流式请求（用于 AI 对话）
// ============================================================
type ChunkCallback = (chunk: string) => void
type CompleteCallback = (data: unknown) => void
type ErrorCallback = (error: string) => void

export async function fetchStream(
  url: string,
  data: unknown,
  onChunk: ChunkCallback,
  onComplete: CompleteCallback,
  onError: ErrorCallback
): Promise<void> {
  const controller = new AbortController()
  const userStore = useUserStore()

  try {
    // 使用相对路径，开发环境下由 Vite proxy 转发
    // Axios 不支持流式读取响应体（它会把整个响应加载到内存再返回）。SSE 需要边收边解析，所以用原生 fetch API
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    }
    if (userStore.token) {
      headers['Authorization'] = `Bearer ${userStore.token}`
    }

    const response = await fetch(`/api/travel/${url}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
      signal: controller.signal,
    })

    if (!response.ok) {
      onError(`HTTP ${response.status}: ${response.statusText}`)
      return
    }

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n').filter((line) => line.trim())
      for (const line of lines) {
        try {
          if (line.startsWith('data: ')) {
            const jsonData = JSON.parse(line.substring(6))
            if (jsonData.type === 'chunk') {
              onChunk(jsonData.content)
            } else if (jsonData.type === 'complete') {
              onComplete(jsonData.data)
            } else if (jsonData.type === 'error') {
              onError(jsonData.error)
            } else if (jsonData.done) {
              // 兼容旧格式：event: end 发送 { done: true }
              onComplete(jsonData)
            }
          }
        } catch {
          // SSE 数据解析失败，跳过这行继续
        }
      }
    }
    controller.abort()
  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      onError((error as Error).message || '流式请求失败')
    }
  }
}

// ============================================================
// SSE Agent 流式请求（用于 LangGraph V2 Agent 进度可视化）
// ============================================================

/** Agent 事件回调：接收全部 AgentEvent（agent_start/progress/complete/error/chunk） */
type AgentEventCallback = (event: AgentEvent) => void
/** Agent 完成回调：接收最终 TripPlan */
type AgentCompleteCallback = (data: TripPlan) => void
/** Agent 错误回调 */
type AgentErrorCallback = (error: string) => void

/**
 * 发起 SSE Agent 流式请求。
 *
 * 相比 fetchStream，该函数：
 * - 附带 JWT 认证头（从 Pinia userStore 读取 token）
 * - 设置 Accept: text/event-stream 请求头
 * - 分发全部 AgentEvent 类型（agent_start/progress/complete/error/chunk）
 * - 返回 AbortController 供调用方中止
 *
 * @param url          - API 路径（相对于 /api/travel/）
 * @param body         - 请求体（JSON 序列化后发送）
 * @param onAgentEvent - Agent 事件回调（所有 agent_* + chunk 事件）
 * @param onComplete   - 最终完成回调（接收 TripPlan）
 * @param onError      - 全局错误回调
 * @returns AbortController，调用方可通过 .abort() 中止流
 */
export async function fetchAgentStream(
  url: string,
  body: unknown,
  onAgentEvent: AgentEventCallback,
  onComplete: AgentCompleteCallback,
  onError: AgentErrorCallback,
): Promise<AbortController> {
  const controller = new AbortController()
  const userStore = useUserStore()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream',
  }
  if (userStore.token) {
    headers['Authorization'] = `Bearer ${userStore.token}`
  }

  // 异步执行 fetch，不阻塞返回 controller
  ;(async () => {
    try {
      const response = await fetch(`/api/travel/${url}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      if (!response.ok) {
        onError(`HTTP ${response.status}: ${response.statusText}`)
        return
      }

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter((line) => line.trim())
        for (const line of lines) {
          try {
            if (line.startsWith('data: ')) {
              const jsonData = JSON.parse(line.substring(6))
              switch (jsonData.type) {
                case 'agent_start':
                case 'agent_progress':
                case 'agent_complete':
                case 'agent_error':
                case 'chunk':
                  onAgentEvent(jsonData as AgentEvent)
                  break
                case 'complete':
                  onComplete(jsonData.data as TripPlan)
                  break
                case 'error':
                  onError(jsonData.error || '未知错误')
                  break
                default:
                  // 兼容旧格式：event: end → { done: true }
                  if (jsonData.done) {
                    // 流正常结束，不触发额外回调
                  }
              }
            }
          } catch {
            // SSE 数据解析失败，跳过这行继续
          }
        }
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        onError((error as Error).message || 'Agent 流式请求失败')
      }
    }
  })()

  return controller
}
