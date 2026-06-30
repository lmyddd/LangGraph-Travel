<template>
  <router-view v-slot="{ Component, route: r }">
    <transition name="page-slide" mode="out-in">
      <component :is="Component" :key="r.path" />
    </transition>
  </router-view>
</template>

<script setup lang="ts">
// 页面过渡包装器，无需额外逻辑
</script>
