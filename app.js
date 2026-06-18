const session = require('./utils/session');

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
