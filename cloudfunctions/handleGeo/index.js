const cloud = require('wx-server-sdk')
const {
  geocodeAddress,
  reverseGeocode,
  searchAddress
} = require('./geo')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event = {}) => {
  const action = event.action
  const key = process.env.AMAP_WEB_SERVICE_KEY || process.env.AMAP_KEY

  if (!key) {
    return fail('CONFIG_ERROR', '地图服务未配置')
  }

  try {
    switch (action) {
      case 'search': {
        const results = await searchAddress({
          key,
          query: event.query,
          city: event.city,
          limit: event.limit
        })
        return ok({ results })
      }
      case 'reverse': {
        const address = await reverseGeocode({
          key,
          latitude: event.latitude,
          longitude: event.longitude
        })
        return ok({ address })
      }
      case 'geocode': {
        const results = await geocodeAddress({
          key,
          address: event.address,
          city: event.city
        })
        return ok({ results })
      }
      default:
        return fail('VALIDATION_ERROR', '未知操作')
    }
  } catch (err) {
    console.error('handleGeo error:', err && err.message ? err.message : err)
    return fail(err.code || 'GEO_SERVICE_ERROR', err.message || '地图服务调用失败', {
      infocode: err.infocode
    })
  }
}

function ok(data) {
  return { success: true, ...(data || {}) }
}

function fail(code, error, extra) {
  return { success: false, code, error, ...(extra || {}) }
}
