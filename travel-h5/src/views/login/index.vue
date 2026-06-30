<template>
  <div class="auth-page">
    <!-- 装饰背景 -->
    <div class="bg-decoration">
      <div class="bg-circle circle-1"></div>
      <div class="bg-circle circle-2"></div>
      <div class="bg-circle circle-3"></div>
    </div>

    <!-- 头部品牌区 -->
    <div class="brand-header">
      <div class="brand-icon">
        <span class="icon-emoji">✈️</span>
      </div>
      <h1 class="brand-title">旅行助手</h1>
      <p class="brand-desc">AI 智能旅行规划，让每一次出发都从容不迫</p>
    </div>

    <!-- 认证卡片 -->
    <div class="auth-card">
      <!-- Tab 切换 -->
      <div class="tab-row">
        <div
          class="tab-item"
          :class="{ active: activeTab === 'login' }"
          @click="activeTab = 'login'"
        >
          登录
        </div>
        <div
          class="tab-item"
          :class="{ active: activeTab === 'register' }"
          @click="activeTab = 'register'"
        >
          注册
        </div>
        <div class="tab-indicator" :class="{ right: activeTab === 'register' }"></div>
      </div>

      <!-- ========== 登录表单 ========== -->
      <van-form v-if="activeTab === 'login'" @submit="onLogin">
        <div class="form-body">
          <div class="input-group">
            <van-icon name="user-o" class="input-icon" size="18" />
            <input
              v-model="loginForm.username"
              class="form-input"
              type="text"
              placeholder="请输入用户名"
              maxlength="20"
              autocomplete="username"
            />
          </div>

          <div class="input-group">
            <van-icon name="lock" class="input-icon" size="18" />
            <input
              v-model="loginForm.password"
              class="form-input"
              :type="loginPwdVisible ? 'text' : 'password'"
              placeholder="请输入密码"
              autocomplete="current-password"
            />
            <van-icon
              :name="loginPwdVisible ? 'eye-o' : 'closed-eye'"
              class="toggle-pwd"
              size="18"
              @click="loginPwdVisible = !loginPwdVisible"
            />
          </div>

          <div class="form-options">
            <van-checkbox v-model="rememberMe" shape="square" icon-size="15px" checked-color="#0EA5E9">
              记住我
            </van-checkbox>
          </div>

          <van-button
            round
            block
            type="primary"
            native-type="submit"
            :loading="loginLoading"
            loading-text="登录中..."
            class="submit-btn"
          >
            登 录
          </van-button>
        </div>
      </van-form>

      <!-- ========== 注册表单 ========== -->
      <van-form v-if="activeTab === 'register'" @submit="onRegister">
        <div class="form-body">
          <div class="input-group">
            <van-icon name="user-o" class="input-icon" size="18" />
            <input
              v-model="registerForm.username"
              class="form-input"
              type="text"
              placeholder="2-20位，中英文/数字/下划线"
              maxlength="20"
              autocomplete="username"
            />
          </div>

          <div class="input-group">
            <van-icon name="lock" class="input-icon" size="18" />
            <input
              v-model="registerForm.password"
              class="form-input"
              :type="regPwdVisible ? 'text' : 'password'"
              placeholder="至少6位，需含字母+数字"
              autocomplete="new-password"
              @input="onPwdInput"
            />
            <van-icon
              :name="regPwdVisible ? 'eye-o' : 'closed-eye'"
              class="toggle-pwd"
              size="18"
              @click="regPwdVisible = !regPwdVisible"
            />
          </div>

          <!-- 密码强度指示器 -->
          <div class="password-strength" v-if="registerForm.password">
            <div class="strength-bar-track">
              <div
                class="strength-bar-fill"
                :style="{ width: strength.percent + '%', background: strength.color }"
              ></div>
            </div>
            <span class="strength-label" :style="{ color: strength.color }">
              {{ strength.label }}
            </span>
          </div>

          <div class="input-group">
            <van-icon name="lock" class="input-icon" size="18" />
            <input
              v-model="registerForm.confirmPassword"
              class="form-input"
              :type="regConfirmVisible ? 'text' : 'password'"
              placeholder="请再次输入密码"
              autocomplete="new-password"
            />
            <van-icon
              :name="regConfirmVisible ? 'eye-o' : 'closed-eye'"
              class="toggle-pwd"
              size="18"
              @click="regConfirmVisible = !regConfirmVisible"
            />
          </div>

          <van-button
            round
            block
            type="primary"
            native-type="submit"
            :loading="registerLoading"
            loading-text="注册中..."
            class="submit-btn"
          >
            注 册
          </van-button>
        </div>
      </van-form>

      <!-- 社交登录 -->
      <div class="social-login">
        <div class="divider"><span>其他登录方式</span></div>
        <div class="social-icons">
          <button class="social-btn wechat" @click="showTip('微信登录功能开发中')">
            <van-icon name="wechat" size="22" />
          </button>
          <button class="social-btn alipay" @click="showTip('支付宝登录功能开发中')">
            <van-icon name="alipay" size="22" />
          </button>
          <button class="social-btn apple" @click="showTip('Apple 登录功能开发中')">
            <van-icon name="apple" size="22" />
          </button>
        </div>
      </div>
    </div>

    <!-- 底部提示 -->
    <p class="footer-hint">
      {{ activeTab === 'login' ? '还没有账号？' : '已有账号？' }}
      <span class="switch-link" @click="activeTab = activeTab === 'login' ? 'register' : 'login'">
        {{ activeTab === 'login' ? '立即注册' : '去登录' }}
      </span>
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { showToast } from 'vant'
import { useUserStore } from '../../store/user'
import { authPost } from '../../utils/request'
import { usePasswordStrength } from '../../composables/usePasswordStrength'
import type { User } from '@shared/types'

