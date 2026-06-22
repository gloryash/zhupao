const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const homePath = path.resolve(__dirname, 'home.js');
const locationPath = path.resolve(__dirname, '../../utils/location.js');
const apiPath = path.resolve(__dirname, '../../utils/api.js');
const sessionPath = path.resolve(__dirname, '../../utils/session.js');
const voicePlayerPath = path.resolve(__dirname, '../../utils/voice-player.js');
const appWxssPath = path.resolve(__dirname, '../../app.wxss');
const appJsonPath = path.resolve(__dirname, '../../app.json');

function loadHomePage({ wxOverrides = {} } = {}) {
  delete require.cache[homePath];
  delete require.cache[locationPath];
  delete require.cache[apiPath];
  delete require.cache[sessionPath];
  delete require.cache[voicePlayerPath];
  delete global.requirePlugin;

  const storage = new Map();
  const pageCalls = [];
  const wxStub = {
    getStorageSync(key) {
      return storage.get(key);
    },
    setStorageSync(key, value) {
      storage.set(key, value);
    },
    removeStorageSync(key) {
      storage.delete(key);
    },
    chooseLocation() {
      throw new Error('chooseLocation was not stubbed');
    },
    showLoading() {},
    hideLoading() {},
    showToast() {},
    reLaunch() {},
    cloud: {
      callFunction() {
        throw new Error('cloud.callFunction was not stubbed');
      }
    },
    ...wxOverrides
  };

  global.wx = wxStub;
  global.getApp = () => ({ globalData: {} });
  global.Page = (definition) => {
    pageCalls.push(definition);
  };

  require(homePath);

  const page = pageCalls[0];
  page.data = JSON.parse(JSON.stringify(page.data));
  page.setData = function setData(next, callback) {
    for (const [key, value] of Object.entries(next)) {
      this.data[key] = value;
    }
    if (typeof callback === 'function') callback();
  };

  return { page, storage, wx: wxStub };
}

function eventFor(field, extra = {}) {
  return {
    currentTarget: {
      dataset: { field, ...extra }
    },
    detail: extra.detail || {}
  };
}

test('map endpoint action opens the map picker and stores the chosen location', async () => {
  let chooseLocationCalled = false;
  const { page } = loadHomePage({
    wxOverrides: {
      chooseLocation(options) {
        chooseLocationCalled = true;
        options.success({
          name: '外滩观景平台',
          address: '上海市黄浦区中山东一路外滩观景平台',
          latitude: 31.2397,
          longitude: 121.4998
        });
      }
    }
  });

  await page.chooseCurrentEndpoint(eventFor('start'));

  assert.equal(chooseLocationCalled, true);
  assert.equal(page.data.start.address, '上海市黄浦区中山东一路外滩观景平台');
  assert.equal(page.data.start.name, '外滩观景平台');
  assert.equal(page.data.start.displayName, '外滩观景平台');
  assert.equal(page.data.start.displayDetail, '上海市黄浦区中山东一路外滩观景平台');
  assert.equal(page.data.start.displayAddress, '外滩观景平台 · 上海市黄浦区中山东一路外滩观景平台');
});

test('map-selected POI uses the place name as the primary display text', () => {
  const { page } = loadHomePage();

  page.setEndpoint('start', {
    name: '徐汇区人民政府',
    address: '上海市徐汇区漕溪北路338号',
    detail: '上海市徐汇区漕溪北路338号',
    latitude: 31.1883,
    longitude: 121.4369
  });

  assert.equal(page.data.start.displayName, '徐汇区人民政府');
  assert.equal(page.data.start.displayDetail, '上海市徐汇区漕溪北路338号');
  assert.equal(page.data.start.displayAddress, '徐汇区人民政府 · 上海市徐汇区漕溪北路338号');
});

