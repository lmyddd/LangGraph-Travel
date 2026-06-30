<template>
  <div class="page-container">
    <div class="page-header">
      <van-nav-bar fixed left-text="返回" @click-left="goBack" :title="formData.city + '行程规划'" left-arrow />
    </div>

    <div class="page-content detail-content">
      <!-- 加载中：Agent 流程 -->
      <div v-if="isLoading" class="loading-container">
        <AgentPipeline :agents="agentStates" />
      </div>

      <!-- 错误 -->
      <div v-else-if="errorMsg" class="error-state">
        <van-empty :description="errorMsg">
          <van-button type="primary" @click="getTripPlan">重新规划</van-button>
        </van-empty>
      </div>

      <!-- 行程结果 -->
      <template v-else-if="tripPlan && tripPlan.success !== false">
        <!-- 概览卡片 -->
        <div class="card overview-card fade-in-up">
          <div class="trip-header">
            <div>
              <h2>{{ formData.city }} · {{ formData.days }}天行程</h2>
              <div class="trip-meta-sub">
                <span>{{ tripPlan.dailyItinerary?.length || 0 }}天详细安排</span>
                <span v-if="formData.travelers > 1">{{ formData.travelers }}人出行</span>
              </div>
            </div>
            <div class="trip-budget">¥{{ tripPlan.totalBudget }}</div>
          </div>
        </div>

        <!-- 日期选择器 -->
        <div class="scroll-x day-selector fade-in-up" v-if="tripPlan.dailyItinerary && tripPlan.dailyItinerary.length > 1">
          <div
            v-for="day in tripPlan.dailyItinerary"
            :key="day.day"
            class="day-pill"
            :class="{ active: activeDays.includes(day.day) }"
            @click="toggleDay(day.day)"
          >
            <span class="day-pill-num">D{{ day.day }}</span>
            <span class="day-pill-label">第{{ day.day }}天</span>
          </div>
        </div>

        <!-- 每日行程 -->
        <van-collapse v-model="activeDays" class="trip-collapse fade-in-up">
          <van-collapse-item
            v-for="item in tripPlan.dailyItinerary"
            :key="item.day"
            :title="'第' + item.day + '天'"
            :name="item.day"
          >
            <div class="day-schedule">
              <!-- 每日概览 -->
              <div class="daily-summary" v-if="item.dailySummary">
                <van-icon name="info-o" size="14" />
                <p>{{ item.dailySummary }}</p>
              </div>

              <!-- 上午 -->
              <div class="schedule-section">
                <div class="section-label morning">
                  <span class="label-dot"></span>
                  <van-icon name="sun-o" size="14" />
                  <span>上午</span>
                </div>
                <SpotItem :data="item.morning" />
              </div>

              <!-- 下午 -->
              <div class="schedule-section">
                <div class="section-label afternoon">
                  <span class="label-dot"></span>
                  <van-icon name="cloud-o" size="14" />
                  <span>下午</span>
                </div>
                <SpotItem :data="item.afternoon" />
              </div>

              <!-- 晚上 -->
              <div class="schedule-section">
                <div class="section-label evening">
                  <span class="label-dot"></span>
                  <van-icon name="star-o" size="14" />
                  <span>晚上</span>
                </div>
                <SpotItem :data="item.evening" />
              </div>
            </div>
          </van-collapse-item>
        </van-collapse>

        <!-- 预算明细 -->
        <div class="card budget-card fade-in-up" v-if="tripPlan && tripPlan.budgetBreakdown">
          <div class="section-title">预算明细</div>
          <BudgetTable :data="tripPlan.budgetBreakdown" :total="tripPlan.totalBudget" />
        </div>

        <!-- 温馨提示 -->
        <div class="card tips-card fade-in-up" v-if="tripPlan && tripPlan.tips && tripPlan.tips.length > 0">
          <div class="section-title">温馨提示</div>
          <ul class="tips-list">
            <li v-for="(tip, index) in tripPlan.tips" :key="index">
              <van-icon name="info-o" size="14" class="tip-icon" />
              {{ tip }}
            </li>
          </ul>
        </div>

        <!-- 注意事项 -->
        <div class="card warnings-card fade-in-up" v-if="tripPlan && tripPlan.warnings && tripPlan.warnings.length > 0">
          <div class="section-title">注意事项</div>
          <ul class="warnings-list">
            <li v-for="(warning, index) in tripPlan.warnings" :key="index">
              <van-icon name="warning-o" size="14" class="warning-icon" />
              {{ warning }}
            </li>
          </ul>
        </div>
      </template>

      <!-- 没有结果 -->
      <van-empty v-else description="未能生成行程，请重试">
        <van-button type="primary" @click="getTripPlan">重新规划</van-button>
      </van-empty>
    </div>

    <!-- 底部操作栏 -->
    <div class="detail-footer" v-if="tripPlan && tripPlan.success !== false">
      <van-button icon="star-o" round plain class="footer-btn secondary" @click="handleFavorite">
        {{ isFavorited ? '已收藏' : '收藏' }}
      </van-button>
      <van-button icon="share-o" round plain class="footer-btn" @click="handleShare">分享</van-button>
      <van-button icon="chat-o" round type="primary" class="footer-btn primary-btn" @click="goToChat">
        AI 咨询
      </van-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import BudgetTable from '../../components/BudgetTable.vue'
import SpotItem from '../../components/SpotItem.vue'
import AgentPipeline from '../../components/AgentPipeline.vue'
import { useRoute, useRouter } from 'vue-router'
import { onMounted, onUnmounted, reactive, ref, watch, computed } from 'vue'
import { showToast } from 'vant'
import { useAgentStream } from '../../composables/useAgentStream'
import { useUserStore } from '../../store/user'
import type { TripPlan } from '@shared/types'

