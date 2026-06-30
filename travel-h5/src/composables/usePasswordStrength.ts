/**
 * 密码强度评估 composable
 */

import { ref, computed } from 'vue'

export interface PasswordStrength {
  score: number    // 0-4
  label: string    // 弱 / 一般 / 中 / 强 / 很强
  color: string    // CSS 颜色
  percent: number  // 进度条百分比 0-100
}

const LABELS = ['', '弱', '一般', '中', '强', '很强']
const COLORS = ['', '#ee0a24', '#f97316', '#f59e0b', '#0EA5E9', '#07c160']

export function usePasswordStrength() {
  const password = ref('')

  const strength = computed<PasswordStrength>(() => {
    const pwd = password.value
    let score = 0

    if (pwd.length >= 8) score++
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++
    if (/\d/.test(pwd)) score++
    if (/[^a-zA-Z0-9]/.test(pwd)) score++

    // 长度不足时封顶
    const finalScore = pwd.length < 6 ? 0 : Math.min(score, 4)

    return {
      score: finalScore,
      label: LABELS[finalScore],
      color: COLORS[finalScore],
      percent: finalScore > 0 ? (finalScore / 4) * 100 : 10
    }
  })

  const isStrong = computed(() => strength.value.score >= 3)

  return { password, strength, isStrong }
}
