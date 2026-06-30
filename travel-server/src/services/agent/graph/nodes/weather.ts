// ============================================================
// weatherNode — 查询目的地天气预报，生成出行建议
//
// 包装现有的 Open-Meteo 天气工具（免费，无需 API Key）。
// 结果写入 state.weather 和 state.weatherTips。
// 查询失败时返回 null，不阻塞图执行。
// ============================================================

import { getWeatherForecast } from '../../tools/weather.js'
import type { WeatherData } from '../../types.js'
import type { State } from '../state.js'

/**
 * 获取目的地天气预报并生成出行建议。
 *
 * 使用 Open-Meteo 免费 API（无需 API Key），
 * 根据温度、降水等数据自动生成出行提示。
 */
export async function weatherNode(state: State): Promise<Partial<State>> {
  const { city, days, onEvent } = state

  onEvent({
    type: 'agent_start',
    agent: 'weather',
    message: `🌤 正在查询「${city}」未来${days}天天气...`,
  })

  try {
    const weather: WeatherData | null = await getWeatherForecast(city, days)

    if (!weather) {
      onEvent({
        type: 'agent_complete',
        agent: 'weather',
        summary: `无法获取「${city}」的天气数据，Planner 将不考虑天气因素`,
      })
      return { weather: null, weatherTips: [] }
    }

    // 根据天气数据生成具体建议（含城市名，避免"所有城市同一句话"）
    const tips: string[] = []

    if (weather.daily.some((d) => d.precipitation > 60)) {
      tips.push(`${city}出行期间有雨，请携带雨具，优先安排室内景点`)
    }
    if (weather.daily.some((d) => d.tempMax > 35)) {
      tips.push(`${city}天气炎热（最高${Math.max(...weather.daily.map(d => d.tempMax))}°C），建议避开正午户外活动，多安排室内或傍晚行程`)
    }
    if (weather.daily.some((d) => d.tempMin < 5)) {
      tips.push(`${city}气温偏低（最低${Math.min(...weather.daily.map(d => d.tempMin))}°C），注意保暖，户外活动需适当减少`)
    }
    if (
      weather.daily.every(
        (d) => d.precipitation < 30 && d.tempMax < 30 && d.tempMin > 10
      )
    ) {
      tips.push(`${city}天气宜人（${Math.round(weather.daily.reduce((s, d) => s + (d.tempMax + d.tempMin) / 2, 0) / weather.daily.length)}°C左右），非常适合户外活动和景点游览`)
    }

    const advice = formatWeatherAdvicePlain(weather)

    onEvent({
      type: 'agent_progress',
      agent: 'weather',
      detail: `${weather.condition}，${weather.temperature}`,
    })

    onEvent({
      type: 'agent_complete',
      agent: 'weather',
      summary: advice,
    })

    // weatherTips 给 Planner prompt 做参考，tips 直接流向用户展示
    return { weather, weatherTips: tips, tips }
  } catch (error) {
    const msg = (error as Error).message || '未知错误'
    console.error('[weatherNode] 天气查询失败:', msg)
    onEvent({
      type: 'agent_error',
      agent: 'weather',
      error: msg,
    })
    // 非致命：天气信息缺失不影响基本规划
    return { weather: null, weatherTips: [] }
  }
}

// ---- 工具函数 ----

/** 将天气数据转为自然语言摘要（不含 markdown 标记） */
function formatWeatherAdvicePlain(w: WeatherData): string {
  const lines: string[] = [
    `${w.city}天气：${w.condition}，温度${w.temperature}，湿度${w.humidity}`,
  ]

  if (w.daily.some((d) => d.precipitation > 60)) {
    lines.push('出行期间有较高降水概率，建议携带雨具')
  }
  if (w.daily.some((d) => d.tempMax > 35)) {
    lines.push('气温较高，注意防暑降温，避免正午户外活动')
  }
  if (w.daily.some((d) => d.tempMin < 5)) {
    lines.push('气温偏低，请注意保暖')
  }
  if (w.daily.every((d) => d.precipitation < 30 && d.tempMax < 30 && d.tempMin > 10)) {
    lines.push('天气宜人，非常适合户外活动和景点游览')
  }

  return lines.join('；')
}
