const session = require('./utils/session');

const SHARE_MENU_OPTIONS = {
  withShareTicket: true,
  menus: ['shareAppMessage', 'shareTimeline']
};

const DEFAULT_SHARE_MESSAGE = {
  title: '助盲跑｜让每一次陪伴都被看见',
  path: '/pages/home/home'
};

const DEFAULT_TIMELINE_SHARE = {
  title: '助盲跑｜用陪伴点亮每一段路',
  query: ''
};

function cloneShareConfig(config) {
  return { ...config };
}

function withDefaultShare(result, fallback) {
  if (result && typeof result === 'object') {
    return { ...fallback, ...result };
  }
  return cloneShareConfig(fallback);
}

function showShareMenu() {
  if (typeof wx === 'undefined' || typeof wx.showShareMenu !== 'function') return;
  wx.showShareMenu(cloneShareConfig(SHARE_MENU_OPTIONS));
}

function installShareDefaults() {
  if (typeof Page !== 'function' || Page.__blindRunShareDefaults) return;

  const originalPage = Page;
  const patchedPage = function patchedPage(definition = {}) {
    const originalOnLoad = definition.onLoad;
    const originalOnShow = definition.onShow;
    const originalShareAppMessage = definition.onShareAppMessage;
    const originalShareTimeline = definition.onShareTimeline;

    return originalPage({
      ...definition,
      onLoad(...args) {
        showShareMenu();
        if (typeof originalOnLoad === 'function') {
          return originalOnLoad.apply(this, args);
        }
      },
      onShow(...args) {
        showShareMenu();
        if (typeof originalOnShow === 'function') {
          return originalOnShow.apply(this, args);
        }
      },
      onShareAppMessage(...args) {
        if (typeof originalShareAppMessage === 'function') {
          return withDefaultShare(
            originalShareAppMessage.apply(this, args),
            DEFAULT_SHARE_MESSAGE
          );
        }
        return cloneShareConfig(DEFAULT_SHARE_MESSAGE);
      },
      onShareTimeline(...args) {
        if (typeof originalShareTimeline === 'function') {
          return withDefaultShare(
            originalShareTimeline.apply(this, args),
            DEFAULT_TIMELINE_SHARE
          );
        }
        return cloneShareConfig(DEFAULT_TIMELINE_SHARE);
      }
    });
  };

  patchedPage.__blindRunShareDefaults = true;
  Page = patchedPage;
}

installShareDefaults();

if (!wx.cloud) {
  console.error('请使用 2.2.3 或以上基础库以使用云能力');
  wx.showToast({ title: '请使用最新微信版本', icon: 'none' });
} else {
  wx.cloud.init({
    env: 'cloud1-d8gbfzr7t6c5dc8bc',
    traceUser: true
  });
}

App({
  globalData: {
    session: null,
    userInfo: null
  },

  onLaunch() {
    const current = session.getSession();
    if (current) {
      this.globalData.session = current;
      this.globalData.userInfo = current.user;
    }
  }
});
