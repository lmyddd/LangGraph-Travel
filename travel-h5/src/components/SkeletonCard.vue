<template>
  <div class="skeleton-card card" :style="{ height: height + 'px' }">
    <div class="skeleton skeleton-title"></div>
    <div
      v-for="i in lines"
      :key="i"
      class="skeleton skeleton-text"
      :style="{ width: getLineWidth(i) }"
    ></div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  height?: number
  lines?: number
}

const props = withDefaults(defineProps<Props>(), {
  height: 120,
  lines: 3
})

function getLineWidth(index: number): string {
  const widths = ['80%', '60%', '70%', '50%', '75%']
  return widths[(index - 1) % widths.length]
}
</script>

<style scoped>
.skeleton-card {
  margin-bottom: 16px;
  overflow: hidden;
}

.skeleton-title {
  margin-bottom: 12px;
}

.skeleton-text {
  margin-bottom: 8px;
}

.skeleton-text:last-child {
  margin-bottom: 0;
}
</style>
