// ============================================================
// trip 路由 — Trip / TripDay CRUD
//
// 全部接口需要登录（requireAuth）。
//
// GET    /api/trips          — 历史列表
// GET    /api/trips/:id      — 行程详情（含每日安排）
// DELETE /api/trips/:id      — 删除行程
// ============================================================

import express, { type Request, type Response } from 'express'
import { requireAuth } from '../middleware/auth.js'
import {
  listTrips,
  getTripById,
  deleteTrip,
} from '../services/tripService.js'

const router = express.Router()

// 所有接口都需要登录
router.use(requireAuth)

// ============== 历史列表 ==============
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId
    const take = Math.min(Math.max(Number(req.query.take) || 20, 1), 100)
    const skip = Math.max(Number(req.query.skip) || 0, 0)

    const trips = await listTrips(userId, take, skip)

    res.json({
      success: true,
      data: trips,
    })
  } catch (error) {
    const msg = (error as Error).message || '获取历史列表失败'
    console.error('[trip] 获取历史列表失败:', msg)
    res.status(500).json({ success: false, error: msg })
  }
})

// ============== 行程详情 ==============
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId
    const tripId = Number(req.params.id)

    if (!tripId || tripId < 1) {
      res.status(400).json({ success: false, error: '无效的行程 ID' })
      return
    }

    const trip = await getTripById(tripId, userId)

    if (!trip) {
      res.status(404).json({ success: false, error: '行程不存在' })
      return
    }

    res.json({
      success: true,
      data: trip,
    })
  } catch (error) {
    const msg = (error as Error).message || '获取行程详情失败'
    console.error('[trip] 获取行程详情失败:', msg)
    res.status(500).json({ success: false, error: msg })
  }
})

// ============== 删除行程 ==============
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId
    const tripId = Number(req.params.id)

    if (!tripId || tripId < 1) {
      res.status(400).json({ success: false, error: '无效的行程 ID' })
      return
    }

    const deleted = await deleteTrip(tripId, userId)

    if (!deleted) {
      res.status(404).json({ success: false, error: '行程不存在' })
      return
    }

    res.json({ success: true, message: '已删除' })
  } catch (error) {
    const msg = (error as Error).message || '删除行程失败'
    console.error('[trip] 删除行程失败:', msg)
    res.status(500).json({ success: false, error: msg })
  }
})

export default router
