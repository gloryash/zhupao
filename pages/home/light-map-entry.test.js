const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../..');

test('volunteer home primary action opens the light map page', () => {
  const homeWxml = fs.readFileSync(path.join(root, 'pages/home/home.wxml'), 'utf8');
  const homeJs = fs.readFileSync(path.join(root, 'pages/home/home.js'), 'utf8');
  const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));

  assert.ok(appJson.pages.includes('pages/light-map/light-map'));
  assert.match(homeWxml, /bindtap="openLightMap"/);
  assert.match(homeWxml, /前往光境远征/);
  assert.match(homeJs, /openLightMap\(\)/);
  assert.match(homeJs, /wx\.navigateTo\(\{\s*url: '\/pages\/light-map\/light-map'/);
});
