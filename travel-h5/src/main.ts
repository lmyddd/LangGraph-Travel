import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './style/common.css'
import { createPinia } from 'pinia'
import { createPersistedState } from 'pinia-plugin-persistedstate'

const pinia = createPinia()
pinia.use(createPersistedState())

// 保存原始方法
const originalReplaceState = window.history.replaceState
const originalPushState = window.history.pushState

// 拦截 replaceState
window.history.replaceState = function (...args: Parameters<typeof window.history.replaceState>): void {
  if (document.visibilityState === 'hidden') {
    return // 页面隐藏时拦截调用
  }
  return originalReplaceState.apply(this, args)
}

// 拦截 pushState
window.history.pushState = function (...args: Parameters<typeof window.history.pushState>): void {
  if (document.visibilityState === 'hidden') {
    return // 页面隐藏时拦截调用
  }
  return originalPushState.apply(this, args)
}

const app = createApp(App)
app.use(router)
app.use(pinia)
app.mount('#app')
