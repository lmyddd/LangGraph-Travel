<template>
  <div class="page-container">
    <!-- 导航栏 -->
    <div class="page-header">
      <van-nav-bar title="智能旅游助手" left-arrow />
    </div>

    <!-- 欢迎横幅（带背景图） -->
    <div class="welcome-banner fade-in-up">
      <div class="banner-bg"></div>
      <div class="banner-content">
        <h1 class="banner-title">探索世界，发现美好</h1>
        <p class="banner-subtitle">AI 智能规划，让每一次旅行都充满惊喜</p>
      </div>
      <div class="banner-decoration">
        <div class="deco-circle c1"></div>
        <div class="deco-circle c2"></div>
        <div class="deco-circle c3"></div>
      </div>
    </div>

    <div class="page-content">
      <!-- 行程规划卡片 -->
      <div class="card search-card scale-in">
        <div class="section-title">规划你的行程</div>
        <div class="form-group">
          <!-- 目的地（带下拉提示） -->
          <div class="city-input-wrapper">
            <van-field
              v-model="formData.city"
              label="目的地"
              placeholder="选择或输入城市"
              left-icon="location-o"
              class="styled-field"
              @input="onCityInput"
              @focus="showCitySuggestions = true"
              @blur="onCityBlur"
            />
            <transition name="fade">
              <div class="city-suggestions" v-if="showCitySuggestions && citySuggestions.length > 0">
                <div
                  v-for="c in citySuggestions"
                  :key="c.name"
                  class="city-suggestion-item"
                  @mousedown.prevent="selectCity(c)"
                >
                  <span class="suggestion-emoji">{{ c.emoji }}</span>
                  <div class="suggestion-info">
                    <span class="suggestion-name">{{ c.name }}</span>
                    <span class="suggestion-tagline">{{ c.tagline }}</span>
                  </div>
                </div>
              </div>
            </transition>
          </div>

          <van-field
            v-model="formData.budget"
            label="预算（元）"
            type="number"
            placeholder="请输入预算金额"
            left-icon="gold-coin-o"
            class="styled-field"
          />
          <div class="form-row">
            <van-field
              v-model="formData.days"
              type="digit"
              label="天数"
              placeholder="天数"
              left-icon="calendar-o"
              class="styled-field half-field"
            />
            <van-field
              v-model="formData.travelers"
              type="digit"
              label="人数"
              placeholder="人数"
              left-icon="friends-o"
              class="styled-field half-field"
            />
          </div>
          <van-field
            v-model="formData.preferences"
            label="偏好"
            type="textarea"
            rows="1"
            autosize
            placeholder="如：美食、历史、风景（选填）"
            left-icon="smile-o"
            class="styled-field"
          />
        </div>
        <van-button
          type="primary"
          round
          size="large"
          :loading="isLoading"
          @click="handleSubmit"
          class="submit-btn"
        >
          <template v-if="!isLoading">
            <span>✨ 开始规划</span>
          </template>
        </van-button>
      </div>

      <!-- 热门目的地 -->
      <div class="card popular-destinations scale-in">
        <div class="section-title">热门目的地</div>
        <div class="scroll-x city-scroll">
          <CityCard
            v-for="city in popularCities"
            :key="city.name"
            :city="city.name"
            :emoji="city.emoji"
            :tagline="city.tagline"
            :gradient="city.gradient"
            :active="formData.city === city.name"
            @select="selectCity"
          />
        </div>
      </div>

      <!-- 为你推荐 -->
      <div class="card recommendations scale-in">
        <div class="section-title">为你推荐</div>
        <div class="scroll-x rec-scroll">
          <div
            v-for="rec in recommendedTrips"
            :key="rec.city"
            class="rec-card"
            :style="{ background: rec.gradient }"
            @click="handleRecommendClick(rec)"
          >
            <div class="rec-card-content">
              <span class="rec-emoji">{{ rec.emoji }}</span>
              <h4 class="rec-city">{{ rec.city }}</h4>
              <p class="rec-desc">{{ rec.desc }}</p>
              <span class="rec-link">去看看 →</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 快捷入口 -->
      <div class="card quick-actions scale-in">
        <div class="section-title">快捷入口</div>
        <div class="quick-grid">
          <div class="quick-item" @click="goPage('/chat')">
            <div class="quick-icon chat-icon">
              <van-icon name="chat-o" size="22" />
            </div>
            <span class="quick-label">AI 对话</span>
            <span class="quick-desc">智能旅游咨询</span>
          </div>
          <div class="quick-item" @click="goPage('/history')">
            <div class="quick-icon history-icon">
              <van-icon name="clock-o" size="22" />
            </div>
            <span class="quick-label">历史记录</span>
            <span class="quick-desc">查看过往行程</span>
          </div>
          <div class="quick-item" @click="goPage('/profile')">
            <div class="quick-icon profile-icon">
              <van-icon name="user-o" size="22" />
            </div>
            <span class="quick-label">个人中心</span>
            <span class="quick-desc">管理账户信息</span>
          </div>
          <div class="quick-item" @click="handleShare">
            <div class="quick-icon share-icon">
              <van-icon name="share-o" size="22" />
            </div>
            <span class="quick-label">分享应用</span>
            <span class="quick-desc">推荐给好友</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { useUserStore } from '../../store/user'
