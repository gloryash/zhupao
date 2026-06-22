const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const pageDir = path.resolve(__dirname);

test('light map uses fullscreen game HUD and removes explanatory construction card', () => {
  const wxml = fs.readFileSync(path.join(pageDir, 'light-map.wxml'), 'utf8');

  assert.match(wxml, /class="game-hud"/);
  assert.match(wxml, /class="hud-stat"/);
  assert.match(wxml, /Lv\.{{displayStage\.level}}/);
  assert.doesNotMatch(wxml, /这里不是建造游戏/);
  assert.doesNotMatch(wxml, /rule-card/);
  assert.doesNotMatch(wxml, /quick-stats/);
});

test('light map renders pictorial landmarks instead of text-only landmark icons', () => {
  const wxml = fs.readFileSync(path.join(pageDir, 'light-map.wxml'), 'utf8');
  const wxss = fs.readFileSync(path.join(pageDir, 'light-map.wxss'), 'utf8');

  assert.match(wxml, /landmark--\{\{item\.visual\}\}/);
  assert.match(wxml, /lake-shape/);
  assert.match(wxml, /shop-base/);
  assert.match(wxml, /windmill-blades/);
  assert.match(wxss, /\.hex-grid/);
  assert.match(wxss, /\.building-roof/);
  assert.match(wxss, /\.windmill-blades/);
  assert.doesNotMatch(wxml, /<text class="lm-icon">{{item\.icon}}<\/text>/);
});

test('light map shows Overcooked-style route nodes, star HUD, lake, and lit hex territories', () => {
  const wxml = fs.readFileSync(path.join(pageDir, 'light-map.wxml'), 'utf8');
  const wxss = fs.readFileSync(path.join(pageDir, 'light-map.wxss'), 'utf8');

  assert.match(wxml, /route-node-label/);
  assert.match(wxml, /{{item\.label}}/);
  assert.match(wxml, /star-meter/);
  assert.match(wxml, /map-lake/);
  assert.match(wxml, /territory-hex/);
  assert.match(wxml, /{{item\.poi}}/);
  assert.match(wxss, /\.territory-hex\.is-lit/);
  assert.match(wxss, /\.territory-hex\.is-locked/);
  assert.match(wxss, /\.map-lake/);
  assert.match(wxss, /\.star-meter/);
});

