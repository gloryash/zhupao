const assert = require('node:assert/strict');
const test = require('node:test');

const lightMap = require('./light-map');

test('buildLightMapState unlocks stage progress from completed volunteer runs', () => {
  const state = lightMap.buildLightMapState({
    completedRuns: 14,
    totalDistance: 42,
    exp: 700
  });

  assert.equal(state.gameName, '光的地图');
  assert.equal(state.totalLight, 210);
  assert.equal(state.currentStage.id, 'green-oasis');
  assert.equal(state.currentStage.level, 4);
  assert.equal(state.currentStage.progressPct, 80);
  assert.equal(state.stages[0].status, 'completed');
  assert.equal(state.stages[1].status, 'completed');
  assert.equal(state.stages[2].status, 'active');
});

test('stage landmarks exist before light reaches them and become colorful after passing', () => {
  const state = lightMap.buildLightMapState({ completedRuns: 7, totalDistance: 18 });
  const island = state.stages[0];

  assert.equal(island.status, 'completed');
  assert.equal(island.landmarks[0].tone, 'color');
  assert.equal(island.landmarks[0].revealed, true);
  const skater = island.landmarks.find((landmark) => landmark.visual === 'skater');
  assert.equal(skater.type, 'figure');
  assert.equal(skater.tone, 'color');

  const forest = state.stages[1];
  assert.equal(forest.status, 'active');
  assert.equal(forest.landmarks[0].tone, 'color');
  assert.equal(forest.landmarks[1].tone, 'mono');
  assert.equal(forest.landmarks[1].revealed, false);
});

test('buildReturnStops exposes unlocked terrain buttons for map auto-jump', () => {
  const state = lightMap.buildLightMapState({ completedRuns: 16 });
  const stops = lightMap.buildReturnStops(state);

  assert.deepEqual(stops.map((stop) => stop.id), ['morning-island', 'mist-forest', 'green-oasis', 'starlit-walk']);
  assert.equal(stops[0].label, '晨光海岛');
  assert.equal(stops[3].current, true);
});
