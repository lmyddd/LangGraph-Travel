 // ============================================================
// Open-Meteo 天气工具 — 为 Weather Advisor 提供免费天气预报
// ============================================================

import type { WeatherData, WeatherDay } from '../types.js'

interface GeocodingResult {
  latitude: number
  longitude: number
  name: string
  country: string
}

interface OpenMeteoResponse {
  daily: {
    time: string[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    weathercode: number[]
    precipitation_probability_max: number[]
    windspeed_10m_max: number[]
  }
  hourly?: {
    relativehumidity_2m: number[]
  }
}

// WMO 天气码 → 中文描述
const weatherCodeMap: Record<number, string> = {
  0: '晴', 1: '晴', 2: '多云', 3: '阴',
  45: '雾', 48: '雾凇',
  51: '小雨', 53: '中雨', 55: '大雨',
  61: '小雨', 63: '中雨', 65: '大雨',
  71: '小雪', 73: '中雪', 75: '大雪',
  80: '阵雨', 81: '中阵雨', 82: '大阵雨',
  95: '雷暴', 96: '冰雹雷暴', 99: '强冰雹雷暴',
}

/**
 * 通过城市名获取经纬度（Open-Meteo Geocoding API）。
 * 完全免费，无需 API Key。
 */
async function geocode(city: string): Promise<{ lat: number; lon: number; name: string } | null> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=zh`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = (await res.json()) as { results?: GeocodingResult[] }
    if (!data.results?.length) return null
    const r = data.results[0]
    return { lat: r.latitude, lon: r.longitude, name: r.name }
  } catch {
    return null
  }
}

/**
 * 获取指定城市的天气预报。
 *
 * 使用 Open-Meteo API（完全免费，无需 API Key，无速率限制）
 * 文档：https://open-meteo.com/
 */
export async function getWeatherForecast(
  city: string,
  days: number = 3
): Promise<WeatherData | null> {
  const geo = await geocode(city)
  if (!geo) {
    console.warn(`[Weather] 无法解析城市: ${city}`)
    return null
  }

  try {
    const url = [
      'https://api.open-meteo.com/v1/forecast',
      `?latitude=${geo.lat}`,
      `&longitude=${geo.lon}`,
      `&forecast_days=${Math.min(days, 7)}`,
      '&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_probability_max,windspeed_10m_max',
      '&timezone=auto',
    ].join('')

    const res = await fetch(url)
    if (!res.ok) return null
    const data = (await res.json()) as OpenMeteoResponse

    const daily: WeatherDay[] = data.daily.time.map((date, i) => ({
      date,
      tempMax: data.daily.temperature_2m_max[i],
      tempMin: data.daily.temperature_2m_min[i],
      condition: weatherCodeMap[data.daily.weathercode[i]] || '未知',
      precipitation: data.daily.precipitation_probability_max[i],
    }))

    // 计算平均湿度
    const avgHumidity = data.hourly
      ? Math.round(
          data.hourly.relativehumidity_2m.reduce((a, b) => a + b, 0) /
            data.hourly.relativehumidity_2m.length
        )
      : 0

    return {
      city: geo.name,
      temperature: `${daily[0]?.tempMin ?? 0}°C ~ ${daily[0]?.tempMax ?? 0}°C`,
      condition: daily[0]?.condition ?? '未知',
      humidity: avgHumidity ? `${avgHumidity}%` : '未知',
      windSpeed: `${data.daily.windspeed_10m_max[0] ?? 0} km/h`,
      daily,
    }
  } catch (error) {
    console.warn('[Weather] 获取天气失败:', (error as Error).message)
    return null
  }
}

/**
 * 根据天气数据生成出行建议文本。
 */
export function formatWeatherAdvice(w: WeatherData): string {
  if (!w) return ''

  const lines: string[] = [
    `🌤 **${w.city}天气预报**`,
    `温度：${w.temperature}`,
    `天气：${w.condition}`,
    `湿度：${w.humidity}`,
  ]

  // 降水警告
  if (w.daily.some((d) => d.precipitation > 60)) {
    lines.push('⚠️ 出行期间有较高降水概率，建议携带雨具')
  }
  // 高温警告
  if (w.daily.some((d) => d.tempMax > 35)) {
    lines.push('🌡 注意防暑降温，避免正午户外活动')
  }
  // 低温警告
  if (w.daily.some((d) => d.tempMin < 5)) {
    lines.push('🧥 气温较低，请注意保暖')
  }

  return lines.join('\n')
}
