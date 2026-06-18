const STORAGE_KEY = 'blindrun.session.v1';

function now() {
  return Date.now();
}

function readRaw() {
  try {
    return wx.getStorageSync(STORAGE_KEY) || null;
  } catch (err) {
    return null;
  }
}

function normalize(raw) {
  if (!raw || !raw.authToken || !raw.user) return null;
  if (raw.expiresAt && new Date(raw.expiresAt).getTime() <= now()) return null;
  return raw;
}

function getSession() {
  const session = normalize(readRaw());
  if (!session) clearSession();
  return session;
}

function getToken() {
  const current = getSession();
  return current ? current.authToken || '' : '';
}

function getUser() {
  const current = getSession();
  return current ? current.user || null : null;
}

function applySession(session) {
  const next = {
    authToken: session.authToken,
    expiresAt: session.expiresAt || '',
    user: session.user
  };
  wx.setStorageSync(STORAGE_KEY, next);
  const app = getApp({ allowDefault: true });
  if (app && app.globalData) {
    app.globalData.session = next;
    app.globalData.userInfo = next.user;
  }
  return next;
}

function updateUser(user) {
  const session = getSession();
  if (!session) return null;
  const next = { ...session, user };
  wx.setStorageSync(STORAGE_KEY, next);
  const app = getApp({ allowDefault: true });
  if (app && app.globalData) {
    app.globalData.session = next;
    app.globalData.userInfo = user;
  }
  return next;
}

function clearSession() {
  try {
    wx.removeStorageSync(STORAGE_KEY);
  } catch (err) {
    /* noop */
  }
  const app = getApp({ allowDefault: true });
  if (app && app.globalData) {
    app.globalData.session = null;
    app.globalData.userInfo = null;
  }
}

function requireSession() {
  const session = getSession();
  if (session) return session;
  wx.reLaunch({ url: '/pages/login/login' });
  return null;
}

module.exports = {
  STORAGE_KEY,
  getSession,
  getToken,
  getUser,
  applySession,
  updateUser,
  clearSession,
  requireSession
};
