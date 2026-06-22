const assert = require('node:assert/strict');
const test = require('node:test');

const lightMap = require('./light-map');

test('buildLightMapState unlocks stage progress from completed volunteer runs', () => {
  const state = lightMap.buildLightMapState({
    completedRuns: 14,
    totalDistance: 42,
    exp: 700
  });

  assert.equal(state.gameName, '光境远征');
  assert.equal(state.totalLight, 210);
  assert.equal(state.currentStage.id, 'star-risk-trail');
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

  assert.deepEqual(stops.map((stop) => stop.id), ['island-mist-forest', 'desert-oasis', 'star-risk-trail', 'long-night-peril']);
  assert.equal(stops[0].label, '海岛雾林');
  assert.equal(stops[3].current, true);
});

test('stages use fixed challenge names and advance only after full-stage perfect stars', () => {
  const almostPerfect = lightMap.buildLightMapState({
    runReports: [
      { routeFit: 96, obstacleAvoidance: 96, calmness: 96, safetyEvents: 0 },
      { routeFit: 94, obstacleAvoidance: 95, calmness: 94, safetyEvents: 0 },
      { routeFit: 93, obstacleAvoidance: 94, calmness: 93, safetyEvents: 0 },
      { routeFit: 92, obstacleAvoidance: 92, calmness: 92, safetyEvents: 0 },
      { routeFit: 80, obstacleAvoidance: 82, calmness: 83, safetyEvents: 0 }
    ]
  });

  assert.deepEqual(almostPerfect.stages.map((stage) => stage.name), ['海岛雾林', '沙漠绿洲', '星河险径', '长夜危途', '破晓广场']);
  assert.deepEqual(almostPerfect.stages.map((stage) => stage.difficulty), ['新手入门', '中等难度', '高难城郊', '高阶商圈', '终极满级']);
  assert.equal(almostPerfect.currentStage.id, 'island-mist-forest');
  assert.equal(almostPerfect.stages[0].status, 'active');
  assert.equal(almostPerfect.stages[1].status, 'locked');
  assert.match(almostPerfect.nextUnlockText, /全部子关卡拿满 15 颗星/);

  const perfectFirstStage = lightMap.buildLightMapState({
    runReports: Array.from({ length: 5 }, () => ({
      routeFit: 96,
      obstacleAvoidance: 96,
      calmness: 96,
      safetyEvents: 0
    }))
  });

  assert.equal(perfectFirstStage.currentStage.id, 'desert-oasis');
  assert.equal(perfectFirstStage.stages[0].status, 'completed');
  assert.equal(perfectFirstStage.currentStage.routeNodes[0].label, '2-1');
});

test('first stage is named island mist forest for the dedicated visual demo', () => {
  const state = lightMap.buildLightMapState({ completedRuns: 1 });

  assert.equal(state.stages[0].id, 'island-mist-forest');
  assert.equal(state.stages[0].name, '海岛雾林');
  assert.equal(state.stages[0].shortName, '雾林');
  assert.match(state.stages[0].summary, /海岛雾林/);
  assert.match(state.stages[0].challenge, /短距离基础陪跑/);
});

test('scoreRunLight turns assist-run quality into one to three light stars', () => {
  assert.deepEqual(lightMap.scoreRunLight({
    routeFit: 96,
    obstacleAvoidance: 98,
    calmness: 94,
    safetyEvents: 0
  }), {
    stars: 3,
    light: 45,
    label: '满光'
  });

  assert.deepEqual(lightMap.scoreRunLight({
    routeFit: 72,
    obstacleAvoidance: 76,
    calmness: 80,
    safetyEvents: 1
  }), {
    stars: 2,
    light: 30,
    label: '稳光'
  });
});

test('current stage exposes Overcooked-style route nodes and nearby hex reveal state', () => {
  const state = lightMap.buildLightMapState({
    runReports: [
      { routeFit: 95, obstacleAvoidance: 95, calmness: 95, safetyEvents: 0 },
      { routeFit: 82, obstacleAvoidance: 80, calmness: 78, safetyEvents: 0 },
      { routeFit: 66, obstacleAvoidance: 70, calmness: 68, safetyEvents: 1 }
    ]
  });

  assert.equal(state.completedRuns, 3);
  assert.equal(state.totalStars, 6);
  assert.equal(state.totalLight, 90);
  assert.deepEqual(state.currentStage.routeNodes.map((node) => node.label), ['1-1', '1-2', '1-3', '1-4', '1-5']);
  assert.equal(state.currentStage.routeNodes[0].status, 'completed');
  assert.equal(state.currentStage.routeNodes[1].status, 'completed');
  assert.equal(state.currentStage.routeNodes[2].status, 'active');
  assert.equal(state.currentStage.routeNodes[3].status, 'locked');
  assert.equal(state.currentStage.routeNodes[0].stars, 3);
  assert.equal(state.currentStage.routeNodes[1].stars, 2);
  assert.equal(state.currentStage.routeNodes[2].stars, 1);
  assert.ok(state.currentStage.hexTiles.filter((tile) => tile.state === 'lit').length >= 6);
  assert.ok(state.currentStage.hexTiles.some((tile) => tile.poi === '便利店'));
  assert.ok(state.currentStage.hexTiles.some((tile) => tile.state === 'locked'));
});