test('publishing uses the readable POI label instead of only the street address', async () => {
  const captured = [];
  const { page, storage } = loadHomePage({
    wxOverrides: {
      cloud: {
        callFunction(options) {
          captured.push({ name: options.name, data: options.data });
          options.success({
            result: {
              success: true,
              order: {
                _id: 'order-poi',
                status: 'waiting',
                origin: options.data.origin,
                destination: options.data.destination,
                originAddress: options.data.origin.address,
                destinationAddress: options.data.destination.address,
                address: options.data.origin.address,
                targetDistance: options.data.targetDistance,
                estimatedDuration: options.data.estimatedDuration
              }
            }
          });
        }
      }
    }
  });
  storage.set('blindrun.session.v1', {
    authToken: 'token',
    expiresAt: '2099-01-01T00:00:00.000Z',
    user: { userType: 'disabled' }
  });
  page.setData({
    start: {
      latitude: 31.1883,
      longitude: 121.4369,
      name: '徐汇区人民政府',
      address: '上海市徐汇区漕溪北路338号',
      detail: '上海市徐汇区漕溪北路338号',
      displayName: '徐汇区人民政府',
      displayDetail: '上海市徐汇区漕溪北路338号',
      displayAddress: '徐汇区人民政府 · 上海市徐汇区漕溪北路338号'
    },
    destination: {
      latitude: 31.2241,
      longitude: 121.4692,
      name: '新天地太平湖',
      address: '上海市黄浦区太仓路新天地太平湖',
      detail: '上海市黄浦区太仓路新天地太平湖',
      displayName: '新天地太平湖',
      displayDetail: '上海市黄浦区太仓路新天地太平湖',
      displayAddress: '新天地太平湖 · 上海市黄浦区太仓路新天地太平湖'
    }
  });

  await page.publishRunnerOrder();

  const publishCall = captured.find((call) => call.name === 'handleOrder');
  assert.equal(publishCall.data.action, 'publish');
  assert.equal(publishCall.data.origin.address, '徐汇区人民政府 · 上海市徐汇区漕溪北路338号');
  assert.equal(publishCall.data.destination.address, '新天地太平湖 · 上海市黄浦区太仓路新天地太平湖');
});

test('selecting a search result records per-field address history', () => {
  const { page, storage } = loadHomePage();
  page.setData({
    startResults: [
      {
        id: 'bund-1',
        name: '外滩',
        detail: '上海市黄浦区中山东一路',
        address: '上海市黄浦区中山东一路外滩',
        city: '上海市',
        latitude: 31.2397,
        longitude: 121.4998
      }
    ]
  });

  page.selectEndpoint(eventFor('start', { index: 0 }));

  assert.equal(page.data.start.address, '上海市黄浦区中山东一路外滩');
  assert.deepEqual(storage.get('blindrun_address_history_start'), [
    {
      latitude: 31.2397,
      longitude: 121.4998,
      name: '外滩',
      address: '上海市黄浦区中山东一路外滩',
      detail: '上海市黄浦区中山东一路',
      displayName: '外滩',
      displayDetail: '上海市黄浦区中山东一路',
      displayAddress: '外滩 · 上海市黄浦区中山东一路',
      city: '上海市'
    }
  ]);
});

test('typing at least two characters schedules live address search', async () => {
  const { page } = loadHomePage();
  let searchCalled = false;
  const originalSearch = page.runAddressSearch;
  page.runAddressSearch = async function runAddressSearchSpy(field, options) {
    searchCalled = true;
    assert.equal(field, 'start');
    assert.deepEqual(options, { notify: false });
    return originalSearch.call(this, field, options);
  };

  page.onAddressInput(eventFor('start', { detail: { value: '外滩' } }));
  await new Promise((resolve) => setTimeout(resolve, 380));

  assert.equal(searchCalled, true);
});