import CityCard from '../../components/CityCard.vue'
import { POPULAR_CITIES, searchCities, type CityInfo } from '../../utils/cities'

// 用户状态
const userStore = useUserStore()
const router = useRouter()

// 热门目的地（带完整数据）
const popularCities = POPULAR_CITIES

// 推荐行程
const recommendedTrips = [
  { city: '北京', emoji: '🏯', desc: '3天故宫长城经典游 ¥1500起', gradient: 'linear-gradient(135deg, #dc2626 0%, #f87171 100%)' },
  { city: '成都', emoji: '🐼', desc: '4天美食休闲慢生活 ¥1200起', gradient: 'linear-gradient(135deg, #059669 0%, #34d399 100%)' },
  { city: '杭州', emoji: '🛶', desc: '2天西湖江南韵味 ¥800起', gradient: 'linear-gradient(135deg, #0891b2 0%, #22d3ee 100%)' },
  { city: '西安', emoji: '🏛️', desc: '3天穿越千年历史 ¥1300起', gradient: 'linear-gradient(135deg, #d97706 0%, #fbbf24 100%)' }
]

// 表单数据
interface FormData {
  city: string
  budget: string
  days: string
  travelers: string
  preferences: string
}
const formData = reactive<FormData>({
  city: '',
  budget: '',
  days: '',
  travelers: '1',
  preferences: ''
})

// 城市搜索建议
const showCitySuggestions = ref(false)
const citySuggestions = ref<CityInfo[]>([])
let blurTimer: ReturnType<typeof setTimeout> | null = null

function onCityInput() {
  citySuggestions.value = searchCities(formData.city)
  showCitySuggestions.value = true
}

function onCityBlur() {
  // 延迟关闭，让 mousedown 事件先触发
  blurTimer = setTimeout(() => {
    showCitySuggestions.value = false
  }, 150)
}

function selectCity(city: CityInfo | string) {
  formData.city = typeof city === 'string' ? city : city.name
  showCitySuggestions.value = false
  if (blurTimer) clearTimeout(blurTimer)
}

// 状态
const isLoading = ref(false)

// 开始规划
const handleSubmit = () => {
  isLoading.value = true
  if (!formData.city) {
    showToast('请选择目的地')
    isLoading.value = false
    return
  }
  if (!formData.budget || Number(formData.budget) < 100) {
    showToast('预算金额不能小于100元')
    isLoading.value = false
    return
  }
  if (!formData.days || Number(formData.days) < 1 || Number(formData.days) > 30) {
    showToast('天数必须在1-30天之间')
    isLoading.value = false
    return
  }
  const travelers = Number(formData.travelers) || 1
  if (travelers < 1 || travelers > 50) {
    showToast('人数必须在1-50人之间')
    isLoading.value = false
    return
  }
  router.push({
    path: '/detail',
    query: {
      city: formData.city,
      budget: formData.budget,
      days: formData.days,
      travelers: String(travelers),
      preferences: formData.preferences || ''
    }
  })
}

// 推荐点击 → 快速填入表单并跳转
function handleRecommendClick(rec: { city: string; desc: string }) {
  formData.city = rec.city
  if (!formData.budget) formData.budget = '2000'
  if (!formData.days) formData.days = '3'
}

// 页面跳转
const goPage = (path: string) => {
  router.push(path)
}

// 分享
async function handleShare() {
  if (navigator.share) {
    try {
      await navigator.share({
        title: '智能旅游助手',
        text: 'AI 智能旅行规划，让每一次出发都从容不迫',
        url: window.location.origin
      })
    } catch {
      // 用户取消
    }
  } else {
    showToast('已复制分享链接')
  }
}

// 欢迎用户
onMounted(() => {
  if (userStore.user?.username) {
    showToast({
      message: `欢迎您, ${userStore.user.nickname || userStore.user.username}`,
      position: 'top'
    })
  }
})
</script>

<style scoped>
/* ========== 欢迎横幅 ========== */
.welcome-banner {
  position: relative;
  margin: 0 16px;
  margin-top: 16px;
  padding: 32px 24px;
  border-radius: var(--radius-xl);
  color: #fff;
  overflow: hidden;
  min-height: 140px;
  display: flex;
  align-items: center;
}

.banner-bg {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(135deg, rgba(14, 165, 233, 0.85) 0%, rgba(56, 189, 248, 0.8) 100%),
    url('@/assets/hero.png') center / cover no-repeat;
  filter: brightness(0.7);
}

