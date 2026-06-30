import express, { type Request, type Response } from 'express'
import travelService from '../services/travelService.js'
import createStreamResponse from '../utils/streamUtils.js'
import { saveTrip } from '../services/tripService.js'
import { saveChatMessage, getChatHistory } from '../services/chatService.js'
import { optionalAuth } from '../middleware/auth.js'
import type { TripPlan } from '../services/agent/schemas.js'

const router = express.Router()

// travel 路由使用可选登录：已登录用户自动保存行程
router.use(optionalAuth)

/**
 * POST /api/travel/recommend-v2
 *
 * V2 LangGraph 旅游规划接口（工具调用 + 自我反思）。
 * 已登录用户的结果会自动保存到 Trip / TripDay 表。
 */
router.post('/recommend-v2', async (req: Request, res: Response): Promise<void> => {
  const { city, budget, days, travelers, preferences } = req.body

  if (!city || !budget || !days) {
    res.status(400).json({
      success: false,
      error: '缺少必要参数：city, budget, days',
    })
    return
  }

  const wantsStream = req.headers.accept?.includes('text/event-stream')

  if (wantsStream) {
    // ---- SSE 流式模式 ----
    const stream = createStreamResponse(res)
    let streamClosed = false

    try {
      const result = await travelService.recommendV2(
        city,
        Number(budget),
        Number(days),
        Number(travelers) || 1,
        preferences || '',
        (event) => {
          // 防止写入已关闭的流
          if (streamClosed) return
          try {
            stream.send(event)
          } catch {
            streamClosed = true
          }
        }
      )

      // 自动保存行程（在流关闭之前）
      await autoSaveTrip(req, city, Number(budget), Number(days), result)

      if (!streamClosed) {
        stream.end()
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : '服务端错误'
      if (!streamClosed) {
        stream.send({ type: 'error', error: msg })
        stream.end()
      }
    }
  } else {
    // ---- 普通 JSON 模式 ----
    try {
      const result = await travelService.recommendV2(
        city,
        Number(budget),
        Number(days),
        Number(travelers) || 1,
        preferences || ''
      )

      // 自动保存行程
      await autoSaveTrip(req, city, Number(budget), Number(days), result)

      // 在响应中附带是否已保存的信息
      const response: any = { ...result }
      if (req.user && result.success) {
        response._saved = true
      }

      res.json(response)
    } catch (error) {
      const msg = error instanceof Error ? error.message : '服务端错误'
      res.status(400).json({ success: false, error: msg })
    }
  }
})

/**
 * POST /api/travel/chat
 *
 * AI 对话接口（SSE 流式）。
 * 已登录用户的历史对话会持久化到 ChatMessage 表，
 * 并作为上下文喂给 LLM，实现多轮对话。
 */
router.post('/chat', async (req: Request, res: Response): Promise<void> => {
  const { message } = req.body
  if (!message) {
    res.status(400).json({
      success: false,
      error: '缺少必要参数：message',
    })
    return
  }

  const stream = createStreamResponse(res)
  const userId = req.user?.userId

  try {
    // 已登录：保存用户消息
    if (userId) {
      await saveChatMessage(userId, 'user', message).catch((e) =>
        console.error('[chat] 保存用户消息失败:', e)
      )
    }

    // 已登录：加载历史对话（最近 20 轮 = 40 条消息）
    let history: Array<{ role: string; content: string }> = []
    if (userId) {
      try {
        const rawHistory = await getChatHistory(userId, 40)
        history = rawHistory.map((m) => ({
          role: m.role,
          content: m.content,
        }))
        console.log(`[chat] 加载了 ${history.length} 条历史消息 (userId=${userId})`)
      } catch (e) {
        console.error('[chat] 加载历史对话失败:', e)
      }
    }

    // 调用对话服务（传入历史上下文）
    const result = await travelService.chat(
      message,
      (chunk: string) => {
        stream.send({ type: 'chunk', content: chunk })
      },
      history
    )

    // 已登录：保存 AI 回复
    if (userId && result.success && result.reply) {
      await saveChatMessage(userId, 'ai', result.reply).catch((e) =>
        console.error('[chat] 保存 AI 回复失败:', e)
      )
    }

    stream.send({ type: 'complete', data: result })
    stream.end()
  } catch (error) {
    const msg = error instanceof Error ? error.message : '服务端错误'
    stream.send({ type: 'error', error: msg })
    stream.end()
  }
})

// ============================================================
// 内部工具函数
// ============================================================

/**
 * 如果用户已登录，自动保存生成的行程到数据库。
 * 保存失败不阻塞响应（静默记录日志）。
 */
async function autoSaveTrip(
  req: Request,
  city: string,
  budget: number,
  days: number,
  tripPlan: TripPlan
): Promise<void> {
  if (!req.user) {
    console.log('[travel] 用户未登录，跳过自动保存')
    return
  }
  if (!tripPlan.success) {
    console.log('[travel] 行程生成失败，跳过自动保存')
    return
  }
  if (!tripPlan.dailyItinerary || tripPlan.dailyItinerary.length === 0) {
    console.log('[travel] 行程无 dailyItinerary，跳过自动保存')
    return
  }

  try {
    const saved = await saveTrip({
      userId: req.user.userId,
      city,
      budget,
      days,
      tripPlan,
    })
    console.log(`[travel] ✅ 行程已自动保存 (tripId=${saved.id}, userId=${req.user.userId}, city=${city})`)
  } catch (error) {
    console.error('[travel] 自动保存行程失败（不影响响应）:', (error as Error).message)
  }
}

export default router
