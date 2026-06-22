const api = require('./api');

const SHANGHAI = { latitude: 31.2304, longitude: 121.4737, address: '上海市人民广场', city: '上海市' };

function getCurrentPosition() {
  return new Promise((resolve) => {
    wx.getLocation({
      type: 'gcj02',
      isHighAccuracy: false,
      success(res) {
        resolve({ latitude: res.latitude, longitude: res.longitude, source: 'geolocation' });
      },
      fail() {
        resolve(null);
      }
    });
  });
}

async function bestEffortPosition() {
  const pos = await getCurrentPosition();
  return pos || { latitude: SHANGHAI.latitude, longitude: SHANGHAI.longitude, source: 'fallback' };
}

function chooseAddress() {
  return new Promise((resolve, reject) => {
    wx.chooseLocation({
      success(res) {
        resolve({
          latitude: res.latitude,
          longitude: res.longitude,
          name: res.name || '',
          address: res.address || res.name || '已选择位置',
          detail: res.address || '',
          city: '',
          source: 'chooseLocation'
        });
      },
      fail(err) {
        reject(err);
      }
    });
  });
}

async function resolveCurrentAddress() {
  const pos = await getCurrentPosition();
  if (!pos) return { ...SHANGHAI, source: 'fallback' };
  try {
    const address = await api.reverseGeocode(pos.latitude, pos.longitude);
    return {
      latitude: pos.latitude,
      longitude: pos.longitude,
      address: address.address || address.formattedAddress || '当前位置',
      city: address.city || '',
      source: 'geolocation'
    };
  } catch (err) {
    return { latitude: pos.latitude, longitude: pos.longitude, address: '当前位置', city: '', source: 'geolocation' };
  }
}

async function searchAddress(query, city) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];
  try {
    const results = await api.searchAddress(q, city);
    return results.map((item, index) => normalizeAddress(item, index));
  } catch (err) {
    return [];
  }
}

function normalizeAddress(item, index) {
  const lat = Number(item.latitude !== undefined ? item.latitude : item.lat);
  const lng = Number(item.longitude !== undefined ? item.longitude : item.lng);
  return {
    id: `${item.name || 'addr'}-${index}`,
    name: item.name || item.address || '地址',
    detail: item.detail || item.address || item.name || '',
    address: item.address || item.detail || item.name || '',
    city: item.city || '',
    latitude: Number.isFinite(lat) ? lat : SHANGHAI.latitude,
    longitude: Number.isFinite(lng) ? lng : SHANGHAI.longitude
  };
}

function straightLineDistanceKm(a, b) {
  if (!a || !b) return 0;
  const r = 6371;
  const dLat = deg2rad(b.latitude - a.latitude);
  const dLng = deg2rad(b.longitude - a.longitude);
  const lat1 = deg2rad(a.latitude);
  const lat2 = deg2rad(b.latitude);
  const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return Number((2 * r * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))).toFixed(2));
}

function deg2rad(deg) {
  return deg * Math.PI / 180;
}

module.exports = {
  SHANGHAI,
  getCurrentPosition,
  bestEffortPosition,
  resolveCurrentAddress,
  chooseAddress,
  searchAddress,
  straightLineDistanceKm
};