.banner-content {
  position: relative;
  z-index: 1;
}

.banner-title {
  font-size: var(--font-xxl);
  font-weight: 700;
  margin: 0 0 6px 0;
  letter-spacing: 1px;
}

.banner-subtitle {
  font-size: var(--font-sm);
  margin: 0;
  opacity: 0.9;
  letter-spacing: 0.3px;
}

.banner-decoration {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 50%;
  pointer-events: none;
}

.deco-circle {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
}

.deco-circle.c1 { width: 90px; height: 90px; top: -25px; right: -20px; }
.deco-circle.c2 { width: 60px; height: 60px; bottom: 8px; right: 50px; }
.deco-circle.c3 { width: 40px; height: 40px; bottom: -10px; right: 10px; background: rgba(255, 255, 255, 0.08); }

/* ========== 搜索卡片 ========== */
.search-card {
  margin-bottom: 16px;
}

.city-input-wrapper {
  position: relative;
}

.styled-field {
  background: #f8fafc;
  border-radius: var(--radius-sm);
  margin-bottom: 10px;
  transition: var(--transition);
  border: 2px solid transparent;
}

.styled-field:focus-within {
  border-color: var(--primary);
  background: #fff;
  box-shadow: 0 0 0 4px rgba(14, 165, 233, 0.08);
}

.styled-field :deep(.van-field__left-icon) {
  color: var(--primary);
}

/* 天数和人数并排 */
.form-row {
  display: flex;
  gap: 10px;
}

.half-field {
  flex: 1;
}

/* 城市搜索建议 */
.city-suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 10;
  background: #fff;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  max-height: 260px;
  overflow-y: auto;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.city-suggestion-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.15s;
}

.city-suggestion-item:hover {
  background: #f0f9ff;
}

.city-suggestion-item:active {
  background: #e0f2fe;
}

.suggestion-emoji {
  font-size: 22px;
}

.suggestion-info {
  display: flex;
  flex-direction: column;
}

.suggestion-name {
  font-size: var(--font-md);
  font-weight: 600;
  color: var(--text-primary);
}

.suggestion-tagline {
  font-size: var(--font-xs);
  color: var(--text-muted);
}

/* 淡入过渡 */
.fade-enter-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from { opacity: 0; transform: translateY(-4px); }
.fade-leave-to { opacity: 0; }

.submit-btn {
  margin-top: 6px;
  height: 48px;
  font-size: var(--font-md);
  font-weight: 600;
  letter-spacing: 1px;
  border: none !important;
  background: var(--gradient-primary) !important;
  box-shadow: 0 4px 16px rgba(14, 165, 233, 0.35);
  transition: var(--transition);
}

.submit-btn:active {
  transform: scale(0.97);
  box-shadow: 0 2px 8px rgba(14, 165, 233, 0.25);
}

/* ========== 热门目的地滚动 ========== */
.city-scroll {
  padding-bottom: 4px;
}

/* ========== 为你推荐 ========== */
.rec-scroll {
  gap: 12px;
}

.rec-card {
  width: 200px;
  min-height: 130px;
  border-radius: var(--radius-lg);
  padding: 18px 16px;
  color: #fff;
  cursor: pointer;
  user-select: none;
  transition: all 0.25s ease;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.rec-card:active {
  transform: scale(0.97);
}

.rec-card-content {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.rec-emoji {
  font-size: 28px;
  margin-bottom: 8px;
}

.rec-city {
  font-size: var(--font-lg);
  font-weight: 700;
  margin: 0 0 4px;
}

.rec-desc {
  font-size: var(--font-xs);
  opacity: 0.9;
  margin: 0 0 8px;
  flex: 1;
}

.rec-link {
  font-size: var(--font-xs);
  font-weight: 600;
  opacity: 0.9;
}

/* ========== 快捷入口 ========== */
.quick-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.quick-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 18px 10px;
  border-radius: var(--radius-md);
  background: #f8fafc;
  cursor: pointer;
  transition: var(--transition);
  border: 2px solid transparent;
  min-height: 96px;
  justify-content: center;
}

.quick-item:hover {
  border-color: var(--primary);
  background: #fff;
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.quick-item:active {
  transform: scale(0.96);
}

.quick-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}

.chat-icon {
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.12), rgba(56, 189, 248, 0.12));
  color: #0EA5E9;
}

.history-icon {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.12), rgba(167, 139, 250, 0.12));
  color: #8B5CF6;
}

.profile-icon {
  background: linear-gradient(135deg, rgba(234, 88, 12, 0.12), rgba(249, 115, 22, 0.12));
  color: #EA580C;
}

.share-icon {
  background: linear-gradient(135deg, rgba(7, 193, 96, 0.12), rgba(5, 200, 100, 0.12));
  color: #07c160;
}

.quick-label {
  font-size: var(--font-md);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.quick-desc {
  font-size: var(--font-xs);
  color: var(--text-muted);
}
</style>
