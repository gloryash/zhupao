const STAGE_CAPACITY = 5;
const LIGHT_PER_RUN = 15;
const LIGHT_PER_KM = 0;

const STAGES = [
  {
    id: 'morning-island',
    name: '晨光海岛',
    shortName: '海岛',
    theme: 'island',
    summary: '第一束光落在海边步道，公共空间开始恢复颜色。',
    lockedText: '完成陪跑后，海岛会先亮起来。',
    landmarks: [
      { id: 'coast-park', name: '海岸公园', type: 'facility', visual: 'park', step: 1, x: 18, y: 61 },
      { id: 'coast-shop', name: '冰淇淋小店', type: 'facility', visual: 'shop', step: 1, x: 30, y: 68 },
      { id: 'quiet-lake', name: '浅湾湖泊', type: 'facility', visual: 'lake', step: 2, x: 45, y: 38 },
      { id: 'skate-kid', name: '滑板少年', type: 'figure', visual: 'skater', step: 3, x: 62, y: 66 },
      { id: 'sun-bridge', name: '暖光小桥', type: 'facility', visual: 'bridge', step: 4, x: 70, y: 42 },
      { id: 'sea-windmill', name: '海边风车', type: 'facility', visual: 'windmill', step: 5, x: 84, y: 30 }
    ]
  },
  {
    id: 'mist-forest',
    name: '雾林公园',
    shortName: '雾林',
    theme: 'forest',
    summary: '雾气仍在，但路灯和树影已经被陪伴照亮。',
    lockedText: '点亮海岛后，雾林公园会开放。',
    landmarks: [
      { id: 'gate-grove', name: '林间入口', type: 'facility', visual: 'park', step: 1, x: 18, y: 52 },
      { id: 'laughing-kids', name: '快乐孩子', type: 'figure', visual: 'kids', step: 3, x: 40, y: 28 },
      { id: 'runner-lamps', name: '陪跑路灯', type: 'facility', visual: 'lamp', step: 4, x: 62, y: 60 },
      { id: 'green-square', name: '林中小广场', type: 'facility', visual: 'plaza', step: 5, x: 82, y: 40 }
    ]
  },
  {
    id: 'green-oasis',
    name: '风沙绿洲',
    shortName: '绿洲',
    theme: 'oasis',
    summary: '风沙边缘显出绿色，补给站和湖心步道被重新看见。',
    lockedText: '继续陪跑，风沙会退到更远的地方。',
    landmarks: [
      { id: 'shade-station', name: '树荫补给站', type: 'facility', visual: 'shop', step: 1, x: 20, y: 64 },
      { id: 'oasis-lake', name: '绿洲湖', type: 'facility', visual: 'lake', step: 2, x: 44, y: 36 },
      { id: 'wheel-friend', name: '轮滑朋友', type: 'figure', visual: 'skater', step: 4, x: 64, y: 68 },
      { id: 'wind-tower', name: '守望光塔', type: 'facility', visual: 'tower', step: 5, x: 84, y: 34 }
    ]
  },
  {
    id: 'starlit-walk',
    name: '星河步道',
    shortName: '星河',
    theme: 'night',
    summary: '夜色不再空旷，一盏盏灯把归途连成星河。',
    lockedText: '绿洲点亮后，夜间步道会出现。',
    landmarks: [
      { id: 'moon-park', name: '月影公园', type: 'facility', visual: 'park', step: 1, x: 18, y: 58 },
      { id: 'night-runner', name: '夜跑伙伴', type: 'figure', visual: 'runner', step: 2, x: 38, y: 34 },
      { id: 'star-bridge', name: '星光桥', type: 'facility', visual: 'bridge', step: 4, x: 64, y: 56 },
      { id: 'beacon-plaza', name: '灯塔广场', type: 'facility', visual: 'tower', step: 5, x: 84, y: 30 }
    ]
  },
  {
    id: 'bright-plaza',
    name: '光明广场',
    shortName: '广场',
    theme: 'plaza',
    summary: '个人的陪伴汇成公共光芒，城市中心也有了温度。',
    lockedText: '继续前进，最终会抵达光明广场。',
    landmarks: [
      { id: 'public-garden', name: '共行花园', type: 'facility', visual: 'park', step: 1, x: 20, y: 60 },
      { id: 'music-child', name: '吹泡泡的孩子', type: 'figure', visual: 'kids', step: 2, x: 42, y: 34 },
      { id: 'guide-hall', name: '引导服务亭', type: 'facility', visual: 'shop', step: 4, x: 66, y: 62 },
      { id: 'honor-square', name: '同行纪念广场', type: 'facility', visual: 'plaza', step: 5, x: 84, y: 34 }
    ]
  }
];

