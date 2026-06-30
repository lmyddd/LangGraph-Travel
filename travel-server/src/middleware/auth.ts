// ============================================================
// auth 中间件 — 统一的 JWT 鉴权层
//
// 提供两个中间件：
//   requireAuth  — 必须登录，未登录返回 401
//   optionalAuth — 可选登录，有 token 就解析挂到 req.user，没有也放行
//
// 解析后的用户信息挂载到 req.user：
//   { userId: number, username: string }
// ============================================================

import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

// ---- 扩展 Express Request 类型 ----
declare global {
  namespace Express {
    interface Request {
      user?: { userId: number; username: string }
    }
  }
}

// ---- 工具函数 ----

/** 从 Authorization 头提取并验证 JWT，返回 payload 或 null */
function verifyToken(token: string): { userId: number; username: string } | null {
  try {
    return jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key'
    ) as { userId: number; username: string }
  } catch {
    return null
  }
}

// ---- 中间件 ----

/**
 * 必须登录。
 * 未携带有效 token → 401。
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: '未登录或 token 已过期' })
    return
  }

  const payload = verifyToken(header.split(' ')[1])
  if (!payload) {
    res.status(401).json({ success: false, error: '未登录或 token 已过期' })
    return
  }

  req.user = payload
  next()
}

/**
 * 可选登录。
 * 携带了 token 就解析挂到 req.user，没有也不拦截。
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (header && header.startsWith('Bearer ')) {
    const payload = verifyToken(header.split(' ')[1])
    if (payload) {
      req.user = payload
    }
  }
  next()
}
