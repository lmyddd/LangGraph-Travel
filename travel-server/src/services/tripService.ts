// ============================================================
// tripService — Trip / TripDay 数据持久化
//
// 职责：
//   - 行程生成后自动保存到数据库
//   - 历史列表查询（分页）
//   - 行程详情查询（含每日安排）
//   - 行程删除（级联删除 TripDay）
// ============================================================

import prisma from './db.js'
import type { TripPlan } from './agent/schemas.js'
import type { Trip, TripDay } from '../generated/client.js'

// ---- 类型 ----

/** 历史列表返回的摘要信息 */
export interface TripSummary {
  id: number
  city: string
  budget: number
  days: number
  dayCount: number // TripDay 数量
  createdAt: Date
}

/** 行程详情（含每日安排） */
export type TripDetail = Trip & { tripDays: TripDay[] }

// ---- 公开 API ----

/** 保存行程及每日安排 */
export async function saveTrip(input: {
  userId: number
  city: string
  budget: number
  days: number
  tripPlan: TripPlan
}): Promise<Trip> {
  const { userId, city, budget, days, tripPlan } = input

  return prisma.trip.create({
    data: {
      userId,
      city,
      budget,
      days,
      tripDays: {
        create: (tripPlan.dailyItinerary || []).map((day) => ({
          dayNumber: day.day,
          morning: (day.morning || {}) as any,
          afternoon: (day.afternoon || {}) as any,
          evening: (day.evening || {}) as any,
        })),
      },
    },
    include: { tripDays: true },
  })
}

/** 历史列表（按创建时间倒序，返回摘要） */
export async function listTrips(
  userId: number,
  take: number = 20,
  skip: number = 0
): Promise<TripSummary[]> {
  const trips = await prisma.trip.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take,
    skip,
    include: {
      _count: { select: { tripDays: true } },
    },
  })

  return trips.map((t) => ({
    id: t.id,
    city: t.city,
    budget: t.budget,
    days: t.days,
    dayCount: t._count.tripDays,
    createdAt: t.createdAt,
  }))
}

/** 行程详情（含每日安排，带用户校验） */
export async function getTripById(
  tripId: number,
  userId: number
): Promise<TripDetail | null> {
  return prisma.trip.findFirst({
    where: { id: tripId, userId },
    include: { tripDays: { orderBy: { dayNumber: 'asc' } } },
  })
}

/**
 * 删除行程（级联删除 TripDay）。
 * 返回 true 表示删除成功，false 表示行程不存在或不属于该用户。
 */
export async function deleteTrip(
  tripId: number,
  userId: number
): Promise<boolean> {
  const result = await prisma.trip.deleteMany({
    where: { id: tripId, userId },
  })
  return result.count > 0
}
