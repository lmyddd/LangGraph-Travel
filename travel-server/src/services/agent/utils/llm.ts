// ============================================================
// createLLM — 统一的 LLM 工厂函数
//
// 将散落在 planner-llm.ts、reviewer.ts、BaseAgent、TravelService
// 中重复的 LLM 初始化逻辑收敛到一处。
//
// 支持通过环境变量切换 DeepSeek / SiliconFlow 等 OpenAI 兼容 API。
// ============================================================

import { ChatOpenAI } from '@langchain/openai'

/** LLM 工厂配置选项 */
export interface CreateLLMOptions {
  /** 用于错误信息中的标识，如 "Planner"、"Reviewer" */
  label?: string
  /** 模型温度 (0-2)，默认 0.7 */
  temperature?: number
  /** 是否启用流式输出，默认 false */
  streaming?: boolean
}

/**
 * 统一的 LLM 实例工厂。
 *
 * 通过 MODEL_PROVIDER 环境变量选择提供商，
 * 自动读取对应的 API_KEY、BASE_URL、MODEL 环境变量。
 *
 * 配置缺失时抛出 Error，由调用方决定如何处理（throw / catch 后回退）。
 *
 * @example
 *   const plannerLLM = createLLM({ label: 'Planner', temperature: 0.7, streaming: true })
 *   const reviewerLLM = createLLM({ label: 'Reviewer', temperature: 0.3 })
 */
export function createLLM(options: CreateLLMOptions = {}): ChatOpenAI {
  const { label = 'LLM', temperature = 0.7, streaming = false } = options

  const provider = (process.env.MODEL_PROVIDER || '').toUpperCase()

  let apiKey: string | undefined
  let baseURL: string | undefined
  let model: string | undefined

  if (provider === 'SILICONFLOW' || provider === 'SIICONFLOW') {
    // 兼容 SIICONFLOW
    apiKey = process.env.SILICONFLOW_API_KEY || process.env.SIICONFLOW_API_KEY
    baseURL = process.env.SILICONFLOW_BASE_URL || process.env.SIICONFLOW_BASE_URL
    model = process.env.SILICONFLOW_MODEL || process.env.SIICONFLOW_MODEL
  } else {
    // 默认：DeepSeek
    apiKey = process.env.DEEPSEEK_API_KEY
    baseURL = process.env.DEEPSEEK_BASE_URL
    model = process.env.DEEPSEEK_MODEL
  }

  // 移除 OpenAI SDK 自动追加的 /chat/completions 路径，避免重复拼接
  const normalizedBaseURL = (baseURL || '').replace(/\/chat\/completions\/?$/, '')

  if (!apiKey || !normalizedBaseURL || !model) {
    const providerHint = provider === 'SILICONFLOW' || provider === 'SIICONFLOW'
      ? 'SILICONFLOW_API_KEY / SILICONFLOW_BASE_URL / SILICONFLOW_MODEL'
      : 'DEEPSEEK_API_KEY / DEEPSEEK_BASE_URL / DEEPSEEK_MODEL'
    throw new Error(
      `[${label}] LLM 配置不完整：MODEL_PROVIDER=${provider || '(未设置)'}，请检查 ${providerHint} 环境变量。`
    )
  }

  return new ChatOpenAI({
    configuration: { baseURL: normalizedBaseURL },
    apiKey,
    model,
    temperature,
    streaming,
  })
}

/**
 * 安全创建 LLM 实例：失败时返回 null 和错误信息，不抛出异常。
 *
 * 适用于需要 fail-soft 的场景（如 TravelService 构造函数、
 * BaseAgent 初始化），让调用方在后续方法中检查可用性而非启动即崩溃。
 */
export function createLLMSafe(options: CreateLLMOptions = {}): {
  llm: ChatOpenAI | null
  error: string
} {
  try {
    return { llm: createLLM(options), error: '' }
  } catch (err) {
    return { llm: null, error: (err as Error).message }
  }
}
