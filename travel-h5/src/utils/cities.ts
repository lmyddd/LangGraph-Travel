/**
 * 城市数据 —— 统一管理所有城市信息
 */

export interface CityInfo {
  name: string
  emoji: string
  tagline: string
  gradient: string
  keywords: string[]
}

/** 热门目的地（首页展示） */
export const POPULAR_CITIES: CityInfo[] = [
  {
    name: '北京',
    emoji: '🏯',
    tagline: '千年古都',
    gradient: 'linear-gradient(135deg, #dc2626 0%, #f87171 100%)',
    keywords: ['北京', 'beijing', '首都', '故宫', '长城']
  },
  {
    name: '上海',
    emoji: '🏙️',
    tagline: '魔都风情',
    gradient: 'linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)',
    keywords: ['上海', 'shanghai', '魔都', '外滩', '迪士尼']
  },
  {
    name: '成都',
    emoji: '🐼',
    tagline: '天府之国',
    gradient: 'linear-gradient(135deg, #059669 0%, #34d399 100%)',
    keywords: ['成都', 'chengdu', '熊猫', '火锅', '美食']
  },
  {
    name: '杭州',
    emoji: '🛶',
    tagline: '人间天堂',
    gradient: 'linear-gradient(135deg, #0891b2 0%, #22d3ee 100%)',
    keywords: ['杭州', 'hangzhou', '西湖', '江南']
  },
  {
    name: '西安',
    emoji: '🏛️',
    tagline: '历史名都',
    gradient: 'linear-gradient(135deg, #d97706 0%, #fbbf24 100%)',
    keywords: ['西安', 'xian', '兵马俑', '古城', '历史']
  },
  {
    name: '重庆',
    emoji: '🌶️',
    tagline: '山城雾都',
    gradient: 'linear-gradient(135deg, #dc2626 0%, #f97316 100%)',
    keywords: ['重庆', 'chongqing', '山城', '火锅', '洪崖洞']
  },
  {
    name: '广州',
    emoji: '🍵',
    tagline: '美食之都',
    gradient: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
    keywords: ['广州', 'guangzhou', '美食', '早茶', '珠江']
  },
  {
    name: '深圳',
    emoji: '🚀',
    tagline: '创新之城',
    gradient: 'linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)',
    keywords: ['深圳', 'shenzhen', '科技', '创新', '海边']
  }
]

/** 更多可搜索城市 */
export const MORE_CITIES: CityInfo[] = [
  {
    name: '南京',
    emoji: '🏛️',
    tagline: '六朝古都',
    gradient: 'linear-gradient(135deg, #b45309 0%, #d97706 100%)',
    keywords: ['南京', 'nanjing', '古都']
  },
  {
    name: '武汉',
    emoji: '🌸',
    tagline: '江城樱花',
    gradient: 'linear-gradient(135deg, #db2777 0%, #f472b6 100%)',
    keywords: ['武汉', 'wuhan', '樱花', '热干面']
  },
  {
    name: '厦门',
    emoji: '🌊',
    tagline: '海上花园',
    gradient: 'linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)',
    keywords: ['厦门', 'xiamen', '鼓浪屿', '海边']
  },
  {
    name: '长沙',
    emoji: '🎆',
    tagline: '星城之夜',
    gradient: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
    keywords: ['长沙', 'changsha', '橘子洲', '美食']
  },
  {
    name: '大理',
    emoji: '🏔️',
    tagline: '风花雪月',
    gradient: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
    keywords: ['大理', 'dali', '洱海', '苍山', '云南']
  },
  {
    name: '苏州',
    emoji: '🌿',
    tagline: '园林之城',
    gradient: 'linear-gradient(135deg, #047857 0%, #34d399 100%)',
    keywords: ['苏州', 'suzhou', '园林', '江南', '水乡']
  },
  {
    name: '三亚',
    emoji: '🏖️',
    tagline: '热带天堂',
    gradient: 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)',
    keywords: ['三亚', 'sanya', '海滩', '度假']
  },
  {
    name: '青岛',
    emoji: '🍺',
    tagline: '啤酒之都',
    gradient: 'linear-gradient(135deg, #0e7490 0%, #06b6d4 100%)',
    keywords: ['青岛', 'qingdao', '啤酒', '海边', '崂山']
  }
]

/** 全部城市（搜索用） */
export const ALL_CITIES: CityInfo[] = [...POPULAR_CITIES, ...MORE_CITIES]

/**
 * 根据输入搜索城市（按名称或关键词匹配）
 */
export function searchCities(query: string): CityInfo[] {
  if (!query.trim()) return POPULAR_CITIES
  const q = query.trim().toLowerCase()
  return ALL_CITIES.filter((c) =>
    c.keywords.some((k) => k.toLowerCase().includes(q))
  )
}

/**
 * 根据城市名获取城市信息
 */
export function getCityInfo(name: string): CityInfo | undefined {
  return ALL_CITIES.find((c) => c.name === name)
}
