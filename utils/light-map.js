const STAGE_CAPACITY = 5;
const LIGHT_PER_RUN = 15;
const LIGHT_PER_KM = 0;
const FULL_STAGE_STARS = STAGE_CAPACITY * 3;
const ROUTE_NODE_KEYS = ['start', 'mid-a', 'mid-b', 'mid-c', 'end'];

const BASE_HEX_TILES = [
  { id: 'home', kind: 'house', x: 180, y: 446 },
  { id: 'corner-shop', kind: 'shop', x: 286, y: 366 },
  { id: 'park', kind: 'park', x: 400, y: 438 },
  { id: 'lake-side', kind: 'lake', x: 514, y: 350 },
  { id: 'bridge', kind: 'bridge', x: 624, y: 430 },
  { id: 'square', kind: 'plaza', x: 724, y: 354 },
  { id: 'windmill', kind: 'windmill', x: 780, y: 510 },
  { id: 'station', kind: 'station', x: 640, y: 580 },
  { id: 'kids', kind: 'figure', x: 498, y: 630 },
  { id: 'grove', kind: 'tree', x: 356, y: 574 },
  { id: 'lamp', kind: 'lamp', x: 238, y: 624 },
  { id: 'lookout', kind: 'tower', x: 130, y: 536 }
];

const THEME_POIS = {
  island: ['夜跑起点', '便利店', '雾林公园', '浅湾湖', '暖光小桥', '冰淇淋店', '海边风车', '补给站', '滑板角', '松林坡', '路灯湾', '观景台'],
  oasis: ['绿洲入口', '便利店', '树荫公园', '绿洲湖', '沙地桥', '冰饮小店', '风塔', '补给站', '轮滑角', '棕榈坡', '路灯湾', '守望台'],
  risk: ['城郊入口', '便利店', '月影公园', '星光湖', '交叉路口', '夜间小店', '坡道风车', '补给站', '夜跑伙伴', '树影坡', '陪跑路灯', '观察台'],
  peril: ['商圈入口', '便利店', '立体公园', '镜面湖', '台阶桥', '转角小店', '风塔', '补给亭', '人流广场', '花树坡', '指引路灯', '安全岗'],
  dawn: ['环城起点', '便利店', '共行花园', '中心湖', '同行桥', '服务小店', '纪念风车', '终点补给', '孩子乐园', '花树坡', '破晓路灯', '纪念塔']
};

