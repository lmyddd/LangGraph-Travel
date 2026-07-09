<template>
  <div class="page-transition-wrapper">
    <router-view v-slot="{ Component, route: r }">
      <transition name="page-slide" mode="out-in">
        <component :is="Component" :key="r.path" />
      </transition>
    </router-view>
  </div>
</template>

<script setup lang="ts">
// 页面过渡包装器，无需额外逻辑
</script>

<style scoped>
.page-transition-wrapper {
  /* 保证过渡期间容器不会塌陷，消除向下抖动 */
  min-height: calc(100vh - 50px);
  min-height: calc(100dvh - 50px);
}
</style>
