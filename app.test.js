const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const appPath = path.resolve(__dirname, 'app.js');
const sessionPath = path.resolve(__dirname, 'utils/session.js');

function loadApp() {
  delete require.cache[appPath];
  delete require.cache[sessionPath];

  const appCalls = [];
  const pageCalls = [];
  const shareMenuCalls = [];

  global.wx = {
    cloud: {
      init() {}
    },
    getStorageSync() {
      return null;
    },
    removeStorageSync() {},
    showToast() {},
    showShareMenu(options) {
      shareMenuCalls.push(options);
    }
  };
  global.App = (definition) => {
    appCalls.push(definition);
  };
  global.Page = (definition) => {
    pageCalls.push(definition);
    return definition;
  };
  global.getApp = () => ({ globalData: {} });

  require(appPath);

  return { app: appCalls[0], pageCalls, shareMenuCalls };
}

test('app adds friend and timeline share handlers to pages by default', () => {
  const { pageCalls, shareMenuCalls } = loadApp();

  global.Page({
    onLoad() {}
  });
  const page = pageCalls[0];

  assert.equal(typeof page.onShareAppMessage, 'function');
  assert.equal(typeof page.onShareTimeline, 'function');
  assert.deepEqual(page.onShareAppMessage(), {
    title: '助盲跑｜让每一次陪伴都被看见',
    path: '/pages/home/home'
  });
  assert.deepEqual(page.onShareTimeline(), {
    title: '助盲跑｜用陪伴点亮每一段路',
    query: ''
  });

  page.onLoad();

  assert.deepEqual(shareMenuCalls[0], {
    withShareTicket: true,
    menus: ['shareAppMessage', 'shareTimeline']
  });
});

test('app falls back to default share content when page handlers return nothing', () => {
  const { pageCalls } = loadApp();

  global.Page({
    onShareAppMessage() {},
    onShareTimeline() {}
  });
  const page = pageCalls[0];

  assert.deepEqual(page.onShareAppMessage(), {
    title: '助盲跑｜让每一次陪伴都被看见',
    path: '/pages/home/home'
  });
  assert.deepEqual(page.onShareTimeline(), {
    title: '助盲跑｜用陪伴点亮每一段路',
    query: ''
  });
});

test('app keeps page-specific share content when it is provided', () => {
  const { pageCalls } = loadApp();

  global.Page({
    onShareAppMessage() {
      return {
        title: '我的志愿者证书',
        path: '/pages/certificate/certificate?id=cert-1'
      };
    },
    onShareTimeline() {
      return {
        title: '我在助盲跑完成了一次陪伴',
        query: 'id=cert-1'
      };
    }
  });
  const page = pageCalls[0];

  assert.deepEqual(page.onShareAppMessage(), {
    title: '我的志愿者证书',
    path: '/pages/certificate/certificate?id=cert-1'
  });
  assert.deepEqual(page.onShareTimeline(), {
    title: '我在助盲跑完成了一次陪伴',
    query: 'id=cert-1'
  });
});
