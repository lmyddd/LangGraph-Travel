/**
 * 收藏夹 Pinia Store
 * 纯前端实现，使用 localStorage 持久化
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useFavoritesStore = defineStore('favorites', () => {
  // 收藏的行程 ID 列表
  const favoriteIds = ref<number[]>([])

  // 从 localStorage 恢复
  const stored = localStorage.getItem('travel_favorites')
  if (stored) {
    try {
      favoriteIds.value = JSON.parse(stored)
    } catch {
      favoriteIds.value = []
    }
  }

  function persist() {
    localStorage.setItem('travel_favorites', JSON.stringify(favoriteIds.value))
  }

  const count = computed(() => favoriteIds.value.length)

  function isFavorited(id: number): boolean {
    return favoriteIds.value.includes(id)
  }

  function toggle(id: number): boolean {
    const idx = favoriteIds.value.indexOf(id)
    if (idx >= 0) {
      favoriteIds.value.splice(idx, 1)
      persist()
      return false
    } else {
      favoriteIds.value.push(id)
      persist()
      return true
    }
  }

  function remove(id: number) {
    favoriteIds.value = favoriteIds.value.filter((fid) => fid !== id)
    persist()
  }

  function getAll(): number[] {
    return [...favoriteIds.value]
  }

  return { favoriteIds, count, isFavorited, toggle, remove, getAll }
})
