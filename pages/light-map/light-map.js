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
    roomStages: INITIAL_MAP_STATE.stages,
    selectedNode: decorateNodeForPopover(INITIAL_MAP_STATE.currentStage, INITIAL_MAP_STATE.currentStage.routeNodes[0], INITIAL_MAP_STATE),
    showNodePopover: false,
    showRoomSheet: false,
    roomTab: 'stages'
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
        roomStages: mapState.stages,
        selectedNode: decorateNodeForPopover(mapState.currentStage, mapState.currentStage.routeNodes[0], mapState),
        loading: false
      });
    } catch (err) {
      this.setData({ loading: false, loadError: err.message || '地图加载失败' });
    }
  },

  toggleRoomSheet() {
    this.setData({
      showRoomSheet: !this.data.showRoomSheet,
      roomTab: this.data.showRoomSheet ? this.data.roomTab : 'stages'
    });
  },

  switchRoomTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (!['stages', 'records', 'team'].includes(tab)) return;
    this.setData({ roomTab: tab });
  },

  showNodeProgress(e) {
    const index = Number(e.currentTarget.dataset.index);
    const node = this.data.displayStage && this.data.displayStage.routeNodes
      ? this.data.displayStage.routeNodes[index]
      : null;
    if (!node) return;
    this.setData({
      selectedNode: decorateNodeForPopover(this.data.displayStage, node, this.data.mapState),
      showNodePopover: true
    });
  },

  closeNodeProgress() {
    this.setData({ showNodePopover: false });
  },

  jumpToStage(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (!this.data.mapState || !Number.isFinite(index)) return;
    const displayStage = this.data.mapState.stages[index] || this.data.mapState.currentStage;
    if (displayStage.locked) return;
    this.setData({ stageIndex: index, displayStage: decorateStageForView(displayStage), showRoomSheet: false });
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
  const carrierNodeIndex = Math.max(0, Math.min(stage.routeNodes.length - 1, stage.level - 1));
  const carrierNode = stage.routeNodes[carrierNodeIndex] || stage.routeNodes[0];
  return {
    ...stage,
    carrierKey: carrierNode ? carrierNode.key : 'start',
    lightOpacity: opacity.toFixed(2)
  };
}

function decorateNodeForPopover(stage, node, mapState) {
  if (!stage || !node) return null;
  const nextText = node.status === 'completed'
    ? '周边地块已点亮'
    : node.status === 'active'
      ? mapState.nextUnlockText
      : '沿主线完成前置关卡后开放';

  return {
    ...node,
    stageName: stage.name,
    difficulty: stage.difficulty,
    challenge: stage.challenge,
    progressText: nextText,
    voicePrompt: mapState.voicePrompt
  };
}
