<template>
  <div class="page-container">
    <van-nav-bar
      title="历史行程"
      left-text="返回"
      left-arrow
      @click-left="router.go(-1)"
      fixed
      class="page-header"
    />

    <!-- 搜索栏 -->
    <div class="search-bar">
      <van-search
        v-model="searchText"
        placeholder="搜索城市..."
        shape="round"
        background="transparent"
        @update:model-value="onSearch"
      />
    </div>

    <div class="page-content history-content">
      <!-- 下拉刷新 + 列表 -->
      <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
        <!-- 加载中 -->
        <van-loading v-if="loading && trips.length === 0" class="centered-loading" size="32" vertical>
          加载中...
        </van-loading>

        <!-- 错误 -->
        <van-empty
          v-else-if="errorMsg && trips.length === 0"
          :description="errorMsg"
        >
          <van-button type="primary" @click="loadTrips(true)">重新加载</van-button>
        </van-empty>

        <!-- 空列表 -->
        <van-empty
          v-else-if="!loading && filteredTrips.length === 0 && !searchText"
          description="还没有规划过行程"
          image="search"
        >
          <van-button type="primary" @click="router.push('/')">去规划一个</van-button>
        </van-empty>

        <!-- 搜索无结果 -->
        <van-empty
          v-else-if="!loading && filteredTrips.length === 0"
          description="没有找到匹配的城市"
          image="search"
        />

        <!-- 行程列表 -->
        <van-list
          v-else
          v-model:loading="loadingMore"
          :finished="finished"
          finished-text="—— 没有更多了 ——"
          @load="onLoadMore"
        >
          <van-swipe-cell
            v-for="trip in filteredTrips"
            :key="trip.id"
          >
            <div
              class="trip-card card press-scale"
              @click="router.push(`/trip/${trip.id}`)"
            >
              <div class="trip-card-left">
                <span class="trip-emoji">{{ getCityEmoji(trip.city) }}</span>
              </div>
              <div class="trip-card-body">
                <div class="trip-card-header">
                  <h3 class="trip-city">{{ trip.city }}</h3>
                  <span class="trip-date">{{ formatDate(trip.createdAt) }}</span>
                </div>
                <div class="trip-card-tags">
                  <span class="tag tag-days">{{ trip.days }}天</span>
                  <span class="tag tag-budget">¥{{ trip.budget }}</span>
                  <span class="tag tag-points">{{ trip.dayCount }}个行程点</span>
                </div>
              </div>
              <van-icon name="arrow" size="16" class="trip-arrow" />
            </div>

            <template #right>
              <van-button
                square
                type="danger"
                class="delete-btn"
                @click.stop="onDelete(trip.id)"
              >
                删除
              </van-button>
            </template>
          </van-swipe-cell>
        </van-list>
      </van-pull-refresh>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import { tripsGet, tripsDelete } from '../../utils/request'
import { getCityInfo } from '../../utils/cities'

const router = useRouter()

// ---- 类型 ----
interface TripSummary {
  id: number
  city: string
  budget: number
  days: number
  dayCount: number
  createdAt: string
}

// ---- 状态 ----
const trips = ref<TripSummary[]>([])
const loading = ref(false)
const errorMsg = ref('')
const searchText = ref('')
const refreshing = ref(false)

// 分页
const PAGE_SIZE = 20
const currentSkip = ref(0)
const loadingMore = ref(false)
const finished = ref(false)

// ---- 筛选 ----
const filteredTrips = computed(() => {
  if (!searchText.value.trim()) return trips.value
  const q = searchText.value.trim().toLowerCase()
  return trips.value.filter((t) => t.city.toLowerCase().includes(q))
})

function onSearch() {
  // computed 自动更新，无需额外处理
}

// ---- 加载列表 ----
async function loadTrips(reset = false): Promise<void> {
  if (reset) {
    currentSkip.value = 0
    finished.value = false
    trips.value = []
  }

  if (reset) loading.value = true
  errorMsg.value = ''

  try {
    const res = (await tripsGet(`?skip=${currentSkip.value}&take=${PAGE_SIZE}`)) as {
      success: boolean
      data: TripSummary[]
    }
    if (res.success) {
      const data = res.data || []
      if (reset) {
        trips.value = data
      } else {
        trips.value.push(...data)
      }
      currentSkip.value += data.length
      if (data.length < PAGE_SIZE) finished.value = true
    } else {
      errorMsg.value = (res as any).error || '加载失败'
    }
  } catch (e: any) {
    errorMsg.value = e?.response?.data?.error || e.message || '网络错误'
  } finally {
    loading.value = false
  }
}

// 下拉刷新
async function onRefresh() {
  await loadTrips(true)
  refreshing.value = false
}

// 加载更多
async function onLoadMore() {
  if (finished.value) return
  loadingMore.value = true
  await loadTrips(false)
  loadingMore.value = false
}

// ---- 删除 ----
async function onDelete(tripId: number): Promise<void> {
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
    const res = (await tripsDelete(`/${tripId}`)) as { success: boolean }
    if (res.success) {
      trips.value = trips.value.filter((t) => t.id !== tripId)
      showToast({ message: '已删除', position: 'top' })
    }
  } catch (e: any) {
    showToast({ message: e?.response?.data?.error || '删除失败', position: 'top' })
  }
}

// ---- 工具函数 ----
function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  if (d.getFullYear() === now.getFullYear()) {
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function getCityEmoji(city: string): string {
  return getCityInfo(city)?.emoji || '🏙️'
}

onMounted(() => loadTrips(true))
</script>

<style scoped>
.page-header {
  height: 46px;
}

.search-bar {
  position: sticky;
  top: 46px;
  z-index: 99;
  background: var(--bg);
  padding: 8px 16px;
}

.search-bar :deep(.van-search__content) {
  background: #fff;
  border-radius: 20px;
}

.centered-loading {
  margin-top: 60px;
  display: flex;
  justify-content: center;
}

.history-content {
  padding-top: 52px !important;
}

/* ========== 行程卡片 ========== */
.trip-card {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 8px 0;
  padding: 16px 14px;
  cursor: pointer;
  transition: var(--transition);
}

.trip-card:hover {
  box-shadow: var(--shadow-md);
}

.trip-card-left {
  flex-shrink: 0;
}

.trip-emoji {
  font-size: 32px;
  line-height: 1;
}

.trip-card-body {
  flex: 1;
  min-width: 0;
}

.trip-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.trip-city {
  font-size: var(--font-lg);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.trip-date {
  font-size: var(--font-xs);
  color: var(--text-muted);
}

.trip-card-tags {
  display: flex;
  gap: 8px;
}

.tag {
  font-size: var(--font-xs);
  font-weight: 500;
  padding: 2px 10px;
  border-radius: var(--radius-sm);
  white-space: nowrap;
}

.tag-days {
  background: rgba(14, 165, 233, 0.1);
  color: var(--primary);
}

.tag-budget {
  background: rgba(234, 88, 12, 0.1);
  color: var(--accent);
}

.tag-points {
  background: rgba(7, 193, 96, 0.1);
  color: var(--success);
}

.trip-arrow {
  color: var(--text-muted);
  flex-shrink: 0;
}

/* 删除按钮 */
.delete-btn {
  height: 100%;
  display: flex;
  align-items: center;
}
</style>
