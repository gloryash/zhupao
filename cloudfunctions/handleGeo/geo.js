const https = require('https')

const AMAP_BASE = 'https://restapi.amap.com'

function round6(value) {
  return Math.round(Number(value) * 1e6) / 1e6
}

function isValidLatLng(latitude, longitude) {
  return Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
}

function normalizeText(value) {
  if (Array.isArray(value)) return ''
  return String(value || '').trim()
}

function normalizeCity(city, province) {
  const cityText = normalizeText(city)
  if (cityText) return cityText
  const provinceText = normalizeText(province)
  return provinceText.endsWith('市') ? provinceText : ''
}

function parseLocation(location) {
  const [longitude, latitude] = String(location || '').split(',').map(Number)
  if (!isValidLatLng(latitude, longitude)) return null
  return { latitude: round6(latitude), longitude: round6(longitude) }
}

function joinAddress(parts) {
  const normalized = []
  for (const part of parts.map(normalizeText).filter(Boolean)) {
    if (normalized[normalized.length - 1] !== part) normalized.push(part)
  }
  return normalized.join('')
}

function mapPoiResult(data) {
  const pois = Array.isArray(data && data.pois) ? data.pois : []
  return pois
    .map((poi) => {
      const location = parseLocation(poi.location)
      if (!location) return null

      const province = normalizeText(poi.pname)
      const city = normalizeCity(poi.cityname, province)
      const district = normalizeText(poi.adname)
      const streetAddress = normalizeText(poi.address)
      const name = normalizeText(poi.name) || streetAddress || '地图搜索结果'
      const detail = joinAddress([
        province,
        city !== province ? city : '',
        district,
        streetAddress
      ]) || name

      return {
        ...location,
        name,
        address: detail,
        detail,
        city
      }
    })
    .filter(Boolean)
}

function mapGeocodeResult(data) {
  const geocodes = Array.isArray(data && data.geocodes) ? data.geocodes : []
  return geocodes
    .map((item) => {
      const location = parseLocation(item.location)
      if (!location) return null

      const province = normalizeText(item.province)
      const city = normalizeCity(item.city, province)
      const district = normalizeText(item.district)
      const formatted = normalizeText(item.formatted_address)
      const detail = formatted || joinAddress([province, city !== province ? city : '', district])
      const name = normalizeText(item.formatted_address) || detail || '地图搜索结果'

      return {
        ...location,
        name,
        address: detail || name,
        detail: detail || name,
        city
      }
    })
    .filter(Boolean)
}

function mapRegeoResult(latitude, longitude, data) {
  const regeocode = data && data.regeocode ? data.regeocode : {}
  const component = regeocode.addressComponent || {}
  const province = normalizeText(component.province)
  const city = normalizeCity(component.city, province)

  return {
    latitude: round6(latitude),
    longitude: round6(longitude),
    address: normalizeText(regeocode.formatted_address),
    city
  }
}

function requestAmap(path, params) {
  const url = new URL(path, AMAP_BASE)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value))
    }
  }

  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 10_000 }, (res) => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => {
        try {
          resolve(JSON.parse(body))
        } catch (err) {
          reject(new Error(`AMap returned invalid JSON: ${err.message}`))
        }
      })
    })

    req.on('timeout', () => {
      req.destroy(new Error('AMap request timeout'))
    })
    req.on('error', reject)
  })
}

function assertAmapOk(data) {
  if (data && data.status === '1') return
  const message = normalizeText(data && (data.info || data.infocode)) || '地图服务调用失败'
  const error = new Error(message)
  error.code = 'AMAP_ERROR'
  error.infocode = data && data.infocode
  throw error
}

async function searchAddress({ key, query, city, limit = 8 }) {
  const keywords = normalizeText(query)
  if (keywords.length < 2) return []

  const data = await requestAmap('/v3/place/text', {
    key,
    keywords,
    city: normalizeText(city),
    citylimit: 'false',
    offset: Math.max(1, Math.min(Number(limit) || 8, 10)),
    page: 1,
    extensions: 'base',
    output: 'json'
  })
  assertAmapOk(data)

  const results = mapPoiResult(data)
  if (results.length > 0) return results

  const geocodeData = await requestAmap('/v3/geocode/geo', {
    key,
    address: keywords,
    city: normalizeText(city),
    output: 'json'
  })
  assertAmapOk(geocodeData)
  return mapGeocodeResult(geocodeData).slice(0, limit)
}

async function reverseGeocode({ key, latitude, longitude }) {
  const lat = Number(latitude)
  const lng = Number(longitude)
  if (!isValidLatLng(lat, lng)) {
    return { latitude: round6(lat), longitude: round6(lng), address: '', city: '' }
  }

  const data = await requestAmap('/v3/geocode/regeo', {
    key,
    location: `${round6(lng)},${round6(lat)}`,
    extensions: 'base',
    roadlevel: 0,
    output: 'json'
  })
  assertAmapOk(data)
  return mapRegeoResult(lat, lng, data)
}

async function geocodeAddress({ key, address, city }) {
  const text = normalizeText(address)
  if (text.length < 2) return []
  const data = await requestAmap('/v3/geocode/geo', {
    key,
    address: text,
    city: normalizeText(city),
    output: 'json'
  })
  assertAmapOk(data)
  return mapGeocodeResult(data)
}

module.exports = {
  geocodeAddress,
  mapGeocodeResult,
  mapPoiResult,
  mapRegeoResult,
  reverseGeocode,
  searchAddress
}