const STAGES = [
  {
    id: 'island-mist-forest',
    name: '海岛雾林',
    shortName: '雾林',
    theme: 'island',
    difficulty: '新手入门',
    challenge: '短距离基础陪跑，植被多、路线平缓，适合建立第一次陪伴信心。',
    summary: '海岛雾林把第一段路放在清澈水域和绿色岛屿之间，短距离陪跑会先点亮安全起点。',
    lockedText: '完成基础陪跑后，海岛雾林会先亮起来。',
    landmarks: [
      { id: 'coast-park', name: '雾林公园', type: 'facility', visual: 'park', step: 1, x: 18, y: 61 },
      { id: 'coast-shop', name: '冰淇淋小店', type: 'facility', visual: 'shop', step: 1, x: 30, y: 68 },
      { id: 'quiet-lake', name: '浅湾湖泊', type: 'facility', visual: 'lake', step: 2, x: 45, y: 38 },
      { id: 'skate-kid', name: '滑板少年', type: 'figure', visual: 'skater', step: 3, x: 62, y: 66 },
      { id: 'sun-bridge', name: '暖光小桥', type: 'facility', visual: 'bridge', step: 4, x: 70, y: 42 },
      { id: 'sea-windmill', name: '海边风车', type: 'facility', visual: 'windmill', step: 5, x: 84, y: 30 }
    ]
  },
  {
    id: 'desert-oasis',
    name: '沙漠绿洲',
    shortName: '绿洲',
    theme: 'oasis',
    difficulty: '中等难度',
    challenge: '开阔无遮挡长距离路线，夜间强光和空旷路段提升避障挑战。',
    summary: '沙漠绿洲会把路线拉长，开阔路段需要更稳定的陪跑节奏。',
    lockedText: '海岛雾林全关卡满星后，沙漠绿洲会开放。',
    landmarks: [
      { id: 'shade-station', name: '树荫补给站', type: 'facility', visual: 'shop', step: 1, x: 20, y: 64 },
      { id: 'oasis-lake', name: '绿洲湖', type: 'facility', visual: 'lake', step: 3, x: 44, y: 36 },
      { id: 'wheel-friend', name: '轮滑朋友', type: 'figure', visual: 'skater', step: 4, x: 64, y: 68 },
      { id: 'wind-tower', name: '守望光塔', type: 'facility', visual: 'tower', step: 5, x: 84, y: 34 }
    ]
  },
  {
    id: 'star-risk-trail',
    name: '星河险径',
    shortName: '险径',
    theme: 'risk',
    difficulty: '高难城郊',
    challenge: '城郊复杂路段，人车混杂、交叉路口多、夜间光线差。',
    summary: '星河险径把夜色、路口和车流放进同一段路线，要求更强判断。',
    lockedText: '沙漠绿洲全关卡满星后，星河险径会开放。',
    landmarks: [
      { id: 'moon-park', name: '月影公园', type: 'facility', visual: 'park', step: 1, x: 18, y: 58 },
      { id: 'night-runner', name: '夜跑伙伴', type: 'figure', visual: 'runner', step: 2, x: 38, y: 34 },
      { id: 'star-bridge', name: '星光桥', type: 'facility', visual: 'bridge', step: 4, x: 64, y: 56 },
      { id: 'beacon-plaza', name: '灯塔广场', type: 'facility', visual: 'tower', step: 5, x: 84, y: 30 }
    ]
  },
  {
    id: 'long-night-peril',
    name: '长夜危途',
    shortName: '危途',
    theme: 'peril',
    difficulty: '高阶商圈',
    challenge: '城市复杂商圈，人流密集、台阶障碍物多、路线分支繁杂。',
    summary: '长夜危途进入密集商圈，陪跑需要兼顾人流、台阶和多分支路线。',
    lockedText: '星河险径全关卡满星后，长夜危途会开放。',
    landmarks: [
      { id: 'public-garden', name: '立体公园', type: 'facility', visual: 'park', step: 1, x: 20, y: 60 },
      { id: 'music-child', name: '快乐孩子', type: 'figure', visual: 'kids', step: 2, x: 42, y: 34 },
      { id: 'guide-hall', name: '引导服务亭', type: 'facility', visual: 'shop', step: 4, x: 66, y: 62 },
      { id: 'honor-square', name: '安全广场', type: 'facility', visual: 'plaza', step: 5, x: 84, y: 34 }
    ]
  },
  {
    id: 'dawn-plaza',
    name: '破晓广场',
    shortName: '破晓',
    theme: 'dawn',
    difficulty: '终极满级',
    challenge: '超长环城全程陪跑，集齐全部光值、全地块点亮后的最终路线。',
    summary: '破晓广场是全部熟路线的汇合点，个人陪伴最终成为公共光芒。',
    lockedText: '长夜危途全关卡满星后，破晓广场会开放。',
    landmarks: [
      { id: 'public-garden', name: '共行花园', type: 'facility', visual: 'park', step: 1, x: 20, y: 60 },
      { id: 'music-child', name: '吹泡泡的孩子', type: 'figure', visual: 'kids', step: 2, x: 42, y: 34 },
      { id: 'guide-hall', name: '引导服务亭', type: 'facility', visual: 'shop', step: 4, x: 66, y: 62 },
      { id: 'honor-square', name: '同行纪念广场', type: 'facility', visual: 'plaza', step: 5, x: 84, y: 34 }
    ]
  }
];

