import 'dotenv/config'
import { PrismaClient } from '../src/generated/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
})

const prisma = new PrismaClient({ adapter })

interface OldUser {
  id: number
  username: string
  password: string
  nickname?: string
  avatar?: string
  createdAt: string
}

async function main() {
  console.log('🌱 开始填充种子数据...')

  // ---- 迁移 data/user.json 中的老用户 ----
  const dataFile = path.join(__dirname, '..', 'data', 'user.json')
  try {
    const raw = await fs.readFile(dataFile, 'utf-8')
    const oldUsers: OldUser[] = JSON.parse(raw)
    console.log(`  发现 ${oldUsers.length} 个老用户，开始迁移...`)

    for (const u of oldUsers) {
      await prisma.user.upsert({
        where: { username: u.username },
        update: {},   // 已存在 → 跳过，不做任何更新
        create: {
          username: u.username,
          password: u.password,      // 已是 bcrypt 哈希，直接复用
          nickname: u.nickname ?? u.username,
          avatar: u.avatar ?? null,
          createdAt: new Date(u.createdAt),
        },
      })
    }
    console.log(`✅ 成功迁移 ${oldUsers.length} 个老用户`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('ENOENT') || msg.includes('no such file')) {
      console.log('ℹ️  未找到 data/user.json，跳过老用户迁移')
    } else {
      console.error('❌ 读取老用户数据失败:', msg)
    }
  }

  console.log('✅ 种子数据填充完成')
}

main()
  .catch((e) => {
    console.error('❌ 种子脚本执行失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
