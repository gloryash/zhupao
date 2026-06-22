const assert = require('node:assert/strict');
const test = require('node:test');

const fmt = require('./format');

test('decorateOrder prefers structured origin and destination addresses over legacy flat fields', () => {
  const order = fmt.decorateOrder({
    _id: 'order-1',
    status: 'waiting',
    address: '旧的定位地址',
    originAddress: '旧的起点地址',
    destinationAddress: '旧的终点地址',
    origin: {
      latitude: 31.2397,
      longitude: 121.4998,
      address: '上海市黄浦区中山东一路外滩观景平台'
    },
    destination: {
      latitude: 31.2241,
      longitude: 121.4692,
      address: '上海市黄浦区新天地太平湖'
    },
    targetDistance: 3.2,
    estimatedDuration: 45
  }, 'volunteer');

  assert.equal(order.startAddress, '上海市黄浦区中山东一路外滩观景平台');
  assert.equal(order.destinationAddress, '上海市黄浦区新天地太平湖');
});

test('decorateOrder falls back to flat origin fields before the legacy generic address', () => {
  const order = fmt.decorateOrder({
    _id: 'order-2',
    status: 'waiting',
    address: '当前位置',
    originAddress: '上海市徐汇区漕溪北路徐家汇地铁站',
    destinationAddress: '上海市黄浦区外滩源',
    targetDistance: 4,
    estimatedDuration: 60
  }, 'disabled');

  assert.equal(order.startAddress, '上海市徐汇区漕溪北路徐家汇地铁站');
  assert.equal(order.destinationAddress, '上海市黄浦区外滩源');
});