// ------ 常量 ------
const USERNAME_RE = /^[一-龥a-zA-Z0-9_]{2,20}$/
const PWD_RE = /^(?=.*[a-zA-Z])(?=.*\d).{6,}$/

// ------ 依赖 ------
const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

if (userStore.isAuthenticated) {
  router.replace('/')
}

// ------ Tab 状态 ------
const activeTab = ref<string>('login')

// ------ 密码强度 ------
const { password: pwdRef, strength } = usePasswordStrength()
function onPwdInput(e: Event) {
  pwdRef.value = (e.target as HTMLInputElement).value
}

// ------ 登录表单 ------
const loginForm = reactive({ username: '', password: '' })
const loginLoading = ref<boolean>(false)
const loginPwdVisible = ref<boolean>(false)
const rememberMe = ref<boolean>(true)

// ------ 注册表单 ------
const registerForm = reactive({ username: '', password: '', confirmPassword: '' })
const registerLoading = ref<boolean>(false)
const regPwdVisible = ref<boolean>(false)
const regConfirmVisible = ref<boolean>(false)

// ------ Toast ------
function showTip(msg: string, pos: 'top' | 'middle' | 'bottom' = 'top'): void {
  showToast({ message: msg, position: pos })
}

// ------ 登录 ------
const onLogin = async (): Promise<void> => {
  const u = loginForm.username.trim()
  const p = loginForm.password

  if (!u || !p) {
    showTip('用户名和密码不能为空')
    return
  }

  loginLoading.value = true
  try {
    const res = await authPost<{ data: { token: string; user: User } }>('/login', {
      username: u,
      password: p
    })

    const { token, user } = res.data
    userStore.loginSuccess({ token, user })
    showTip('登录成功', 'top')

    const redirect = (route.query.redirect as string) || '/'
    setTimeout(() => router.replace(redirect), 300)
  } catch (error) {
    const msg =
      (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
      '登录失败，请检查网络连接'
    showTip(msg)
  } finally {
    loginLoading.value = false
  }
}

// ------ 注册 ------
const onRegister = async (): Promise<void> => {
  const u = registerForm.username.trim()
  const p = registerForm.password
  const c = registerForm.confirmPassword

  if (!u || !p || !c) {
    showTip('请填写完整信息')
    return
  }
  if (!USERNAME_RE.test(u)) {
    showTip('用户名需2-20位，仅支持中英文、数字、下划线')
    return
  }
  if (!PWD_RE.test(p)) {
    showTip('密码至少6位且必须同时包含字母和数字')
    return
  }
  if (p !== c) {
    showTip('两次输入的密码不一致')
    return
  }

  registerLoading.value = true
  try {
    const res = await authPost<{ data: { token: string; user: User } }>('/register', {
      username: u,
      password: p,
      confirmPassword: c
    })

    const { token, user } = res.data
    userStore.loginSuccess({ token, user })
    showTip('注册成功，正在跳转...', 'top')

    const redirect = (route.query.redirect as string) || '/'
    setTimeout(() => router.replace(redirect), 300)
  } catch (error) {
    const msg =
      (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
      '注册失败，请检查网络连接'
    showTip(msg)
  } finally {
    registerLoading.value = false
  }
}

onMounted(() => {
  const tab = route.query.tab as string
  if (tab === 'register') {
    activeTab.value = 'register'
  }
})
</script>

<style scoped>
/* ===== 页面容器 ===== */
.auth-page {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100vh;
  min-height: 100dvh;
  padding: 0 28px;
  padding-top: 60px;
  padding-bottom: 40px;
  box-sizing: border-box;
  background: linear-gradient(160deg, #f0f9ff 0%, #f8fafc 40%, #f5f7fa 100%);
  overflow: hidden;
}

/* ===== 装饰背景圆 ===== */
.bg-decoration {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  pointer-events: none;
  overflow: hidden;
}

.bg-circle {
  position: absolute;
  border-radius: 50%;
  opacity: 0.08;
}

.circle-1 { width: 320px; height: 320px; background: #0EA5E9; top: -120px; right: -100px; }
.circle-2 { width: 200px; height: 200px; background: #38BDF8; bottom: 180px; left: -80px; }
.circle-3 { width: 140px; height: 140px; background: #EA580C; top: 40%; right: -50px; }

/* ===== 头部品牌区 ===== */
.brand-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 32px;
  z-index: 1;
}

.brand-icon {
  width: 72px;
  height: 72px;
  border-radius: 20px;
  background: var(--gradient-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  box-shadow: 0 8px 24px rgba(14, 165, 233, 0.25);
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

.icon-emoji {
  font-size: 36px;
  line-height: 1;
}

.brand-title {
  font-size: 26px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 6px;
  letter-spacing: 1px;
}

.brand-desc {
  font-size: var(--font-sm);
  color: var(--text-muted);
  margin: 0;
  letter-spacing: 0.5px;
}

/* ===== 认证卡片 ===== */
.auth-card {
  width: 100%;
  max-width: 380px;
  background: #fff;
  border-radius: 20px;
  padding: 28px 24px 24px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04);
  z-index: 1;
}

/* ===== Tab 切换 ===== */
.tab-row {
  display: flex;
  position: relative;
  margin-bottom: 28px;
  background: #f1f5f9;
  border-radius: 10px;
  padding: 4px;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 10px 0;
  font-size: var(--font-md);
  font-weight: 500;
  color: var(--text-muted);
  border-radius: 8px;
  cursor: pointer;
  z-index: 1;
  transition: color 0.25s ease;
  user-select: none;
}

.tab-item.active {
  color: #fff;
}

.tab-indicator {
  position: absolute;
  top: 4px; left: 4px;
  width: calc(50% - 4px);
  height: calc(100% - 8px);
  background: var(--gradient-primary);
  border-radius: 8px;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(14, 165, 233, 0.3);
}

.tab-indicator.right {
  transform: translateX(100%);
}

/* ===== 表单主体 ===== */
.form-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* ===== 输入组 ===== */
.input-group {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  height: 50px;
  background: #f8fafc;
  border-radius: 14px;
  border: 1.5px solid transparent;
  transition: border-color 0.25s, background 0.25s, box-shadow 0.25s;
}

.input-group:focus-within {
  background: #fff;
  border-color: #0EA5E9;
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.08);
}

.input-icon {
  color: #c0c4cc;
  flex-shrink: 0;
  transition: color 0.25s;
}

.input-group:focus-within .input-icon {
  color: #0EA5E9;
}

.form-input {
  flex: 1;
  height: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-size: var(--font-md);
  color: var(--text-primary);
}

.form-input::placeholder {
  color: #cbd5e1;
  font-size: var(--font-sm);
}

.toggle-pwd {
  color: #c0c4cc;
  flex-shrink: 0;
  cursor: pointer;
  transition: color 0.2s;
}

.toggle-pwd:hover {
  color: #0EA5E9;
}

/* ===== 密码强度 ===== */
.password-strength {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 4px;
}

.strength-bar-track {
  flex: 1;
  height: 4px;
  background: #e2e8f0;
  border-radius: 2px;
  overflow: hidden;
}

.strength-bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease, background 0.3s ease;
}

.strength-label {
  font-size: var(--font-xs);
  font-weight: 600;
  white-space: nowrap;
}

/* ===== 选项行 ===== */
.form-options {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 4px;
}

/* ===== 提交按钮 ===== */
.submit-btn {
  margin-top: 6px;
  height: 48px;
  font-size: var(--font-md);
  font-weight: 600;
  letter-spacing: 2px;
  border: none;
  background: var(--gradient-primary) !important;
  box-shadow: 0 6px 18px rgba(14, 165, 233, 0.3);
  transition: transform 0.2s, box-shadow 0.2s;
}

.submit-btn:active {
  transform: scale(0.98);
  box-shadow: 0 3px 10px rgba(14, 165, 233, 0.2);
}

/* ===== 社交登录 ===== */
.social-login {
  margin-top: 28px;
}

.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #e2e8f0;
}

.divider span {
  font-size: var(--font-xs);
  color: var(--text-muted);
  white-space: nowrap;
}

.social-icons {
  display: flex;
  justify-content: center;
  gap: 24px;
}

.social-btn {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 1.5px solid #e2e8f0;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  touch-action: manipulation;
}

.social-btn:active {
  transform: scale(0.9);
}

.social-btn.wechat { color: #07c160; }
.social-btn.wechat:hover { background: #f0fff4; border-color: #07c160; }

.social-btn.alipay { color: #1677ff; }
.social-btn.alipay:hover { background: #f0f7ff; border-color: #1677ff; }

.social-btn.apple { color: #000; }
.social-btn.apple:hover { background: #f5f5f5; border-color: #000; }

/* ===== 底部提示 ===== */
.footer-hint {
  margin-top: 28px;
  font-size: var(--font-sm);
  color: var(--text-muted);
  z-index: 1;
}

.switch-link {
  color: #0EA5E9;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.switch-link:active {
  opacity: 0.7;
}

/* ===== 过渡动画 ===== */
.brand-header,
.auth-card,
.footer-hint {
  animation: fadeInUp 0.5s ease both;
}

.brand-header { animation-delay: 0s; }
.auth-card { animation-delay: 0.1s; }
.footer-hint { animation-delay: 0.2s; }

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .brand-icon { animation: none; }
  .brand-header, .auth-card, .footer-hint { animation: none; }
}
</style>
