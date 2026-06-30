<template>
  <div class="page-container">
    <van-nav-bar
      left-text="返回"
      left-arrow
      @click-left="router.go(-1)"
      fixed
      class="page-header"
    >
      <template #title>
        <span v-if="trip">{{ trip.city }} · {{ trip.days }}天行程</span>
      </template>
    </van-nav-bar>

    <div class="page-content tripDetail-content">
      <!-- 加载中 -->
      <van-loading v-if="loading" class="centered-loading" size="32" vertical>
        加载中...
      </van-loading>

      <!-- 错误 -->
      <van-empty
        v-else-if="errorMsg"
        :description="errorMsg"
      >
        <van-button type="primary" @click="loadTrip">重新加载</van-button>
      </van-empty>

      <!-- 行程内容 -->
      <template v-else-if="trip">
        <!-- 概览卡片 -->
        <div class="card overview-card fade-in-up">
          <div class="trip-header">
            <div>
              <h2>{{ trip.city }} · {{ trip.days }}天行程</h2>
              <div class="trip-meta">
                <span>{{ trip.tripDays?.length || 0 }}天详细安排</span>
                <span>{{ formatDate(trip.createdAt) }}</span>
              </div>
            </div>
            <span class="trip-budget">¥{{ trip.budget }}</span>
          </div>
        </div>

        <!-- 日期选择器 -->
        <div class="scroll-x day-selector fade-in-up" v-if="trip.tripDays && trip.tripDays.length > 1">
          <div
            v-for="day in trip.tripDays"
            :key="day.id"
            class="day-pill"
            :class="{ active: activeDays.includes(day.dayNumber) }"
            @click="toggleDay(day.dayNumber)"
          >
            <span class="day-pill-num">D{{ day.dayNumber }}</span>
            <span class="day-pill-label">第{{ day.dayNumber }}天</span>
          </div>
        </div>

        <!-- 每日行程 -->
        <van-collapse v-if="trip.tripDays && trip.tripDays.length > 0" v-model="activeDays" class="trip-collapse fade-in-up">
          <van-collapse-item
            v-for="day in trip.tripDays"
            :key="day.id"
            :title="'第' + day.dayNumber + '天'"
            :name="day.dayNumber"
          >
            <div class="day-schedule">
              <div class="schedule-section">
                <div class="section-label morning">
                  <span class="label-dot"></span>
                  <van-icon name="sun-o" size="14" />
                  <span>上午</span>
                </div>
                <SpotItem :data="day.morning" />
              </div>
              <div class="schedule-section">
                <div class="section-label afternoon">
                  <span class="label-dot"></span>
                  <van-icon name="cloud-o" size="14" />
                  <span>下午</span>
                </div>
                <SpotItem :data="day.afternoon" />
              </div>
              <div class="schedule-section">
                <div class="section-label evening">
                  <span class="label-dot"></span>
                  <van-icon name="star-o" size="14" />
                  <span>晚上</span>
                </div>
                <SpotItem :data="day.evening" />
              </div>
            </div>
          </van-collapse-item>
        </van-collapse>

        <!-- 没有天数据 -->
        <van-empty v-else description="行程数据不完整" />
      </template>
    </div>

    <!-- 底部操作栏 -->
    <div class="detail-footer" v-if="trip">
      <van-button icon="star-o" round plain class="footer-btn secondary" @click="handleFavorite">
        {{ isFavorited ? '已收藏' : '收藏' }}
      </van-button>
      <van-button icon="share-o" round plain class="footer-btn" @click="handleShare">分享</van-button>
      <van-button icon="delete-o" round plain type="danger" class="footer-btn" @click="onDelete">删除</van-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import SpotItem from '../../components/SpotItem.vue'
import { tripsGet, tripsDelete } from '../../utils/request'

const route = useRoute()
const router = useRouter()

// ---- 类型 ----
interface TripDay {
  id: number
  dayNumber: number
  morning: Record<string, unknown>
  afternoon: Record<string, unknown>
  evening: Record<string, unknown>
}

interface TripDetail {
  id: number
  city: string
  budget: number
  days: number
  createdAt: string
  tripDays: TripDay[]
}

// ---- 状态 ----
const trip = ref<TripDetail | null>(null)
const loading = ref(false)
const errorMsg = ref('')
const activeDays = ref<number[]>([])

// ---- 加载 ----
async function loadTrip(): Promise<void> {
  const tripId = Number(route.params.id)
  if (!tripId) {
    errorMsg.value = '无效的行程 ID'
    return
  }

  loading.value = true
  errorMsg.value = ''
  try {
    const res = (await tripsGet(`/${tripId}`)) as { success: boolean; data: TripDetail }
    if (res.success && res.data) {
      trip.value = res.data
      activeDays.value = (res.data.tripDays || []).map((d) => d.dayNumber)
    } else {
      errorMsg.value = (res as any).error || '行程不存在'
    }
  } catch (e: any) {
    const status = e?.response?.status
    errorMsg.value = status === 404
      ? '行程不存在或已被删除'
      : e?.response?.data?.error || e.message || '网络错误'
  } finally {
    loading.value = false
  }
}

// ---- 日期切换 ----
function toggleDay(dayNumber: number) {
  const idx = activeDays.value.indexOf(dayNumber)
  if (idx >= 0) {
    activeDays.value.splice(idx, 1)
  } else {
    activeDays.value.push(dayNumber)
  }
}

