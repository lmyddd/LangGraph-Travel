<template>
  <div class="spot-item" v-if="data && (data.spot || data.name)">
    <!-- 头部：名称 + 评分 -->
    <div class="spot-header">
      <h4 class="spot-name">{{ data.spot || data.name || '待定' }}</h4>
      <span class="spot-rating" v-if="data.rating">
        <span class="rating-stars">{{ toStars(data.rating) }}</span>
        <span class="rating-text">{{ data.rating }}</span>
      </span>
    </div>

    <!-- 基本信息：时长 / 门票 / 开放时间 -->
    <div class="spot-meta" v-if="data.duration || data.ticket || data.openingHours">
      <div class="meta-item" v-if="data.duration">
        <van-icon name="clock-o" size="14" />
        <span>{{ data.duration }}</span>
      </div>
      <div class="meta-item" v-if="data.ticket">
        <van-icon name="gold-coin-o" size="14" />
        <span>{{ data.ticket }}</span>
      </div>
      <div class="meta-item" v-if="data.openingHours">
        <van-icon name="calendar-o" size="14" />
        <span>{{ data.openingHours }}</span>
      </div>
    </div>

    <!-- 地址 -->
    <div class="spot-address" v-if="data.address">
      <van-icon name="location-o" size="14" />
      <span>{{ data.address }}</span>
    </div>

    <!-- 交通 -->
    <div class="spot-transport" v-if="data.transportation">
      <van-icon name="logistics" size="14" />
      <span>{{ data.transportation }}</span>
    </div>

    <!-- 景点介绍 -->
    <div class="spot-desc" v-if="data.description">
      <div class="desc-label">
        <van-icon name="info-o" size="14" />
        <span>景点介绍</span>
      </div>
      <p>{{ data.description }}</p>
    </div>

    <!-- 游玩贴士 -->
    <div class="spot-tips" v-if="data.spotTips">
      <div class="tips-label">
        <van-icon name="bulb-o" size="14" />
        <span>游玩贴士</span>
      </div>
      <p>{{ data.spotTips }}</p>
    </div>

    <!-- 周边美食 -->
    <div class="spot-food" v-if="data.nearbyFood">
      <div class="food-label">
        <van-icon name="shop-o" size="14" />
        <span>周边美食</span>
      </div>
      <p>{{ data.nearbyFood }}</p>
    </div>
  </div>

  <div class="spot-item spot-empty" v-else>
    <van-empty description="暂无安排" :image-size="40" />
  </div>
</template>

<script setup lang="ts">
export interface SpotData {
  spot?: string
  name?: string
  duration?: string
  ticket?: string
  transportation?: string
  description?: string
  openingHours?: string
  address?: string
  spotTips?: string
  nearbyFood?: string
  rating?: string
}

withDefaults(defineProps<{
  data?: SpotData
}>(), {
  data: () => ({})
})

/**
 * 将评分文字转为星级符号
 * 例："4.5/5" → "★★★★★" (填充比例)
 */
function toStars(rating: string): string {
  const match = rating.match(/([\d.]+)/)
  if (!match) return '★★★★★'
  const score = parseFloat(match[1])
  const max = rating.includes('/5') ? 5 : rating.includes('/10') ? 10 : 5
  const ratio = Math.min(score / max, 1)
  const filled = Math.round(ratio * 5)
  return '★'.repeat(filled) + '☆'.repeat(5 - filled)
}
</script>

<style scoped>
.spot-item {
  background: #fff;
  border-radius: var(--radius-md);
  padding: 14px 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.03);
}

.spot-empty {
  background: transparent;
  box-shadow: none;
  border: none;
}

/* ---- 头部 ---- */
.spot-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.spot-name {
  font-size: var(--font-lg);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.spot-rating {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.rating-stars {
  font-size: var(--font-xs);
  color: #f59e0b;
  letter-spacing: 1px;
}

.rating-text {
  font-size: var(--font-xs);
  color: var(--text-muted);
  font-weight: 500;
}

/* ---- 核心信息行 ---- */
.spot-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  margin-bottom: 8px;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--font-sm);
  color: var(--text-secondary);
  background: #f8fafc;
  padding: 3px 10px;
  border-radius: var(--radius-sm);
}

.meta-item :deep(.van-icon) {
  color: var(--primary);
}

/* ---- 地址 ---- */
.spot-address {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  font-size: var(--font-sm);
  color: var(--text-muted);
  margin-bottom: 6px;
}

.spot-address :deep(.van-icon) {
  color: var(--text-muted);
  margin-top: 2px;
  flex-shrink: 0;
}

/* ---- 交通 ---- */
.spot-transport {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--font-sm);
  color: var(--text-secondary);
  margin-bottom: 12px;
  background: rgba(14, 165, 233, 0.06);
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  border-left: 3px solid var(--primary);
}

.spot-transport :deep(.van-icon) {
  color: var(--primary);
}

/* ---- 景点介绍 ---- */
.spot-desc {
  margin-bottom: 12px;
}

.desc-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--font-sm);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.desc-label :deep(.van-icon) {
  color: var(--primary);
}

.spot-desc p {
  margin: 0;
  font-size: var(--font-sm);
  color: var(--text-secondary);
  line-height: 1.7;
  padding-left: 18px;
}

/* ---- 游玩贴士 ---- */
.spot-tips {
  margin-bottom: 12px;
  background: #fffbeb;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border-left: 3px solid var(--warning);
}

.tips-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--font-sm);
  font-weight: 600;
  color: #b45309;
  margin-bottom: 4px;
}

.tips-label :deep(.van-icon) {
  color: var(--warning);
}

.spot-tips p {
  margin: 0;
  font-size: var(--font-sm);
  color: #92400e;
  line-height: 1.7;
  padding-left: 18px;
}

/* ---- 周边美食 ---- */
.spot-food {
  margin-bottom: 8px;
  background: #fff7ed;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border-left: 3px solid var(--accent);
}

.food-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--font-sm);
  font-weight: 600;
  color: #c2410c;
  margin-bottom: 4px;
}

.food-label :deep(.van-icon) {
  color: var(--accent);
}

.spot-food p {
  margin: 0;
  font-size: var(--font-sm);
  color: #9a3412;
  line-height: 1.7;
  padding-left: 18px;
}
</style>