function buildLightMapState(input = {}) {
  const completedRuns = clampNumber(input.completedRuns || input.completedOrders || input.totalRuns, 0);
  const totalDistance = clampNumber(input.totalDistance, 0);
  const exp = clampNumber(input.exp, 0);
  const totalLight = Math.round(completedRuns * LIGHT_PER_RUN + totalDistance * LIGHT_PER_KM);
  const rawStageIndex = Math.floor(completedRuns / STAGE_CAPACITY);
  const currentStageIndex = Math.min(rawStageIndex, STAGES.length - 1);

  const stages = STAGES.map((stage, index) => {
    const stageStart = index * STAGE_CAPACITY;
    const runsIntoStage = Math.max(0, Math.min(STAGE_CAPACITY, completedRuns - stageStart));
    const status = getStageStatus(index, currentStageIndex, completedRuns);
    const level = status === 'locked' ? 0 : (status === 'completed' ? STAGE_CAPACITY : Math.max(1, runsIntoStage));
    const progressPct = status === 'completed'
      ? 100
      : status === 'active'
        ? Math.min(100, Math.round((runsIntoStage / STAGE_CAPACITY) * 100))
        : 0;
    return {
      ...stage,
      stageNo: index + 1,
      status,
      level,
      maxLevel: STAGE_CAPACITY,
      progressPct,
      lightRadius: 28 + Math.round(progressPct * 0.48),
      landmarks: stage.landmarks.map((landmark) => decorateLandmark(landmark, level, status)),
      locked: status === 'locked',
      active: status === 'active',
      completed: status === 'completed'
    };
  });

  const currentStage = stages[currentStageIndex] || stages[0];
  const nextStage = stages.find((stage) => stage.status === 'locked') || null;

  return {
    gameName: '光的地图',
    completedRuns,
    totalDistance,
    exp,
    totalLight,
    stages,
    currentStage,
    currentStageIndex,
    nextStage,
    nextUnlockText: nextStage ? `再完成 ${Math.max(1, STAGE_CAPACITY - currentStage.level)} 次陪跑，前往${nextStage.name}` : '你已经抵达当前所有地图',
    returnStops: []
  };
}

function buildReturnStops(state) {
  const stages = state && state.stages ? state.stages : [];
  const currentId = state && state.currentStage ? state.currentStage.id : '';
  return stages
    .filter((stage) => stage.status !== 'locked')
    .map((stage) => ({
      id: stage.id,
      label: stage.name,
      shortLabel: stage.shortName,
      index: stages.findIndex((item) => item.id === stage.id),
      current: stage.id === currentId,
      status: stage.status
    }));
}

function getStageStatus(index, currentStageIndex, completedRuns) {
  if (completedRuns <= 0) return index === 0 ? 'active' : 'locked';
  if (index < currentStageIndex) return 'completed';
  if (index === currentStageIndex) return 'active';
  return 'locked';
}

function decorateLandmark(landmark, level, stageStatus) {
  const revealed = stageStatus !== 'locked' && level >= landmark.step;
  return {
    ...landmark,
    revealed,
    tone: revealed ? 'color' : 'mono',
    visual: landmark.visual || 'park',
    className: `lm lm--${landmark.type} lm--${landmark.visual || 'park'} ${revealed ? 'is-lit' : 'is-muted'}`
  };
}

function clampNumber(value, min) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, n);
}

module.exports = {
  STAGE_CAPACITY,
  LIGHT_PER_RUN,
  STAGES,
  buildLightMapState,
  buildReturnStops
};
