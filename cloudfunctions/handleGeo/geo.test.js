const assert = require('node:assert/strict')
const test = require('node:test')

const {
  mapPoiResult,
  mapRegeoResult
} = require('./geo')

test('mapPoiResult converts AMap POIs into address search results', () => {
  const results = mapPoiResult({
    pois: [
      {
        name: '人民广场',
        pname: '上海市',
        cityname: '上海市',
        adname: '黄浦区',
        address: '人民大道120号',
        location: '121.475190,31.228833'
      },
      {
        name: '缺少坐标',
        cityname: '上海市',
        location: ''
      }
    ]
  })

  assert.deepEqual(results, [
    {
      latitude: 31.228833,
      longitude: 121.47519,
      name: '人民广场',
      address: '上海市黄浦区人民大道120号',
      detail: '上海市黄浦区人民大道120号',
      city: '上海市'
    }
  ])
})

test('mapRegeoResult handles municipality city fallback', () => {
  const result = mapRegeoResult(31.228833, 121.47519, {
    regeocode: {
      formatted_address: '上海市黄浦区人民大道120号人民广场',
      addressComponent: {
        province: '上海市',
        city: [],
        district: '黄浦区'
      }
    }
  })

  assert.deepEqual(result, {
    latitude: 31.228833,
    longitude: 121.47519,
    address: '上海市黄浦区人民大道120号人民广场',
    city: '上海市'
  })
})
