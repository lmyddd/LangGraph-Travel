// ============================================================
// chatService — ChatMessage 持久化
//
// 职责：
//   - 保存用户 ↔ AI 对话记录
//   - 加载历史对话（多轮对话上下文）
// ============================================================

import prisma from './db.js'
import type { ChatMessage } from '../generated/client.js'

/** 保存一条对话消息 */
export async function saveChatMessage(
  userId: number,
  role: 'user' | 'ai',
  content: string
): Promise<ChatMessage> {
  return prisma.chatMessage.create({
    data: {
      userId,
      role,
      content,
    },
  })
}

/**
 * 加载用户的对话历史。
 * 按时间升序排列（最早在前），用于拼接到 LLM 上下文。
 *
 * @param userId - 用户 ID
 * @param limit  - 最多取多少条（默认 50）
 */
export async function getChatHistory(
  userId: number,
  limit: number = 50
): Promise<ChatMessage[]> {
  return prisma.chatMessage.findMany({
    where: { userId },
    orderBy: { timestamp: 'asc' },
    take: limit,
  })
}
