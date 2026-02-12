/**
 * API请求封装工具
 * 统一处理请求、响应、错误
 */

const app = getApp();

/**
 * 发起HTTP请求
 * @param {Object} options - 请求配置
 * @param {String} options.url - 请求路径（相对路径，会自动拼接baseUrl）
 * @param {String} options.method - 请求方法，默认GET
 * @param {Object} options.data - 请求参数
 * @param {Boolean} options.needAuth - 是否需要token认证，默认true
 * @returns {Promise}
 */
function request(options) {
  return new Promise((resolve, reject) => {
    // 获取全局配置
    const baseUrl = app.globalData.baseUrl;
    const token = app.globalData.token;

    // 构建完整URL
    const fullUrl = baseUrl + options.url;

    // 构建请求头
    const header = {
      'Content-Type': 'application/json'
    };

    // 如果需要认证，添加token
    if (options.needAuth !== false && token) {
      header['Authorization'] = 'Bearer ' + token;
    }

    // 显示加载提示
    wx.showLoading({
      title: '加载中...',
      mask: true
    });

    // 发起请求
    wx.request({
      url: fullUrl,
      method: options.method || 'GET',
      data: options.data || {},
      header: header,
      success: (res) => {
        wx.hideLoading();

        // 请求成功
        if (res.statusCode === 200) {
          // 业务成功
          if (res.data.code === 0 || res.data.success) {
            resolve(res.data);
          } else {
            // 业务失败
            wx.showToast({
              title: res.data.message || '操作失败',
              icon: 'none',
              duration: 2000
            });
            reject(res.data);
          }
        } else if (res.statusCode === 401) {
          // 未授权，清除登录信息，跳转到登录页
          wx.showToast({
            title: '登录已过期，请重新登录',
            icon: 'none',
            duration: 2000
          });
          app.clearLoginInfo();
          setTimeout(() => {
            wx.redirectTo({
              url: '/pages/login/login'
            });
          }, 2000);
          reject(res.data);
        } else {
          // 其他错误
          wx.showToast({
            title: '网络错误，请稍后重试',
            icon: 'none',
            duration: 2000
          });
          reject(res.data);
        }
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({
          title: '网络连接失败',
          icon: 'none',
          duration: 2000
        });
        reject(err);
      }
    });
  });
}

/**
 * API接口定义
 */
const api = {
  /**
   * 用户登录
   * @param {Object} data
   * @param {String} data.code - 微信登录code
   * @param {String} data.role - 用户角色：'blind' 或 'volunteer'
   * @param {String} data.nickName - 用户昵称
   * @param {String} data.avatarUrl - 用户头像
   * @returns {Promise}
   */
  login(data) {
    return request({
      url: '/user/login',
      method: 'POST',
      data: data,
      needAuth: false
    });
  },

  /**
   * 发布需求（视障用户）
   * @param {Object} data
   * @param {String} data.type - 需求类型：'run'跑步, 'guide'导盲, 'other'其他
   * @param {Number} data.latitude - 纬度
   * @param {Number} data.longitude - 经度
   * @param {String} data.address - 详细地址
   * @param {String} data.description - 需求描述（可选）
   * @returns {Promise}
   */
  publishNeed(data) {
    return request({
      url: '/need/publish',
      method: 'POST',
      data: data
    });
  },

  /**
   * 获取附近需求列表（志愿者）
   * @param {Object} data
   * @param {Number} data.latitude - 当前纬度
   * @param {Number} data.longitude - 当前经度
   * @param {Number} data.radius - 搜索半径（米），默认5000
   * @returns {Promise}
   */
  getNearbyNeeds(data) {
    return request({
      url: '/need/nearby',
      method: 'GET',
      data: data
    });
  },

  /**
   * 接单（志愿者）
   * @param {Object} data
   * @param {String} data.needId - 需求ID
   * @returns {Promise}
   */
  takeOrder(data) {
    return request({
      url: '/order/take',
      method: 'POST',
      data: data
    });
  }
};

module.exports = {
  request,
  api
};