const route = useRoute()
const router = useRouter()

// 展开的天数（默认展开第一天）
const activeDays = ref<number[]>([])

// 表单数据
const formData = reactive({
  city: '' as string,
  budget: null as number | null,
  days: null as number | null,
  travelers: 1 as number,
  preferences: '' as string
})

// LangGraph Agent 流式
const {
  tripPlan,
  isLoading,
  errorMsg,
  agentStates,
  start,
  abort,
} = useAgentStream()

onMounted(() => {
  formData.city = (route.query.city as string) || ''
  formData.budget = route.query.budget ? Number(route.query.budget) : null
  formData.days = route.query.days ? Number(route.query.days) : null
  formData.travelers = route.query.travelers ? Number(route.query.travelers) : 1
  formData.preferences = (route.query.preferences as string) || ''

  if (formData.city && formData.budget && formData.days) {
    start({
      city: formData.city,
      budget: formData.budget,
      days: formData.days,
      travelers: formData.travelers,
      preferences: formData.preferences,
    })
  }
})

onUnmounted(() => {
  abort()
})

// 展开第一天
watch(tripPlan, (plan) => {
  if (plan?.dailyItinerary && plan.dailyItinerary.length > 0) {
    activeDays.value = plan.dailyItinerary.map((d) => d.day)
  }
})

function toggleDay(day: number) {
  const idx = activeDays.value.indexOf(day)
  if (idx >= 0) {
    activeDays.value.splice(idx, 1)
  } else {
    activeDays.value.push(day)
  }
}

function getTripPlan() {
  if (formData.city && formData.budget && formData.days) {
    start({
      city: formData.city,
      budget: formData.budget,
      days: formData.days,
      travelers: formData.travelers,
      preferences: formData.preferences,
    })
  }
}

function goBack() {
  router.go(-1)
}

function goToChat() {
  router.push({ path: '/chat', query: { scene: 'detail', city: formData.city } })
}

// 收藏（简易实现）
const isFavorited = ref(false)
function handleFavorite() {
  isFavorited.value = !isFavorited.value
  showToast({ message: isFavorited.value ? '已收藏' : '已取消收藏', position: 'top' })
}

// 分享
async function handleShare() {
  if (navigator.share) {
    try {
      await navigator.share({
        title: `${formData.city}旅行攻略`,
        text: `来看看我的${formData.city} ${formData.days}天旅行规划！预算 ¥${tripPlan.value?.totalBudget}`,
        url: window.location.href
      })
    } catch {
      // 取消
    }
  } else {
    showToast('已复制分享链接')
  }
}

// 提示已自动保存
const userStore = useUserStore()
watch(tripPlan, (plan) => {
  if (plan && plan.success && userStore.isAuthenticated) {
    showToast({
      message: '行程已自动保存，可在"我的 → 历史记录"中查看',
      position: 'top',
      duration: 3000,
    })
  }
})
</script>

<style scoped>
.page-header {
  height: 46px;
}

.detail-content {
  padding-bottom: 90px;
}

/* 覆盖全局 .page-container 的 padding-bottom，
   因为本页有自己的固定底部操作栏 */
.page-container {
  padding-bottom: 0 !important;
}

.loading-container {
  display: flex;
  flex-direction: column;
  padding: 8px 0;
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

.trip-meta-sub {
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
  border-color: transparent;
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

/* ========== 折叠面板 ========== */
.trip-collapse {
  margin-bottom: 16px;
}

.trip-collapse :deep(.van-collapse-item__title) {
  font-weight: 600;
  font-size: var(--font-md);
}

/* ========== 日安排 ========== */
.day-schedule {
  padding: 8px 0;
  position: relative;
}

/* 时间轴竖线 */
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

.daily-summary {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.06), rgba(139, 92, 246, 0.06));
  border-radius: var(--radius-sm);
  padding: 12px 14px;
  margin-bottom: 16px;
  border-left: 4px solid var(--primary);
  margin-left: 26px;
  position: relative;
  z-index: 1;
}

.daily-summary :deep(.van-icon) {
  color: var(--primary);
  margin-top: 1px;
  flex-shrink: 0;
}

.daily-summary p {
  margin: 0;
  font-size: var(--font-sm);
  color: var(--text-secondary);
  line-height: 1.7;
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

/* 时间节点圆点 */
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

.schedule-section:has(.morning)::before { border-color: #f59e0b; }
.schedule-section:has(.afternoon)::before { border-color: #0EA5E9; }
.schedule-section:has(.evening)::before { border-color: #8B5CF6; }

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

/* ========== 预算 / 提示 / 警告 卡片 ========== */
.budget-card,
.tips-card,
.warnings-card {
  margin-bottom: 16px;
}

.tips-list,
.warnings-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.tips-list li,
.warnings-list li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 0;
  color: var(--text-secondary);
  font-size: var(--font-sm);
  line-height: 1.6;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
}

.tips-list li:last-child,
.warnings-list li:last-child {
  border-bottom: none;
}

.tip-icon {
  color: var(--primary);
  flex-shrink: 0;
  margin-top: 2px;
}

.warning-icon {
  color: var(--warning);
  flex-shrink: 0;
  margin-top: 2px;
}

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

.primary-btn {
  background: var(--gradient-primary) !important;
  border: none !important;
  color: #fff !important;
  box-shadow: 0 4px 14px rgba(14, 165, 233, 0.3);
}
</style>