function buildLightMapState(input = {}) {
  const hasRunReports = Array.isArray(input.runReports);
  const scoredRuns = hasRunReports ? input.runReports.map(scoreRunLight) : [];
  const completedRuns = hasRunReports
    ? scoredRuns.length
    : clampNumber(input.completedRuns || input.completedOrders || input.totalRuns, 0);
  const stageStarTotals = buildStageStarTotals(scoredRuns);
  const totalDistance = clampNumber(input.totalDistance, 0);
  const exp = clampNumber(input.exp, 0);
  const totalLight = hasRunReports
    ? scoredRuns.reduce((sum, run) => sum + run.light, 0)
    : Math.round(completedRuns * LIGHT_PER_RUN + totalDistance * LIGHT_PER_KM);
  const totalStars = hasRunReports
    ? scoredRuns.reduce((sum, run) => sum + run.stars, 0)
    : readOptionalNumber(input.totalStars, completedRuns);
  const rawStageIndex = hasRunReports
    ? getPerfectStageIndex(stageStarTotals)
    : Math.floor(completedRuns / STAGE_CAPACITY);
  const currentStageIndex = Math.min(rawStageIndex, STAGES.length - 1);

  const stages = STAGES.map((stage, index) => {
    const stageStart = index * STAGE_CAPACITY;
    const runsIntoStage = Math.max(0, Math.min(STAGE_CAPACITY, completedRuns - stageStart));
    const stageScoredRuns = scoredRuns.slice(stageStart, stageStart + STAGE_CAPACITY);
    const status = getStageStatus(index, currentStageIndex, completedRuns, hasRunReports, stageStarTotals);
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
      stageStars: stageStarTotals[index] || 0,
      maxStars: FULL_STAGE_STARS,
      lightRadius: 28 + Math.round(progressPct * 0.48),
      routeNodes: buildRouteNodes(stage, index, runsIntoStage, status, stageScoredRuns),
      hexTiles: buildHexTiles(stage, level, status),
      landmarks: stage.landmarks.map((landmark) => decorateLandmark(landmark, level, status)),
      locked: status === 'locked',
      active: status === 'active',
      completed: status === 'completed'
    };
  });

  const currentStage = stages[currentStageIndex] || stages[0];
  const nextStage = stages.find((stage) => stage.status === 'locked') || null;

  return {
    gameName: '光境远征',
    completedRuns,
    totalDistance,
    exp,
    totalLight,
    totalStars,
    stages,
    currentStage,
    currentStageIndex,
    nextStage,
    nextUnlockText: buildNextUnlockText(currentStage, nextStage),
    returnStops: [],
    voicePrompt: buildVoicePrompt(currentStage, nextStage),
    runHistory: buildRunHistory(scoredRuns, completedRuns),
    teamSlots: buildTeamSlots(input.teamMembers)
  };
}

function scoreRunLight(report = {}) {
  const routeFit = clampPercent(report.routeFit);
  const obstacleAvoidance = clampPercent(report.obstacleAvoidance);
  const calmness = clampPercent(report.calmness);
  const safetyEvents = clampNumber(report.safetyEvents, 0);
  const average = (routeFit + obstacleAvoidance + calmness) / 3;

  if (average >= 90 && safetyEvents === 0) {
    return { stars: 3, light: 45, label: '满光' };
  }

  if (average >= 70 && safetyEvents <= 1) {
    return { stars: 2, light: 30, label: '稳光' };
  }

  return { stars: 1, light: 15, label: '微光' };
}

function buildRouteNodes(stage, stageIndex, runsIntoStage, stageStatus, scoredRuns) {
  const activeIndex = stageStatus === 'completed'
    ? ROUTE_NODE_KEYS.length
    : Math.max(0, Math.min(ROUTE_NODE_KEYS.length - 1, runsIntoStage - 1));

  return ROUTE_NODE_KEYS.map((key, index) => {
    const status = getRouteNodeStatus(index, activeIndex, runsIntoStage, stageStatus);
    const score = scoredRuns[index] || null;
    const stars = score ? score.stars : inferNodeStars(index, runsIntoStage, status);

    return {
      id: `${stage.id}-route-${key}`,
      key,
      label: `${stageIndex + 1}-${index + 1}`,
      status,
      stars,
      light: score ? score.light : stars * LIGHT_PER_RUN,
      starTokens: [0, 1, 2].map((tokenIndex) => ({
        id: `${stage.id}-route-${key}-star-${tokenIndex}`,
        filled: tokenIndex < stars
      }))
    };
  });
}

function getRouteNodeStatus(index, activeIndex, runsIntoStage, stageStatus) {
  if (stageStatus === 'locked') return 'locked';
  if (stageStatus === 'completed') return 'completed';
  if (runsIntoStage <= 0) return index === 0 ? 'active' : 'locked';
  if (index < activeIndex) return 'completed';
  if (index === activeIndex) return 'active';
  return 'locked';
}

