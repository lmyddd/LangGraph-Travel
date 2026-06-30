import authRouter from './routes/auth.js'
import express from 'express'
import travelRouter from './routes/travel.js'
import tripRouter from './routes/trip.js'
import 'dotenv/config'
import cors from 'cors'
import { disconnectPrisma } from './services/db.js'

const app = express()
// 允许跨域请求
app.use(cors())

app.use(express.json()) // 解析json请求体
app.use(express.urlencoded({ extended: true })) // 解析urlencoded请求体
// 创建一个心跳接口
app.post('/api/heartbeat', (req, res) => {
  console.log(req.query)
  console.log(req.body)
  res.json(
    {
      message: '服务端正在运行',
      timestamp: Date.now()
    }
  )
})
// 注册路由中间件
app.use('/api/travel', travelRouter)
app.use('/api/auth', authRouter)
app.use('/api/trips', tripRouter)
const port = process.env.PORT || '3300'

const server = app.listen(port, () => {
  console.log(`服务端的地址是:http://localhost:${port}`)
})

// ---- 优雅关闭 ----
// 关闭顺序：先断数据库连接池 → 再停 HTTP 服务
// 如果先停 HTTP，正在处理的请求可能还需要数据库
async function gracefulShutdown(signal: string) {
  console.log(`\n收到 ${signal} 信号，正在关闭服务器...`)
  await disconnectPrisma()
  server.close(() => {
    console.log('服务器已安全关闭')
    process.exit(0)
  })
  // 兜底：5 秒后强制退出（防止连接池残留阻塞进程）
  setTimeout(() => {
    console.error('强制退出（关闭超时）')
    process.exit(1)
  }, 5000)
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'))   // Ctrl+C
process.on('SIGTERM', () => gracefulShutdown('SIGTERM')) // Docker stop / kill
