import L from 'leaflet'

const AMAP_TILE_URL =
  'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}'

const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

export function addBaseTileLayer(map: L.Map, attributionControl = false): L.TileLayer {
  let fallbackAdded = false
  const primary = L.tileLayer(AMAP_TILE_URL, {
    maxZoom: 19,
    subdomains: ['1', '2', '3', '4'],
    attribution: attributionControl ? '© 高德地图' : undefined
  })

  let errors = 0
  primary.on('tileerror', () => {
    errors += 1
    if (fallbackAdded || errors < 3) return
    fallbackAdded = true
    map.removeLayer(primary)
    L.tileLayer(OSM_TILE_URL, {
      maxZoom: 19,
      attribution: attributionControl ? '© OpenStreetMap' : undefined
    }).addTo(map)
  })

  return primary.addTo(map)
}