// ---- 删除 ----
async function onDelete(): Promise<void> {
  try {
    await showConfirmDialog({
      title: '确认删除',
      message: '删除后不可恢复，确定要删除这个行程吗？',
      confirmButtonColor: '#ee0a24',
    })
  } catch {
    return
  }

  try {
    const res = (await tripsDelete(`/${route.params.id}`)) as { success: boolean }
    if (res.success) {
      showToast({ message: '已删除', position: 'top' })
      router.replace('/history')
    }
  } catch (e: any) {
    showToast({ message: e?.response?.data?.error || '删除失败', position: 'top' })
  }
}

// ---- 收藏 ----
const isFavorited = ref(false)
function handleFavorite() {
  isFavorited.value = !isFavorited.value
  showToast({ message: isFavorited.value ? '已收藏' : '已取消收藏', position: 'top' })
}

// ---- 分享 ----
async function handleShare() {
  if (navigator.share && trip.value) {
    try {
      await navigator.share({
        title: `${trip.value.city}旅行攻略`,
        text: `来看看我的${trip.value.city} ${trip.value.days}天旅行规划！预算 ¥${trip.value.budget}`,
        url: window.location.href
      })
    } catch {
      // 取消
    }
  } else {
    showToast('已复制分享链接')
  }
}

// ---- 工具 ----
function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

onMounted(loadTrip)
</script>

<style scoped>
.page-header {
  height: 46px;
}

.centered-loading {
  margin-top: 60px;
  display: flex;
  justify-content: center;
}

.tripDetail-content {
  padding-top: 60px;
  padding-bottom: 90px;
}

/* 覆盖全局 .page-container 的 padding-bottom，
   因为本页有自己的固定底部操作栏 */
.page-container {
  padding-bottom: 0 !important;
}

/* ========== 概览卡片 ========== */
.overview-card {
  margin-bottom: 16px;
}

.trip-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.trip-header h2 {
  font-size: var(--font-xl);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 4px;
}

.trip-meta {
  display: flex;
  gap: 12px;
  font-size: var(--font-xs);
  color: var(--text-muted);
}

.trip-budget {
  font-size: var(--font-xl);
  color: var(--danger);
  font-weight: 700;
  white-space: nowrap;
}

/* ========== 日期选择器 ========== */
.day-selector {
  margin-bottom: 16px;
  gap: 10px;
  padding: 4px 0;
}

.day-pill {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 72px;
  min-height: 56px;
  padding: 10px 8px;
  border-radius: var(--radius-md);
  background: #fff;
  cursor: pointer;
  user-select: none;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  border: 2px solid transparent;
  box-shadow: var(--shadow-sm);
}

.day-pill.active {
  background: var(--gradient-primary);
  box-shadow: 0 4px 14px rgba(14, 165, 233, 0.3);
  transform: translateY(-1px);
}

.day-pill-num {
  font-size: var(--font-sm);
  font-weight: 700;
  color: var(--text-secondary);
}

.day-pill.active .day-pill-num {
  color: #fff;
}

.day-pill-label {
  font-size: var(--font-xs);
  color: var(--text-muted);
  margin-top: 2px;
}

.day-pill.active .day-pill-label {
  color: rgba(255, 255, 255, 0.85);
}

.day-pill:active {
  transform: scale(0.95);
}

/* ========== 折叠面板 + 时间轴 ========== */
.trip-collapse {
  margin-bottom: 16px;
}

.trip-collapse :deep(.van-collapse-item__title) {
  font-weight: 600;
  font-size: var(--font-md);
}

.day-schedule {
  padding: 8px 0;
  position: relative;
}

.day-schedule::before {
  content: '';
  position: absolute;
  left: 15px;
  top: 6px;
  bottom: 6px;
  width: 2px;
  background: linear-gradient(180deg, #f59e0b 0%, #0EA5E9 50%, #8B5CF6 100%);
  border-radius: 1px;
  z-index: 0;
}

.schedule-section {
  margin-bottom: 18px;
  margin-left: 8px;
  padding-left: 24px;
  position: relative;
  z-index: 1;
}

.schedule-section:last-child {
  margin-bottom: 0;
}

.schedule-section::before {
  content: '';
  position: absolute;
  left: -9px;
  top: 10px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #fff;
  border: 2.5px solid var(--text-muted);
  z-index: 2;
}

.section-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-sm);
  font-weight: 600;
  padding: 4px 12px;
  border-radius: var(--radius-full);
  margin-bottom: 10px;
}

.label-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.section-label.morning {
  background: #fffbeb;
  color: #b45309;
}
.section-label.morning .label-dot { background: #f59e0b; }

.section-label.afternoon {
  background: #f0f9ff;
  color: #0369a1;
}
.section-label.afternoon .label-dot { background: #0EA5E9; }

.section-label.evening {
  background: #f5f3ff;
  color: #5b21b6;
}
.section-label.evening .label-dot { background: #8B5CF6; }

/* ========== 底部操作栏 ========== */
.detail-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 200;
  padding: 10px 16px;
  padding-bottom: max(10px, env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: 0 -2px 16px rgba(0, 0, 0, 0.06);
  max-width: 750px;
  margin: 0 auto;
  display: flex;
  gap: 10px;
}

.footer-btn {
  flex: 1;
  height: 44px;
  font-size: var(--font-sm);
  font-weight: 600;
}

.footer-btn.secondary {
  color: var(--accent);
  border-color: var(--accent);
}
</style>
