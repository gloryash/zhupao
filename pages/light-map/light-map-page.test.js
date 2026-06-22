const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const lightMap = require('../../utils/light-map');

function loadPageDefinition() {
  const pagePath = path.resolve(__dirname, 'light-map.js');
  delete require.cache[pagePath];

  const originalPage = global.Page;
  const originalWx = global.wx;
  let definition = null;

  global.Page = (config) => {
    definition = config;
  };
  global.wx = { navigateBack() {} };

  require(pagePath);

  global.Page = originalPage;
  global.wx = originalWx;

  return definition;
}

function createInstance() {
  const definition = loadPageDefinition();
  const state = lightMap.buildLightMapState({ completedRuns: 8 });
  const instance = {
    ...definition,
    data: {
      ...definition.data,
      mapState: state,
      displayStage: state.currentStage,
      stageIndex: state.currentStageIndex,
      roomStages: state.stages,
      showRoomSheet: true,
      roomTab: 'stages'
    },
    setData(patch) {
      this.data = { ...this.data, ...patch };
    }
  };

  return instance;
}

test('room tabs switch between stage archive, run records, and team management', () => {
  const page = createInstance();

  page.switchRoomTab({ currentTarget: { dataset: { tab: 'records' } } });
  assert.equal(page.data.roomTab, 'records');

  page.switchRoomTab({ currentTarget: { dataset: { tab: 'team' } } });
  assert.equal(page.data.roomTab, 'team');
});

test('stage archive can revisit an unlocked previous terrain and closes the room sheet', () => {
  const page = createInstance();

  page.jumpToStage({ currentTarget: { dataset: { index: 0 } } });

  assert.equal(page.data.displayStage.id, 'island-mist-forest');
  assert.equal(page.data.stageIndex, 0);
  assert.equal(page.data.showRoomSheet, false);
});
