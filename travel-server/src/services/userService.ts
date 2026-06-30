import prisma from './db.js'
import type { User as PrismaUser } from '../generated/client.js'

/**
 * 对外暴露的安全用户类型（不含 password）。
 * id → userId 映射，与 shared/types.ts 中的 User 接口保持一致。
 */
export interface PublicUser {
  userId: number
  username: string
  nickname: string | null
  avatar: string | null
  createdAt: Date
}

/**
 * 将数据库 User 对象转为前端安全对象。
 * 核心作用：截断 password 字段 —— 后续任何代码都拿不到密码哈希。
 */
export function toPublicUser(u: PrismaUser): PublicUser {
  return {
    userId: u.id,
    username: u.username,
    nickname: u.nickname,
    avatar: u.avatar,
    createdAt: u.createdAt,
  }
}

// ============== 查询 ==============

/**
 * 按 username 精确查找，利用 @unique 索引。
 * 用于：登录验证、注册查重。
 */
export async function findUserByUsername(username: string) {
  return prisma.user.findUnique({ where: { username } })
}

/**
 * 按主键 id 查找，最快的查询方式。
 * 用于：token 解析后获取用户信息。
 */
export async function findUserById(id: number) {
  return prisma.user.findUnique({ where: { id } })
}

// ============== 创建 ==============

/**
 * 创建新用户。password 应为 bcrypt 加密后的密文。
 * id 由数据库 SEQUENCE 自增生成，不需要手动计算。
 */
export async function createUser(data: { username: string; password: string }) {
  return prisma.user.create({
    data: {
      username: data.username,
      password: data.password,
      nickname: data.username,   // 默认昵称 = 用户名
    },
  })
}

// ============== 更新 ==============

/**
 * 修改密码 —— 只更新 password 字段，原子操作。
 */
export async function updateUserPassword(id: number, hashedPassword: string) {
  await prisma.user.update({
    where: { id },
    data: { password: hashedPassword },
  })
}

/**
 * 修改昵称，返回更新后的完整 User 对象。
 */
export async function updateUserNickname(id: number, nickname: string) {
  return prisma.user.update({
    where: { id },
    data: { nickname },
  })
}
