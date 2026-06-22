const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const loginPath = path.resolve(__dirname, 'login.js');
const sessionPath = path.resolve(__dirname, '../../utils/session.js');
const voicePlayerPath = path.resolve(__dirname, '../../utils/voice-player.js');
const appWxssPath = path.resolve(__dirname, '../../app.wxss');

function loadLoginPage() {
  delete require.cache[loginPath];
  delete require.cache[sessionPath];
  delete require.cache[voicePlayerPath];
  delete global.requirePlugin;

  const storage = new Map();
  const pageCalls = [];
  global.wx = {
    getStorageSync(key) {
      return storage.get(key) || null;
    },
    setStorageSync(key, value) {
      storage.set(key, value);
    },
    removeStorageSync() {},
    reLaunch() {},
    showLoading() {},
    hideLoading() {},
    showToast() {}
  };
  global.getApp = () => ({ globalData: {} });
  global.Page = (definition) => {
    pageCalls.push(definition);
  };

  require(loginPath);
  const page = pageCalls[0];
  page.data = JSON.parse(JSON.stringify(page.data));
  page.setData = function setData(next) {
    Object.assign(this.data, next);
  };
  return { page, storage };
}

test('password visibility toggle uses eye icons instead of Chinese text', () => {
  const loginWxml = fs.readFileSync(loginPath.replace(/\.js$/, '.wxml'), 'utf8');
  const appWxss = fs.readFileSync(appWxssPath, 'utf8');

  assert.match(loginWxml, /password-eye/);
  assert.match(loginWxml, /eye-icon--open/);
  assert.match(loginWxml, /eye-icon--closed/);
  assert.doesNotMatch(loginWxml, />\{\{showPassword \? '隐' : '显'\}\}<\/view>/);
  assert.match(appWxss, /\.password-eye/);
  assert.match(appWxss, /\.eye-icon--open/);
  assert.match(appWxss, /\.eye-icon--closed/);
});

test('registration role picker has breathing room before account fields', () => {
  const loginWxml = fs.readFileSync(loginPath.replace(/\.js$/, '.wxml'), 'utf8');
  const appWxss = fs.readFileSync(appWxssPath, 'utf8');

  assert.match(loginWxml, /class="field role-field"/);
  assert.match(loginWxml, /class="stack-sm auth-form-stack"/);
  assert.match(appWxss, /\.role-field/);
  assert.match(appWxss, /\.auth-form-stack/);
});

test('login registration controls expose voice cue labels', () => {
  const loginWxml = fs.readFileSync(loginPath.replace(/\.js$/, '.wxml'), 'utf8');
  const { page } = loadLoginPage();

  assert.match(loginWxml, /aria-live="polite"[^>]*>\{\{voiceCue\}\}/);
  assert.match(loginWxml, /aria-label="我是视障跑者"/);
  assert.match(loginWxml, /aria-label="手机号码"/);
  assert.match(loginWxml, /bindfocus="announceTap"/);

  page.announceTap({ currentTarget: { dataset: { voice: '手机号码' } } });
  assert.equal(page.data.voiceCue, '手机号码');
});

test('login voice helper does not emit debug logs during normal use', () => {
  const { page, storage } = loadLoginPage();
  const logs = [];
  const originalInfo = console.info;
  console.info = (...args) => logs.push(args);

  try {
    page.setData({
      mode: 'register',
      role: 'disabled',
      voiceCue: '旧播报'
    });

    page.announceTap({ currentTarget: { dataset: { voice: '手机号码', key: 'phone' } } });
  } finally {
    console.info = originalInfo;
  }

  assert.equal(page.data.voiceCue, '手机号码');
  assert.equal(logs.some(([prefix]) => prefix === '[voice-debug]'), false);
  assert.equal(storage.get('voice_debug_logs'), undefined);
});

test('login announce plays generated TTS audio when the mini program plugin is available', () => {
  const played = [];
  const { page } = loadLoginPage();
  global.wx.createInnerAudioContext = () => ({
    src: '',
    stop() {},
    play() {
      played.push(this.src);
    }
  });
  let ttsRequest = null;
  global.requirePlugin = (name) => {
    assert.equal(name, 'WechatSI');
    return {
      textToSpeech(options) {
        ttsRequest = options;
        options.success({ filename: 'wxfile://voice-login.mp3' });
      }
    };
  };

  page.announce('手机号码');

  assert.equal(ttsRequest.content, '手机号码');
  assert.deepEqual(played, ['wxfile://voice-login.mp3']);
});

test('togglePassword switches the input password state', () => {
  const { page } = loadLoginPage();

  assert.equal(page.data.showPassword, false);
  page.togglePassword();
  assert.equal(page.data.showPassword, true);
  page.togglePassword();
  assert.equal(page.data.showPassword, false);
});
