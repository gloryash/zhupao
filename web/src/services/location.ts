import type { SelectedLocation } from '../types/location'
import { isValidLatLng } from '../types/location'

/** Browser geolocation, wrapped as a promise with a friendly Chinese error. */
export function getCurrentPosition(timeoutMs = 10_000): Promise<SelectedLocation> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('当前浏览器不支持定位'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        resolve({
          latitude: round6(latitude),
          longitude: round6(longitude),
          address: '',
          source: 'geolocation'
        })
      },
      (err) => {
        const messages: Record<number, string> = {
          1: '定位权限被拒绝，请手动选择位置',
          2: '暂时无法获取位置，请手动选择',
          3: '定位超时，请手动选择位置'
        }
        reject(new Error(messages[err.code] || '定位失败，请手动选择位置'))
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 }
    )
  })
}

/** Best-effort reverse geocode via OpenStreetMap Nominatim (no API key). */
export async function reverseGeocode(latitude: number, longitude: number): Promise<string> {
  if (!isValidLatLng(latitude, longitude)) return ''
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=zh-CN&zoom=18`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return ''
    const data = (await res.json()) as { display_name?: string }
    return data.display_name || ''
  } catch {
    return ''
  }
}

export function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6
}

export function formatLatLng(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}
