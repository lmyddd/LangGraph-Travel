<template>
  <div class="budget-table">
    <!-- 分类明细 -->
    <div class="budget-items">
      <div
        v-for="item in budgetItems"
        :key="item.key"
        class="budget-row"
      >
        <div class="budget-row-header">
          <span class="budget-icon">{{ item.icon }}</span>
          <span class="budget-label">{{ item.label }}</span>
          <span class="budget-value">¥{{ item.value }}</span>
        </div>
        <div class="budget-bar-track">
          <div
            class="budget-bar-fill"
            :style="{
              width: maxValue > 0 ? (item.value / maxValue * 100) + '%' : '0%',
              background: item.color
            }"
          ></div>
        </div>
      </div>
    </div>

    <!-- 总计 -->
    <div class="budget-total">
      <span class="total-label">总计</span>
      <span class="total-amount">¥{{ total }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface BudgetData {
  accommodation?: number
  food?: number
  transportation?: number
  tickets?: number
  other?: number
}

const props = withDefaults(defineProps<{
  data?: BudgetData
  total?: number | string
}>(), {
  data: () => ({}),
  total: 0
})

interface BudgetItem {
  key: string
  label: string
  icon: string
  value: number
  color: string
}

const budgetItems = computed<BudgetItem[]>(() => {
  const items: BudgetItem[] = [
    { key: 'accommodation', label: '住宿', icon: '🏨', value: props.data?.accommodation || 0, color: 'linear-gradient(90deg, #0EA5E9, #38BDF8)' },
    { key: 'food', label: '餐饮', icon: '🍜', value: props.data?.food || 0, color: 'linear-gradient(90deg, #EA580C, #F97316)' },
    { key: 'transportation', label: '交通', icon: '🚗', value: props.data?.transportation || 0, color: 'linear-gradient(90deg, #8B5CF6, #A78BFA)' },
    { key: 'tickets', label: '门票', icon: '🎫', value: props.data?.tickets || 0, color: 'linear-gradient(90deg, #EC4899, #F472B6)' },
    { key: 'other', label: '其他', icon: '📦', value: props.data?.other || 0, color: 'linear-gradient(90deg, #64748B, #94A3B8)' }
  ]
  // 只显示有值的项
  return items.filter(i => i.value > 0)
})

const maxValue = computed(() => {
  if (budgetItems.value.length === 0) return 1
  return Math.max(...budgetItems.value.map(i => i.value))
})
</script>

<style scoped>
.budget-table {
  margin-top: 8px;
}

.budget-items {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.budget-row-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.budget-icon {
  font-size: 16px;
  line-height: 1;
}

.budget-label {
  flex: 1;
  font-size: var(--font-sm);
  font-weight: 500;
  color: var(--text-secondary);
}

.budget-value {
  font-size: var(--font-sm);
  font-weight: 600;
  color: var(--text-primary);
}

.budget-bar-track {
  height: 6px;
  background: #f1f5f9;
  border-radius: 3px;
  overflow: hidden;
}

.budget-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  min-width: 4px;
}

.budget-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.06) 0%, rgba(234, 88, 12, 0.04) 100%);
  border-radius: var(--radius-sm);
  margin-top: 14px;
  border: 1px solid rgba(14, 165, 233, 0.1);
}

.total-label {
  font-size: var(--font-md);
  font-weight: 600;
  color: var(--text-primary);
}

.total-amount {
  font-size: var(--font-xl);
  font-weight: 700;
  color: var(--danger);
}
</style>
