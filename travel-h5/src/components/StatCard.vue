<template>
  <div class="stat-card" :style="{ background: bgGradient }">
    <div class="stat-icon-wrapper">
      <van-icon :name="icon" size="18" :color="color" />
    </div>
    <span class="stat-value">{{ value }}</span>
    <span class="stat-label">{{ label }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  icon: string
  value: string | number
  label: string
  color: string
  gradient: string
}>()

const bgGradient = computed(() => props.gradient)
</script>

<style scoped>
.stat-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 18px 8px 14px;
  border-radius: var(--radius-lg);
  color: #fff;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.stat-icon-wrapper {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}

.stat-value {
  font-size: var(--font-xxl);
  font-weight: 800;
  letter-spacing: 0.5px;
  line-height: 1;
  margin-bottom: 4px;
}

.stat-label {
  font-size: var(--font-xs);
  opacity: 0.85;
  font-weight: 500;
}
</style>