test('bottom navigation uses concrete image icons instead of text abbreviations', () => {
  const { page } = loadHomePage();
  page.setData({
    role: 'disabled',
    navItems: []
  });
  page.syncChrome('home');
  const disabledTabs = page.data.navItems;

  assert.equal(disabledTabs.length, 4);
  assert.deepEqual(disabledTabs.map((item) => item.key), ['home', 'sport', 'appointments', 'mine']);
  assert.ok(disabledTabs.every((item) => item.iconPath && item.activeIconPath));
  assert.ok(disabledTabs.every((item) => !/^[\u4e00-\u9fff]$/.test(item.icon || '')));

  page.setData({ role: 'volunteer', isVolunteer: true });
  page.syncChrome('home');
  const volunteerTabs = page.data.navItems;

  assert.deepEqual(volunteerTabs.map((item) => item.key), ['home', 'sport', 'training', 'appointments', 'mine']);
  assert.match(volunteerTabs.find((item) => item.key === 'training').iconPath, /graduation-cap\.svg$/);
});

test('runner orders are opened from mine instead of the bottom navigation', () => {
  const { page } = loadHomePage();
  page.setData({
    role: 'disabled',
    navItems: []
  });

  page.syncChrome('mine');
  assert.equal(page.data.activeTab, 'mine');
  assert.equal(page.data.headerTitle, '个人中心');
  assert.ok(page.data.navItems.find((item) => item.key === 'mine').active);
  assert.equal(page.data.navItems.some((item) => item.key === 'orders'), false);

  page.switchTab({
    currentTarget: {
      dataset: { key: 'orders' }
    }
  });

  assert.equal(page.data.activeTab, 'orders');
  assert.equal(page.data.headerTitle, '我的订单');
  assert.ok(page.data.navItems.find((item) => item.key === 'mine').active);
});

test('bottom navigation template renders image icons', () => {
  const homeWxml = fs.readFileSync(homePath.replace(/\.js$/, '.wxml'), 'utf8');
  const appWxss = fs.readFileSync(appWxssPath, 'utf8');

  assert.match(homeWxml, /<image[^>]+class="bottom-nav-icon-img"/);
  assert.doesNotMatch(homeWxml, /<view class="bottom-nav-icon">\{\{item\.icon\}\}<\/view>/);
  assert.match(appWxss, /\.bottom-nav-icon-img/);
});

test('mine page exposes a single orders entry point and the orders screen has one visible title', () => {
  const homeWxml = fs.readFileSync(homePath.replace(/\.js$/, '.wxml'), 'utf8');

  assert.match(homeWxml, /class="[^"]*mine-orders-entry[^"]*"[^>]+bindtap="switchTab"[^>]+data-key="orders"[^>]*>我的订单/);
  assert.doesNotMatch(homeWxml, /<text class="section-title">我的订单<\/text>/);
});

test('targeted form spacing classes are present for appointment, mine and runner publish forms', () => {
  const homeWxml = fs.readFileSync(homePath.replace(/\.js$/, '.wxml'), 'utf8');
  const appWxss = fs.readFileSync(appWxssPath, 'utf8');

  assert.match(homeWxml, /class="grid-2 appointment-form-row"/);
  assert.match(homeWxml, /class="field appointment-form-field"/);
  assert.match(homeWxml, /class="field mine-form-field"/);
  assert.match(homeWxml, /class="field runner-search-field"/);
  assert.match(homeWxml, /class="field runner-duration-field"/);
  assert.match(homeWxml, /class="field runner-departure-field"/);

  assert.match(appWxss, /\.appointment-form-row/);
  assert.match(appWxss, /\.appointment-form-field/);
  assert.match(appWxss, /\.mine-form-field/);
  assert.match(appWxss, /\.runner-search-field/);
  assert.match(appWxss, /\.runner-duration-field/);
  assert.match(appWxss, /\.runner-departure-field/);
});

