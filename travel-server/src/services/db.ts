import 'dotenv/config'
import { PrismaClient } from '../generated/client.js'
import { PrismaPg } from '@prisma/adapter-pg'

/**
 * Prisma 7 需要使用驱动适配器来连接数据库。
 * PrismaPg 内部维护连接池，复用 TCP 连接。
 */
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
})

/**
 * 单例 PrismaClient —— 整个应用共享一个实例。
 * 避免重复创建连接池导致 PostgreSQL 连接耗尽（默认上限 100）。
 */
const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'info', 'warn', 'error']
    : ['error'],
})

/**
 * 优雅关闭：释放连接池中的所有连接。
 * 在进程退出前必须调用，否则 PostgreSQL 侧会残留僵尸连接。
 */
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect()
}

export default prisma
