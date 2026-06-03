import L from 'leaflet'

const AMAP_TILE_URL =
  'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}'

export function addBaseTileLayer(map: L.Map, attributionControl = false): L.TileLayer {
  const primary = L.tileLayer(AMAP_TILE_URL, {
    maxZoom: 19,
    subdomains: ['1', '2', '3', '4'],
    attribution: attributionControl ? '© 高德地图' : undefined
  })

  return primary.addTo(map)
}
