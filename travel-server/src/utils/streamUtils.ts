import type { Response } from 'express'

export interface StreamController {
  send: (data: unknown) => void
  end: () => void
  error: (message: string) => void
}

const createStreamResponse = (res: Response): StreamController => {
  // 1.设置响应头
  res.setHeader('Content-Type', 'text/event-stream')
  // 确保客户端每次得到的是最新的数据
  res.setHeader('Cache-Control', 'no-cache')
  // 保持http长连接
  res.setHeader('Connection', 'keep-alive')
  return {
    send: (data: unknown): void => {
      try {
        console.log(`data: ${JSON.stringify(data)}\n\n`)
        res.write(`data: ${JSON.stringify(data)}\n\n`)
      } catch (error) {
        console.error('流式发送错误', error)
      }
    },
    end: (): void => {
      try {
        res.write(`event: end\ndata: { "done": "true" }\n\n`)
        res.end()
      } catch (error) {
        console.error('流式结束错误', error)
      }
    },
    error: (message: string): void => {
      try {
        res.write(`data: ${JSON.stringify(message)}\n\n`)
        res.end()
      } catch (error) {
        console.error('流式错误', error)
      }
    }
  }
}

export default createStreamResponse
