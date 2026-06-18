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
