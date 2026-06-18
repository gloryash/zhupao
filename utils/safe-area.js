function readWindowInfo() {
  try {
    if (wx.getWindowInfo) return wx.getWindowInfo();
    return wx.getSystemInfoSync ? wx.getSystemInfoSync() : {};
  } catch (err) {
    return {};
  }
}

function getSafeArea() {
  const info = readWindowInfo();
  const screenHeight = Number(info.screenHeight || info.windowHeight || 0);
  const safeArea = info.safeArea || {};
  const safeBottom = screenHeight && safeArea.bottom ? Math.max(0, screenHeight - safeArea.bottom) : 0;
  const statusBarHeight = Math.max(0, Number(info.statusBarHeight || 0));
  return { statusBarHeight, safeBottom };
}

function getSafeAreaStyle() {
  const area = getSafeArea();
  return `--status-bar-height: ${area.statusBarHeight}px; --safe-bottom: ${area.safeBottom}px;`;
}

module.exports = {
  getSafeArea,
  getSafeAreaStyle
};
