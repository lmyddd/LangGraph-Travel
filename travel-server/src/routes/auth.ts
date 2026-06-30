import express, { type Request, type Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import {
  findUserByUsername,
  findUserById,
  createUser,
  updateUserPassword,
  updateUserNickname,
  toPublicUser,
} from '../services/userService.js'
import { requireAuth } from '../middleware/auth.js'

const router = express.Router()

/** 校验用户名：2-20 位，支持中英文、数字、下划线 */
function isValidUsername(username: string): boolean {
  return /^[一-龥a-zA-Z0-9_]{2,20}$/.test(username)
}

/** 校验密码强度：至少 6 位，必须同时包含字母和数字 */
function isStrongPassword(password: string): boolean {
  if (password.length < 6) return false
  if (!/[a-zA-Z]/.test(password)) return false
  if (!/\d/.test(password)) return false
  return true
}

// ==============  登录接口  ==============
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body

  // 输入截断
  const trimmedUsername = typeof username === 'string' ? username.trim() : ''
  const trimmedPassword = typeof password === 'string' ? password : ''

  if (!trimmedUsername || !trimmedPassword) {
    res.status(400).json({
      success: false,
      error: '用户名或密码不能为空'
    })
    return
  }

  // 数据库索引查询（@unique username），O(log n) 而非全量读取
  const user = await findUserByUsername(trimmedUsername)

  if (!user) {
    res.status(400).json({
      success: false,
      error: '用户名或密码错误'
    })
    return
  }

  const isMatch = await bcrypt.compare(trimmedPassword, user.password)
  if (!isMatch) {
    res.status(400).json({
      success: false,
      error: '用户名或密码错误'
    })
    return
  }

  const token = jwt.sign(
    { userId: user.id, username: user.username },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '7d' }
  )

  res.json({
    success: true,
    data: {
      token,
      user: toPublicUser(user)
    }
  })
})

// ==============  注册接口  ==============
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { username, password, confirmPassword } = req.body

  // 输入截断
  const trimmedUsername = typeof username === 'string' ? username.trim() : ''
  const trimmedPassword = typeof password === 'string' ? password : ''
  const trimmedConfirm = typeof confirmPassword === 'string' ? confirmPassword.trim() : ''

  // --- 基础校验 ---
  if (!trimmedUsername || !trimmedPassword) {
    res.status(400).json({
      success: false,
      error: '用户名或密码不能为空'
    })
    return
  }

  if (!isValidUsername(trimmedUsername)) {
    res.status(400).json({
      success: false,
      error: '用户名需2-20位，仅支持中英文、数字、下划线'
    })
    return
  }

  if (!isStrongPassword(trimmedPassword)) {
    res.status(400).json({
      success: false,
      error: '密码至少6位且必须同时包含字母和数字'
    })
    return
  }

  if (trimmedConfirm && trimmedPassword !== trimmedConfirm) {
    res.status(400).json({
      success: false,
      error: '两次输入的密码不一致'
    })
    return
  }

  // --- 查重 ---
  const exists = await findUserByUsername(trimmedUsername)
  if (exists) {
    res.status(400).json({
      success: false,
      error: '用户名已存在'
    })
    return
  }

  // --- 加密密码 ---
  const hashedPassword = await bcrypt.hash(trimmedPassword, 10)

  // --- 创建用户（id 由数据库自增序列生成） ---
  const newUser = await createUser({
    username: trimmedUsername,
    password: hashedPassword,
  })

  // --- 签发 JWT ---
  const token = jwt.sign(
    { userId: newUser.id, username: newUser.username },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '7d' }
  )

  res.json({
    success: true,
    data: {
      token,
      user: toPublicUser(newUser)
    }
  })
})

// ==============  获取当前用户信息  ==============
router.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  // 数据库主键查询，最快的方式
  const user = await findUserById(req.user!.userId)

  if (!user) {
    res.status(404).json({
      success: false,
      error: '用户不存在'
    })
    return
  }

  res.json({
    success: true,
    data: toPublicUser(user)
  })
})

// ==============  修改密码  ==============
router.put('/password', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { oldPassword, newPassword } = req.body
  if (!oldPassword || !newPassword) {
    res.status(400).json({ success: false, error: '旧密码和新密码不能为空' })
    return
  }

  if (!isStrongPassword(newPassword)) {
    res.status(400).json({
      success: false,
      error: '新密码至少6位且必须同时包含字母和数字'
    })
    return
  }

  // 数据库查询 + 原子更新，不涉及其他用户数据
  const user = await findUserById(req.user!.userId)
  if (!user) {
    res.status(404).json({ success: false, error: '用户不存在' })
    return
  }

  const isMatch = await bcrypt.compare(oldPassword, user.password)
  if (!isMatch) {
    res.status(400).json({ success: false, error: '旧密码错误' })
    return
  }

  const hashedNewPassword = await bcrypt.hash(newPassword, 10)
  await updateUserPassword(req.user!.userId, hashedNewPassword)

  res.json({ success: true, message: '密码修改成功' })
})

// ==============  修改昵称  ==============
router.put('/nickname', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { nickname } = req.body
  if (!nickname || typeof nickname !== 'string' || !nickname.trim()) {
    res.status(400).json({ success: false, error: '昵称不能为空' })
    return
  }

  const trimmed = nickname.trim()
  if (trimmed.length < 1 || trimmed.length > 20) {
    res.status(400).json({ success: false, error: '昵称长度需在1-20位之间' })
    return
  }

  // 数据库原子更新，返回更新后的用户
  const updatedUser = await updateUserNickname(req.user!.userId, trimmed)

  if (!updatedUser) {
    res.status(404).json({ success: false, error: '用户不存在' })
    return
  }

  res.json({
    success: true,
    data: toPublicUser(updatedUser)
  })
})

export default router