function inferNodeStars(index, runsIntoStage, status) {
  if (status === 'locked' || runsIntoStage <= index) return 0;
  return 1;
}

function buildHexTiles(stage, level, stageStatus) {
  const pois = THEME_POIS[stage.theme] || THEME_POIS.island;
  const litCount = stageStatus === 'completed'
    ? BASE_HEX_TILES.length
    : stageStatus === 'locked'
      ? 0
      : Math.min(BASE_HEX_TILES.length - 1, Math.max(1, level * 2));

  return BASE_HEX_TILES.map((tile, index) => ({
    ...tile,
    id: `${stage.id}-${tile.id}`,
    poi: pois[index] || tile.kind,
    state: index < litCount ? 'lit' : 'locked'
  }));
}

function buildStageStarTotals(scoredRuns) {
  return STAGES.map((stage, index) => scoredRuns
    .slice(index * STAGE_CAPACITY, index * STAGE_CAPACITY + STAGE_CAPACITY)
    .reduce((sum, run) => sum + run.stars, 0));
}

function getPerfectStageIndex(stageStarTotals) {
  const firstIncomplete = stageStarTotals.findIndex((stars) => stars < FULL_STAGE_STARS);
  if (firstIncomplete === -1) return STAGES.length - 1;
  return firstIncomplete;
}

function buildNextUnlockText(currentStage, nextStage) {
  if (!nextStage) return '你已经抵达当前所有地图';
  const missingStars = Math.max(0, currentStage.maxStars - currentStage.stageStars);
  if (missingStars > 0) {
    return `${currentStage.name}全部子关卡拿满 ${currentStage.maxStars} 颗星后，前往${nextStage.name}`;
  }
  return `下一段主路已开放，前往${nextStage.name}`;
}

function buildVoicePrompt(currentStage, nextStage) {
  const nextText = nextStage ? `下一阶段是${nextStage.name}，${nextStage.challenge}` : '全部阶段已经点亮';
  return `当前地形${currentStage.name}，已点亮${currentStage.level}个子关卡。${currentStage.stageStars}颗星，${nextText}`;
}

function buildRunHistory(scoredRuns, completedRuns) {
  if (scoredRuns.length) {
    return scoredRuns.map((run, index) => ({
      id: `run-${index + 1}`,
      label: `第 ${index + 1} 次陪跑`,
      stars: run.stars,
      light: run.light,
      result: run.label
    })).reverse();
  }

  return Array.from({ length: Math.min(5, completedRuns) }, (_, index) => {
    const runIndex = completedRuns - index;
    return {
      id: `run-${runIndex}`,
      label: `第 ${runIndex} 次陪跑`,
      stars: 1,
      light: LIGHT_PER_RUN,
      result: '已点亮'
    };
  });
}

function buildTeamSlots(teamMembers) {
  const source = Array.isArray(teamMembers) && teamMembers.length
    ? teamMembers
    : ['我', '待邀请', '待邀请', '待邀请'];

  return source.slice(0, 4).map((member, index) => ({
    id: `team-${index}`,
    name: typeof member === 'string' ? member : (member.name || `成员 ${index + 1}`),
    role: index === 0 ? '队长' : '队员'
  }));
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

function getStageStatus(index, currentStageIndex, completedRuns, hasRunReports, stageStarTotals) {
  if (completedRuns <= 0) return index === 0 ? 'active' : 'locked';
  if (hasRunReports) {
    if ((stageStarTotals[index] || 0) >= FULL_STAGE_STARS && index < STAGES.length - 1) return 'completed';
    if (index === currentStageIndex) return 'active';
    return index < currentStageIndex ? 'completed' : 'locked';
  }
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

function clampPercent(value) {
  return Math.min(100, Math.max(0, clampNumber(value, 0)));
}

function readOptionalNumber(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, n);
}

module.exports = {
  STAGE_CAPACITY,
  LIGHT_PER_RUN,
  FULL_STAGE_STARS,
  STAGES,
  scoreRunLight,
  buildLightMapState,
  buildReturnStops
};