test('light map is a fullscreen automatic world map without bottom terrain tabs', () => {
  const wxml = fs.readFileSync(path.join(pageDir, 'light-map.wxml'), 'utf8');
  const wxss = fs.readFileSync(path.join(pageDir, 'light-map.wxss'), 'utf8');

  assert.match(wxml, /志愿者成长地图・光境远征/);
  assert.match(wxml, /{{mapState\.gameName}}/);
  assert.match(wxml, /node-progress-popover/);
  assert.match(wxml, /bindtap="showNodeProgress"/);
  assert.doesNotMatch(wxml, /class="stage-switch"/);
  assert.doesNotMatch(wxml, /class="stage-toast"/);
  assert.doesNotMatch(wxss, /\.stage-switch/);
  assert.doesNotMatch(wxss, /\.stage-toast/);
  assert.match(wxss, /#c8a15b/);
  assert.match(wxss, /\.road-main/);
});

test('room sheet includes stage archive, assist-run records, and team management', () => {
  const wxml = fs.readFileSync(path.join(pageDir, 'light-map.wxml'), 'utf8');

  assert.match(wxml, /room-tabs/);
  assert.match(wxml, /历史关卡/);
  assert.match(wxml, /陪跑记录/);
  assert.match(wxml, /组队管理/);
  assert.match(wxml, /{{item\.difficulty}}/);
  assert.match(wxml, /{{item\.light}}/);
  assert.match(wxml, /队伍/);
});

test('room sheet separates tab panels, supports stage revisit, and uses scroll-view', () => {
  const wxml = fs.readFileSync(path.join(pageDir, 'light-map.wxml'), 'utf8');
  const js = fs.readFileSync(path.join(pageDir, 'light-map.js'), 'utf8');

  assert.match(wxml, /scroll-view class="stage-sheet-panel"/);
  assert.match(wxml, /data-tab="stages"/);
  assert.match(wxml, /data-tab="records"/);
  assert.match(wxml, /data-tab="team"/);
  assert.match(wxml, /bindtap="switchRoomTab"/);
  assert.match(wxml, /wx:if="{{roomTab === 'stages'}}"/);
  assert.match(wxml, /wx:elif="{{roomTab === 'records'}}"/);
  assert.match(wxml, /wx:elif="{{roomTab === 'team'}}"/);
  assert.match(wxml, /bindtap="jumpToStage"/);
  assert.match(js, /roomTab: 'stages'/);
  assert.match(js, /switchRoomTab\(e\)/);
});

test('map uses oblique diorama view and paired assist-run carrier', () => {
  const wxml = fs.readFileSync(path.join(pageDir, 'light-map.wxml'), 'utf8');
  const wxss = fs.readFileSync(path.join(pageDir, 'light-map.wxss'), 'utf8');

  assert.match(wxml, /class="diorama-camera"/);
  assert.match(wxml, /assist-carrier/);
  assert.match(wxml, /assist-carrier--{{displayStage\.carrierKey}}/);
  assert.match(wxml, /volunteer-figure/);
  assert.match(wxml, /blind-runner-figure/);
  assert.match(wxss, /\.diorama-camera/);
  assert.match(wxss, /rotateX\(58deg\)/);
  assert.match(wxss, /\.terrain-shell--oasis \.terrain-island/);
  assert.match(wxss, /\.terrain-shell--risk \.terrain-island/);
  assert.match(wxss, /\.terrain-shell--peril \.terrain-island/);
  assert.match(wxss, /\.terrain-shell--dawn \.terrain-island/);
  assert.match(wxss, /\.assist-carrier/);
});

test('first stage renders a dedicated newbie island demo with Overcooked-like world map primitives', () => {
  const wxml = fs.readFileSync(path.join(pageDir, 'light-map.wxml'), 'utf8');
  const wxss = fs.readFileSync(path.join(pageDir, 'light-map.wxss'), 'utf8');

  assert.match(wxml, /newbie-island-demo/);
  assert.match(wxml, /island-hex-field/);
  assert.match(wxml, /island-hex-tile/);
  assert.match(wxml, /island-lake-tile/);
  assert.match(wxml, /island-main-road/);
  assert.match(wxml, /island-team-panel/);
  assert.match(wxml, /island-stage-node-label/);
  assert.match(wxml, /guide-dog-carrier/);
  assert.doesNotMatch(wxml, /island-cut-edge/);
  assert.match(wxss, /\.newbie-island-demo/);
  assert.match(wxss, /\.newbie-island-camera/);
  assert.match(wxss, /rotateX\(34deg\)/);
  assert.match(wxss, /\.island-hex-tile/);
  assert.match(wxss, /\.island-hex-tile\.is-lit/);
  assert.match(wxss, /\.island-hex-tile\.is-locked/);
  assert.match(wxss, /\.island-main-road/);
  assert.match(wxss, /\.guide-dog-carrier/);
  assert.match(wxss, /\.island-team-panel/);
  assert.doesNotMatch(wxss, /\.newbie-island-demo::after/);
});

test('newbie island demo locks the requested long-lens 34 degree camera and 2.1 to 1 hex scale', () => {
  const wxml = fs.readFileSync(path.join(pageDir, 'light-map.wxml'), 'utf8');
  const wxss = fs.readFileSync(path.join(pageDir, 'light-map.wxss'), 'utf8');
  const js = fs.readFileSync(path.join(pageDir, 'light-map.js'), 'utf8');

  assert.match(wxml, /wx:for="{{demoStage\.routeNodes}}"/);
  assert.match(wxml, /guide-dog-carrier--{{demoStage\.carrierKey}}/);
  assert.doesNotMatch(wxml, /wx:if="{{displayStage\.theme === 'island'}}"/);
  assert.match(js, /demoStage:/);
  assert.match(js, /getDemoStage/);
  assert.match(wxss, /\.newbie-island-camera/);
  assert.match(wxss, /perspective:\s*5200rpx/);
  assert.match(wxss, /rotateX\(34deg\)\s*rotateZ\(-45deg\)/);
  assert.match(wxss, /background-size:\s*126rpx 60rpx/);
  assert.match(wxss, /width:\s*1480rpx/);
  assert.match(wxss, /height:\s*1120rpx/);
});

test('newbie island uses continuous route, round 3D nodes, and no dense dark background grid', () => {
  const wxml = fs.readFileSync(path.join(pageDir, 'light-map.wxml'), 'utf8');
  const wxss = fs.readFileSync(path.join(pageDir, 'light-map.wxss'), 'utf8');

  assert.match(wxml, /island-road-track/);
  assert.match(wxml, /island-road-joint/);
  assert.match(wxml, /island-stage-node-disc/);
  assert.match(wxml, /guide-dog-body/);
  assert.match(wxml, /guide-dog-light/);
  assert.match(wxss, /\.island-road-track/);
  assert.match(wxss, /\.island-road-joint/);
  assert.match(wxss, /\.island-stage-node-disc/);
  assert.match(wxss, /\.guide-dog-light/);
  assert.match(wxss, /background:\s*#d59a3a/);
  assert.doesNotMatch(wxss, /linear-gradient\(30deg, transparent 46%/);
});

test('newbie island visually matches the Overcooked reference map details', () => {
  const wxml = fs.readFileSync(path.join(pageDir, 'light-map.wxml'), 'utf8');
  const wxss = fs.readFileSync(path.join(pageDir, 'light-map.wxss'), 'utf8');

  assert.match(wxml, /island-blue-saw-edge/);
  assert.match(wxml, /island-grass-mass/);
  assert.match(wxml, /island-lake-mass/);
  assert.match(wxml, /island-building-cluster/);
  assert.match(wxml, /stage-focus-label stage-focus-label--one-two/);
  assert.match(wxml, /stage-focus-label stage-focus-label--one-three/);
  assert.match(wxml, /stage-focus-label stage-focus-label--one-four/);
  assert.match(wxml, /roadside-flag/);
  assert.match(wxss, /\.island-blue-saw-edge/);
  assert.match(wxss, /\.island-grass-mass/);
  assert.match(wxss, /\.island-lake-mass/);
  assert.match(wxss, /\.island-building-cluster/);
  assert.match(wxss, /\.stage-focus-label--one-four/);
  assert.match(wxss, /#d59a3a/);
  assert.match(wxss, /#15b8d2/);
  assert.match(wxss, /#62cf42/);
  assert.doesNotMatch(wxss, /background:\s*#6b573c/);
});

test('newbie island keeps control panels above decorative blue saw edges and labels key checkpoints', () => {
  const wxss = fs.readFileSync(path.join(pageDir, 'light-map.wxss'), 'utf8');

  assert.match(wxss, /\.island-blue-saw-edge\s*\{[\s\S]*?z-index:\s*12;/);
  assert.match(wxss, /\.island-team-panel\s*\{[\s\S]*?z-index:\s*23;/);
  assert.match(wxss, /\.stage-focus-label--one-two\s*\{[\s\S]*?top:\s*392rpx;/);
  assert.match(wxss, /\.stage-focus-label--one-three\s*\{[\s\S]*?top:\s*512rpx;/);
  assert.match(wxss, /\.stage-focus-label--one-four\s*\{[\s\S]*?top:\s*630rpx;/);
});
