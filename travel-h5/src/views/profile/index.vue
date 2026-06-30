<template>
  <div class="profile-page">
    <!-- 导航栏 -->
    <van-nav-bar
      title="我的"
      :left-arrow="false"
      class="profile-nav"
    />

    <!-- 用户信息卡片 -->
    <div class="user-card fade-in-up">
      <div class="user-card-bg">
        <div class="bg-circle c1"></div>
        <div class="bg-circle c2"></div>
        <div class="bg-circle c3"></div>
      </div>
      <div class="user-card-content">
        <div class="avatar-wrapper">
          <van-image
            :src="userAvatar"
            round
            class="avatar"
          />
        </div>
        <div class="user-details">
          <h2 class="user-name">{{ userDisplayName }}</h2>
          <p class="user-desc">欢迎使用智能旅游助手</p>
        </div>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-row fade-in-up" v-if="!statsLoading">
      <StatCard
        icon="todo-list-o"
        :value="stats.totalTrips"
        label="总行程"
        color="#fff"
        gradient="linear-gradient(135deg, #0EA5E9, #38BDF8)"
      />
      <StatCard
        icon="location-o"
        :value="stats.totalCities"
        label="探索城市"
        color="#fff"
        gradient="linear-gradient(135deg, #EA580C, #F97316)"
      />
      <StatCard
        icon="calendar-o"
        :value="stats.totalDays"
        label="旅行天数"
        color="#fff"
        gradient="linear-gradient(135deg, #8B5CF6, #A78BFA)"
      />
    </div>
    <!-- 统计加载骨架 -->
    <div class="stats-row fade-in-up" v-else>
      <SkeletonCard v-for="i in 3" :key="i" :height="90" :lines="1" />
    </div>

    <!-- 功能菜单 -->
    <div class="menu-section fade-in-up">
      <h3 class="menu-title">我的服务</h3>
      <div class="menu-list">
        <div class="menu-item" @click="goToFavorites">
          <div class="menu-icon-wrapper icon-star">
            <van-icon name="star-o" size="20" />
          </div>
          <span class="menu-label">我的收藏</span>
          <van-icon name="arrow" size="14" class="menu-arrow" />
        </div>
        <div class="menu-item" @click="router.push('/history')">
          <div class="menu-icon-wrapper icon-history">
            <van-icon name="clock-o" size="20" />
          </div>
          <span class="menu-label">历史记录</span>
          <van-icon name="arrow" size="14" class="menu-arrow" />
        </div>
        <div class="menu-item" @click="showSettings">
          <div class="menu-icon-wrapper icon-setting">
            <van-icon name="setting-o" size="20" />
          </div>
          <span class="menu-label">设置</span>
          <van-icon name="arrow" size="14" class="menu-arrow" />
        </div>
        <div class="menu-item menu-item-danger" @click="onLogout">
          <div class="menu-icon-wrapper icon-logout">
            <van-icon name="revoke" size="20" />
          </div>
          <span class="menu-label">退出登录</span>
          <van-icon name="arrow" size="14" class="menu-arrow" />
        </div>
      </div>
    </div>

    <!-- 关于 -->
    <div class="menu-section fade-in-up">
      <h3 class="menu-title">关于</h3>
      <div class="menu-list">
        <div class="menu-item" @click="showAboutDialog">
          <div class="menu-icon-wrapper icon-about">
            <van-icon name="info-o" size="20" />
          </div>
          <span class="menu-label">关于我们</span>
          <van-icon name="arrow" size="14" class="menu-arrow" />
        </div>
        <div class="menu-item">
          <div class="menu-icon-wrapper icon-version">
            <van-icon name="label-o" size="20" />
          </div>
          <span class="menu-label">版本信息</span>
          <span class="menu-value">v2.0.0</span>
        </div>
      </div>
    </div>

    <!-- 底部品牌 -->
    <div class="footer-brand">
      <p>智能旅游助手 · AI 驱动</p>
      <p class="footer-sub">© 2026 Travel AI</p>
    </div>

    <!-- 关于我们对话框 -->
    <van-dialog
      v-model:show="aboutDialogVisible"
      title="关于我们"
      show-cancel-button
    >
      <div class="about-content">
        <div class="about-logo">✈️</div>
        <p class="about-name">智能旅游助手 v2.0.0</p>
        <p class="about-desc">基于 AI 技术的智能旅游规划平台</p>
        <p class="about-detail">为您提供个性化的旅游行程推荐和实时旅游咨询服务</p>
        <p class="about-copy">© 2026 智能旅游助手</p>
      </div>
    </van-dialog>

    <!-- 设置面板 -->
    <van-action-sheet
      v-model:show="settingsVisible"
      title="设置"
      :actions="settingActions"
      cancel-text="关闭"
      @select="onSettingSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { showToast, showConfirmDialog } from 'vant'
