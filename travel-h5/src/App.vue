<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import PageTransition from './components/PageTransition.vue'

const route = useRoute()
const active = ref<number>(0)

// 根据路由名称自动切换 tab 高亮
watch(() => route.name, (name) => {
  if (name === 'home') active.value = 0
  else if (name === 'chat') active.value = 1
  else if (name === 'profile') active.value = 2
}, { immediate: true })
</script>

<template>
  <div class="app-container">
    <PageTransition />
    <van-tabbar
      v-if="route.name && ['home', 'chat', 'profile'].includes(route.name as string)"
      route
      v-model="active"
      :border="false"
      :fixed="true"
      :safe-area-inset-bottom="true"
      active-color="#0EA5E9"
      inactive-color="#94A3B8"
      class="custom-tabbar"
    >
      <van-tabbar-item to="/" icon="home-o">
        <template #icon="props">
          <span class="tab-icon-wrapper" :class="{ active: props.active }">
            <van-icon name="home-o" size="22" />
          </span>
        </template>
        首页
      </van-tabbar-item>
      <van-tabbar-item to="/chat" icon="chat-o">
        <template #icon="props">
          <span class="tab-icon-wrapper" :class="{ active: props.active }">
            <van-icon name="chat-o" size="22" />
          </span>
        </template>
        对话
      </van-tabbar-item>
      <van-tabbar-item to="/profile" icon="user-o">
        <template #icon="props">
          <span class="tab-icon-wrapper" :class="{ active: props.active }">
            <van-icon name="user-o" size="22" />
          </span>
        </template>
        我的
      </van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<style>
/* 全局样式 */
.app-container {
  --van-tabbar-height: 50px;
}

/* ========== 自定义 Tabbar 样式 ========== */
.custom-tabbar {
  background: #fff !important;
  box-shadow: 0 -2px 20px rgba(0, 0, 0, 0.06) !important;
  border-top: 1px solid rgba(0, 0, 0, 0.04) !important;
  height: 50px !important;
}

.custom-tabbar .van-tabbar-item {
  font-size: 11px;
  font-weight: 500;
  transition: all 0.3s ease;
}

.custom-tabbar .van-tabbar-item--active {
  font-weight: 600;
}

.tab-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 28px;
  border-radius: 14px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

.tab-icon-wrapper.active {
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.15) 0%, rgba(56, 189, 248, 0.15) 100%);
  transform: scale(1.05);
}
</style>
