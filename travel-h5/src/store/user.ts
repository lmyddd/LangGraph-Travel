import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, AuthPayload } from '@shared/types'

export type { User }

export const useUserStore = defineStore(
  'user',
  () => {
    const token = ref<string>('')
    const user = ref<User | null>(null)

    /** 是否已认证 */
    const isAuthenticated = computed<boolean>(() => !!token.value)

    /** 登录/注册成功后保存信息 */
    const loginSuccess = (data: AuthPayload): void => {
      token.value = data.token
      user.value = data.user
    }

    /** 更新用户信息（昵称、头像等） */
    const updateUser = (partial: Partial<User>): void => {
      if (user.value) {
        user.value = { ...user.value, ...partial }
      }
    }

    /** 更新头像 */
    const updateAvatar = (avatarUrl: string): void => {
      if (user.value) {
        user.value.avatar = avatarUrl
      }
    }

    /** 更新昵称 */
    const updateNickname = (nickname: string): void => {
      if (user.value) {
        user.value.nickname = nickname
      }
    }

    /** 退出登录 */
    const logout = (): void => {
      token.value = ''
      user.value = null
    }

    return {
      token,
      user,
      isAuthenticated,
      loginSuccess,
      updateUser,
      logout,
      updateAvatar,
      updateNickname
    }
  },
  {
    persist: true
  }
)