import { useUserStore } from '../../store/user'
import { useRouter } from 'vue-router'
import StatCard from '../../components/StatCard.vue'
import SkeletonCard from '../../components/SkeletonCard.vue'
import { tripsGet } from '../../utils/request'

const router = useRouter()
const userStore = useUserStore()

// 用户信息
const userAvatar = computed(() => userStore.user?.avatar || 'https://img.yzcdn.cn/vant/cat.jpeg')
const userDisplayName = computed(() => userStore.user?.nickname || userStore.user?.username || '游客')

// 统计数据
const statsLoading = ref(true)
const stats = ref({ totalTrips: 0, totalCities: 0, totalDays: 0 })

async function loadStats() {
  statsLoading.value = true
  try {
    const res = (await tripsGet('?take=100')) as { success: boolean; data: any[] }
    if (res.success && res.data) {
      const trips = res.data
      stats.value.totalTrips = trips.length
      stats.value.totalCities = new Set(trips.map((t: any) => t.city)).size
      stats.value.totalDays = trips.reduce((sum: number, t: any) => sum + (t.days || 0), 0)
    }
  } catch {
    // 静默失败，保持默认值 0
  } finally {
    statsLoading.value = false
  }
}

// 退出登录
const onLogout = async () => {
  try {
    await showConfirmDialog({
      title: '确认退出登录',
      message: '确定要退出登录吗？'
    })
    userStore.logout()
    showToast({ message: '退出登录成功', position: 'top' })
    router.replace('/login')
  } catch {
    // 用户取消
  }
}

// 关于对话框
const aboutDialogVisible = ref(false)
const showAboutDialog = () => { aboutDialogVisible.value = true }

// 设置面板
const settingsVisible = ref(false)
const settingActions = [
  { name: 'dark-mode', subname: '深色模式（开发中）', disabled: true },
  { name: 'language', subname: '语言：简体中文', disabled: true },
  { name: 'clear-cache', subname: '清除缓存', color: '#ee0a24' },
  { name: 'about', subname: '关于我们' }
]

const showSettings = () => { settingsVisible.value = true }

const onSettingSelect = (action: { name: string }) => {
  settingsVisible.value = false
  switch (action.name) {
    case 'clear-cache':
      localStorage.clear()
      showToast({ message: '缓存已清除', position: 'top' })
      break
    case 'about':
      showAboutDialog()
      break
  }
}

// 收藏 → 跳转历史页（收藏功能简易实现）
const goToFavorites = () => {
  router.push('/history')
  showToast({ message: '可在历史记录中查看和删除行程', position: 'top' })
}

onMounted(loadStats)
</script>

<style scoped>
.profile-page {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--bg);
  padding-bottom: 80px;
}

.profile-nav :deep(.van-nav-bar__title) {
  font-weight: 600;
}

/* ========== 用户信息卡片 ========== */
.user-card {
  position: relative;
  margin: 16px;
  border-radius: var(--radius-xl);
  overflow: hidden;
  min-height: 160px;
}

.user-card-bg {
  position: absolute;
  inset: 0;
  background: var(--gradient-primary);
}

.bg-circle {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
}

