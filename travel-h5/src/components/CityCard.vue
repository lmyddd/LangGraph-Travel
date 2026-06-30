<template>
  <div
    class="city-card"
    :class="{ active }"
    :style="{ background: gradient }"
    @click="$emit('select', city)"
  >
    <span class="city-card-emoji">{{ emoji }}</span>
    <span class="city-card-name">{{ city }}</span>
    <span class="city-card-tagline">{{ tagline }}</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  city: string
  emoji: string
  tagline: string
  gradient: string
  active?: boolean
}>()

defineEmits<{
  select: [city: string]
}>()
</script>

<style scoped>
.city-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 83px;
  min-height: 83px;
  padding: 16px 10px 12px;
  border-radius: var(--radius-lg);
  color: #fff;
  cursor: pointer;
  user-select: none;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  border: 2px solid transparent;
  position: relative;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.city-card::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0);
  transition: background 0.25s ease;
  border-radius: inherit;
}

.city-card:active {
  transform: scale(0.95);
}

.city-card.active {
  border-color: #fff;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.18);
  transform: translateY(-2px);
}

.city-card.active::after {
  background: rgba(255, 255, 255, 0.12);
}

.city-card-emoji {
  font-size: 28px;
  line-height: 1;
  margin-bottom: 6px;
  position: relative;
  z-index: 1;
}

.city-card-name {
  font-size: var(--font-md);
  font-weight: 700;
  letter-spacing: 0.5px;
  position: relative;
  z-index: 1;
}

.city-card-tagline {
  font-size: var(--font-xs);
  opacity: 0.85;
  margin-top: 2px;
  position: relative;
  z-index: 1;
}
</style>