test('runner interactions expose voice cues for screen readers', () => {
  const homeWxml = fs.readFileSync(homePath.replace(/\.js$/, '.wxml'), 'utf8');
  const homeJs = fs.readFileSync(homePath, 'utf8');
  const appWxss = fs.readFileSync(appWxssPath, 'utf8');

  assert.match(homeWxml, /aria-live="polite"[^>]*>\{\{voiceCue\}\}/);
  assert.match(homeWxml, /aria-label="发起一次陪跑"/);
  assert.match(homeWxml, /aria-label="起点搜索输入框"/);
  assert.match(homeWxml, /aria-label="选择起点地图位置"/);
  assert.match(homeWxml, /aria-label="选择志愿者"/);
  assert.match(homeWxml, /aria-label="确认发布陪跑需求"/);
  assert.match(homeWxml, /aria-label="我的订单"/);
  assert.match(homeJs, /announce\(/);
  assert.match(appWxss, /\.sr-voice/);
});

test('runner address selection and publishing update voice cue text', async () => {
  const captured = [];
  const { page, storage } = loadHomePage({
    wxOverrides: {
      cloud: {
        callFunction(options) {
          captured.push({ name: options.name, data: options.data });
          options.success({
            result: {
              success: true,
              order: {
                _id: 'order-voice',
                status: 'waiting',
                origin: options.data.origin,
                destination: options.data.destination,
                originAddress: options.data.origin.address,
                destinationAddress: options.data.destination.address,
                targetDistance: options.data.targetDistance,
                estimatedDuration: options.data.estimatedDuration
              }
            }
          });
        }
      }
    }
  });
  storage.set('blindrun.session.v1', {
    authToken: 'token',
    expiresAt: '2099-01-01T00:00:00.000Z',
    user: { userType: 'disabled' }
  });

  page.setEndpoint('start', {
    name: '徐汇区人民政府',
    address: '上海市徐汇区漕溪北路338号',
    detail: '上海市徐汇区漕溪北路338号',
    latitude: 31.1883,
    longitude: 121.4369
  });

  assert.match(page.data.voiceCue, /已选择起点：徐汇区人民政府/);

  page.setEndpoint('destination', {
    name: '新天地太平湖',
    address: '上海市黄浦区太仓路新天地太平湖',
    detail: '上海市黄浦区太仓路新天地太平湖',
    latitude: 31.2241,
    longitude: 121.4692
  });
  await page.publishRunnerOrder();

  assert.equal(captured.some((call) => call.name === 'handleOrder'), true);
  assert.equal(page.data.voiceCue, '已发布陪跑请求，正在为你匹配志愿者');
});

test('runner tap voice helper announces data voice labels', () => {
  const { page } = loadHomePage();
  page.setData({ isVolunteer: false });

  page.announceTap({ currentTarget: { dataset: { voice: '搜索地址' } } });

  assert.equal(page.data.voiceCue, '搜索地址');
});

test('runner voice helper does not emit debug logs during normal use', () => {
  const { page, storage } = loadHomePage();
  const logs = [];
  const originalInfo = console.info;
  console.info = (...args) => logs.push(args);

  try {
    page.setData({
      isVolunteer: false,
      role: 'disabled',
      activeTab: 'sport',
      headerTitle: '发起陪跑',
      voiceCue: '旧播报'
    });

    page.announceTap({ currentTarget: { dataset: { voice: '搜索地址', field: 'start' } } });
  } finally {
    console.info = originalInfo;
  }

  assert.equal(page.data.voiceCue, '搜索地址');
  assert.equal(logs.some(([prefix]) => prefix === '[voice-debug]'), false);
  assert.equal(storage.get('voice_debug_logs'), undefined);
});

test('volunteer announce remains silent without debug logs', () => {
  const { page, storage } = loadHomePage();
  const logs = [];
  const originalInfo = console.info;
  console.info = (...args) => logs.push(args);

  try {
    page.setData({
      isVolunteer: true,
      role: 'volunteer',
      activeTab: 'home',
      headerTitle: '向光奔跑',
      voiceCue: ''
    });

    page.announce('志愿者不播报');
  } finally {
    console.info = originalInfo;
  }

  assert.equal(page.data.voiceCue, '');
  assert.equal(logs.some(([prefix]) => prefix === '[voice-debug]'), false);
  assert.equal(storage.get('voice_debug_logs'), undefined);
});

test('runner announce plays generated TTS audio when the mini program plugin is available', () => {
  const played = [];
  const { page } = loadHomePage({
    wxOverrides: {
      createInnerAudioContext() {
        return {
          src: '',
          stop() {},
          play() {
            played.push(this.src);
          }
        };
      }
    }
  });
  let ttsRequest = null;
  global.requirePlugin = (name) => {
    assert.equal(name, 'WechatSI');
    return {
      textToSpeech(options) {
        ttsRequest = options;
        options.success({ filename: 'wxfile://voice-home.mp3' });
      }
    };
  };

  page.setData({ isVolunteer: false, role: 'disabled', activeTab: 'sport', headerTitle: '发起陪跑' });
  page.announce('打开起点地图选点');

  assert.equal(ttsRequest.lang, 'zh_CN');
  assert.equal(ttsRequest.tts, true);
  assert.equal(ttsRequest.content, '打开起点地图选点');
  assert.deepEqual(played, ['wxfile://voice-home.mp3']);
});

test('mini program declares the WechatSI plugin for text to speech', () => {
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

  assert.equal(appJson.plugins.WechatSI.provider, 'wx069ba97219f66d99');
  assert.ok(appJson.plugins.WechatSI.version);
});

test('runner visible buttons and inputs all expose voice cues', () => {
  const homeWxml = fs.readFileSync(homePath.replace(/\.js$/, '.wxml'), 'utf8');
  const homeJs = fs.readFileSync(homePath, 'utf8');

  [
    '个人中心',
    '刷新重试',
    '更改起点',
    '更改终点',
    '立即出发',
    '延后出发',
    '出发小时',
    '出发分钟',
    '取消请求',
    '刷新订单',
    '约跑日期',
    '约跑时间',
    '目标距离',
    '预计时长',
    '集合地点',
    '选择集合地点',
    '备注',
    '刷新约跑',
    '完成并评价',
    '取消约跑',
    '评价内容',
    '提交评价',
    '昵称',
    '真实姓名',
    '保存资料',
    '联系人姓名',
    '联系电话',
    '关系',
    '保存联系人',
    '退出登录'
  ].forEach((label) => {
    assert.match(homeWxml, new RegExp(`data-voice="${label}"|aria-label="${label}"`), `${label} should expose a voice label`);
  });

  assert.match(homeWxml, /bindfocus="announceInputFocus"/);
  assert.match(homeJs, /announceInputFocus/);
  assert.match(homeJs, /announceAppointmentPicker/);
  assert.match(homeJs, /announceMineInput/);
});

test('uncertified volunteers start in training before entering the home tab', () => {
  const { page, storage } = loadHomePage();
  storage.set('blindrun.session.v1', {
    authToken: 'token',
    expiresAt: '2099-01-01T00:00:00.000Z',
    user: {
      userType: 'volunteer',
      nickName: '志愿者',
      videoWatched: false,
      examPassed: false
    }
  });

  page.bootstrap();

  assert.equal(page.data.activeTab, 'training');
  assert.equal(page.data.headerTitle, '陪跑培训');
  assert.ok(page.data.navItems.find((item) => item.key === 'training').active);
});

test('volunteer exam renders one question at a time with round controls', () => {
  const homeWxml = fs.readFileSync(homePath.replace(/\.js$/, '.wxml'), 'utf8');
  const { page } = loadHomePage();
  page.setData({
    questions: [
      { _id: 'q1', question: '第一题', optionsView: [], selectedIndex: undefined },
      { _id: 'q2', question: '第二题', optionsView: [], selectedIndex: undefined }
    ],
    currentQuestionIndex: 0
  });

  page.nextExamQuestion();
  assert.equal(page.data.currentQuestionIndex, 1);
  page.prevExamQuestion();
  assert.equal(page.data.currentQuestionIndex, 0);

  assert.match(homeWxml, /currentQuestion/);
  assert.match(homeWxml, /exam-round-card/);
  assert.match(homeWxml, /上一题/);
  assert.match(homeWxml, /下一题/);
});