.bg-circle.c1 { width: 140px; height: 140px; top: -50px; right: -40px; }
.bg-circle.c2 { width: 80px; height: 80px; bottom: 10px; right: 70px; background: rgba(255,255,255,0.07); }
.bg-circle.c3 { width: 120px; height: 120px; top: 40px; left: -60px; background: rgba(255,255,255,0.05); }

.user-card-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  padding: 28px 24px;
}

.avatar-wrapper {
  flex-shrink: 0;
}

.avatar {
  width: 76px;
  height: 76px;
  border-radius: 50%;
  border: 3px solid rgba(255, 255, 255, 0.5);
}

.user-details {
  margin-left: 20px;
  color: #fff;
}

.user-name {
  font-size: 21px;
  font-weight: 700;
  margin: 0 0 4px;
  letter-spacing: 0.5px;
}

.user-desc {
  font-size: var(--font-sm);
  margin: 0;
  opacity: 0.85;
}

/* ========== 统计行 ========== */
.stats-row {
  display: flex;
  gap: 10px;
  margin: 0 16px 16px;
}

/* ========== 菜单区块 ========== */
.menu-section {
  margin: 0 16px 16px;
  background: #fff;
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.menu-title {
  font-size: var(--font-sm);
  font-weight: 600;
  color: var(--text-secondary);
  padding: 14px 18px 10px;
  margin: 0;
}

.menu-list {
  padding: 0 4px;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 14px 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: var(--radius-sm);
  margin: 2px 4px;
  touch-action: manipulation;
}

.menu-item:hover { background: #f8fafc; }
.menu-item:active { background: #f1f5f9; transform: scale(0.98); }
.menu-item:last-child { margin-bottom: 4px; }
.menu-item-danger:hover { background: #fff5f5; }
.menu-item-danger:active { background: #ffe8e8; }

.menu-icon-wrapper {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 14px;
  flex-shrink: 0;
}

.icon-star { background: linear-gradient(135deg, #fff3e0, #ffe0b2); color: #f59e0b; }
.icon-history { background: linear-gradient(135deg, rgba(14,165,233,0.12), rgba(56,189,248,0.12)); color: #0EA5E9; }
.icon-setting { background: linear-gradient(135deg, #f3e5f5, #e1bee7); color: #9c27b0; }
.icon-logout { background: linear-gradient(135deg, #ffe8e8, #ffd4d4); color: #e53935; }
.icon-about { background: linear-gradient(135deg, #e0f2f1, #b2dfdb); color: #00897b; }
.icon-version { background: linear-gradient(135deg, #e8eaf6, #c5cae9); color: #5c6bc0; }

.menu-label {
  flex: 1;
  font-size: var(--font-md);
  font-weight: 500;
  color: var(--text-primary);
}

.menu-item-danger .menu-label { color: #e53935; }

.menu-arrow {
  color: #cbd5e1;
  flex-shrink: 0;
}

.menu-value {
  font-size: var(--font-sm);
  color: var(--text-muted);
  margin-right: 4px;
}

/* ========== 底部品牌 ========== */
.footer-brand {
  text-align: center;
  padding: 30px 20px;
  color: var(--text-muted);
  font-size: var(--font-sm);
}

.footer-brand p { margin: 0; }

.footer-sub {
  font-size: var(--font-xs) !important;
  margin-top: 4px !important;
  opacity: 0.7;
}

/* ========== 关于对话框 ========== */
.about-content {
  text-align: center;
  padding: 10px 0;
}

.about-logo { font-size: 48px; margin-bottom: 12px; }
.about-name { font-size: var(--font-md); font-weight: 600; color: var(--text-primary); margin: 0 0 8px; }
.about-desc { font-size: var(--font-sm); color: var(--text-secondary); margin: 0 0 4px; }
.about-detail { font-size: var(--font-sm); color: var(--text-muted); margin: 8px 0 16px; line-height: 1.6; }
.about-copy { font-size: var(--font-xs); color: var(--text-muted); opacity: 0.7; }
</style>
