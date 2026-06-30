import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useUserStore } from '../store/user'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/home/index.vue'),
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/login/index.vue'),
  },
  {
    path: '/chat',
    name: 'chat',
    component: () => import('../views/chat/index.vue'),
  },
  {
    path: '/profile',
    name: 'profile',
    component: () => import('../views/profile/index.vue'),
  },
  {
    path: '/detail',
    name: 'detail',
    component: () => import('../views/detail/index.vue'),
  },
  {
    path: '/history',
    name: 'history',
    component: () => import('../views/history/index.vue'),
  },
  {
    path: '/trip/:id',
    name: 'trip-detail',
    component: () => import('../views/trip-detail/index.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

/** 检测 token 是否过期（客户端简单判断） */
function isTokenExpired(token: string): boolean {
  if (!token) return true
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp * 1000 < Date.now()
  } catch {
    return true
  }
}

router.beforeEach((to) => {
  const userStore = useUserStore()

  // 如果 token 过期则清除状态
  if (userStore.token && isTokenExpired(userStore.token)) {
    userStore.logout()
  }

  // 已登录用户访问 /login → 跳转到首页
  if (to.name === 'login' && userStore.isAuthenticated) {
    return { name: 'home' }
  }

  // 未登录用户访问非登录页 → 跳转到登录页并保留目标路径
  if (to.name !== 'login' && !userStore.isAuthenticated) {
    return {
      name: 'login',
      query: { redirect: to.fullPath }
    }
  }

  return true
})

export default router
