const api = require('../../utils/api');
const session = require('../../utils/session');
const lightMap = require('../../utils/light-map');
const safeArea = require('../../utils/safe-area');

const INITIAL_MAP_STATE = lightMap.buildLightMapState({});

Page({
  data: {
    user: null,
    loading: true,
    loadError: '',
    shellStyle: '',
    mapState: INITIAL_MAP_STATE,
    displayStage: decorateStageForView(INITIAL_MAP_STATE.currentStage),
    stageIndex: 0,
    returnStops: lightMap.buildReturnStops(INITIAL_MAP_STATE),
    showStagePicker: false
  },

  onLoad() {
    this.setData({ shellStyle: safeArea.getSafeAreaStyle() });
    this.loadMapState();
  },

  async loadMapState() {
    const current = session.requireSession();
    if (!current) return;

    this.setData({ loading: true, loadError: '' });
    try {
      const [profile, stats] = await Promise.all([api.getUserProfile(), api.getUserStats()]);
      session.updateUser(profile);
      const mapState = lightMap.buildLightMapState({
        completedRuns: stats.completedOrders || profile.totalRuns || 0,
        totalDistance: stats.totalDistance || profile.totalDistance || 0,
        exp: stats.exp || profile.exp || 0
      });
      this.setData({
        user: profile,
        mapState,
        displayStage: decorateStageForView(mapState.currentStage),
        stageIndex: mapState.currentStageIndex,
        returnStops: lightMap.buildReturnStops(mapState),
        loading: false
      });
    } catch (err) {
      this.setData({ loading: false, loadError: err.message || '地图加载失败' });
    }
  },

  toggleStagePicker() {
    this.setData({ showStagePicker: !this.data.showStagePicker });
  },

  jumpToStage(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (!this.data.mapState || !Number.isFinite(index)) return;
    const displayStage = this.data.mapState.stages[index] || this.data.mapState.currentStage;
    if (displayStage.locked) return;
    this.setData({ stageIndex: index, displayStage: decorateStageForView(displayStage), showStagePicker: false });
  },

  openHome() {
    wx.navigateBack({ delta: 1 });
  },

  retryLoad() {
    this.loadMapState();
  },

  noop() {
    /* used by catchtap */
  }
});

function decorateStageForView(stage) {
  if (!stage) return null;
  const opacity = Math.min(1, stage.progressPct / 100 + 0.25);
  return {
    ...stage,
    lightOpacity: opacity.toFixed(2)
  };
}
