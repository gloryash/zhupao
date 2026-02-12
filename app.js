// app.js

// ⚠️ 请先在微信开发者工具中开通云开发！
// 开通步骤：
// 1. 点击左侧菜单的"云开发"
// 2. 点击"开通"按钮
// 3. 创建环境，记录环境 ID
// 4. 将下方的 'blind-run-test-xxxx' 替换为你的环境 ID

// 初始化云开发
if (!wx.cloud) {
  console.error('请使用 2.2.3 或以上的基础库以使用云能力');
  wx.showToast({
    title: '请使用最新微信版本',
    icon: 'none'
  });
} else {
  // TODO: 将 'blind-run-test-xxxx' 替换为你的云开发环境 ID
  wx.cloud.init({
    env: 'blind-run-test-xxxx',  // ⚠️ 请替换为你的环境 ID
    traceUser: true
  });
}

// 段位体系配置
const TIER_SYSTEM = {
  volunteer: [
    { level: 1, name: '启明之星', icon: '🌟', minRuns: 0, color: '#CD7F32', description: '初入跑道的爱心新星' },
    { level: 2, name: '破晓勇士', icon: '🌅', minRuns: 5, color: '#C0C0C0', description: '用奔跑点亮希望的曙光' },
    { level: 3, name: '烈阳守护', icon: '☀️', minRuns: 15, color: '#FFD700', description: '温暖每一位跑者的心' },
    { level: 4, name: '领跑天使', icon: '👼', minRuns: 30, color: '#E6E6FA', description: '奔跑在人间的天使' }
  ],
  disabled: [
    { level: 1, name: '初心跑者', icon: '🎯', minRuns: 0, color: '#CD7F32', description: '踏出第一步的勇气' },
    { level: 2, name: '疾风跑者', icon: '💨', minRuns: 5, color: '#C0C0C0', description: '在风中自由奔跑' },
    { level: 3, name: '极速护卫', icon: '⚡', minRuns: 15, color: '#FFD700', description: '速度与勇气并存' },
    { level: 4, name: '光明统帅', icon: '🌟', minRuns: 30, color: '#E6E6FA', description: '成为黑暗中的光' }
  ]
};

// 积分与经验值规则
const POINTS_SYSTEM = {
  volunteer: {
    perRun: { points: 10, exp: 50 },
    perFeedback: { exp: 20 }
  },
  disabled: {
    perRun: { exp: 30 },
    consecutiveCheckIn: { exp: 50, days: 3 }
  }
};

App({
  globalData: {
    isNeedLighted: false, // 信号灯：是否有点亮需求
    userLocation: null,    // 坐标仓库
    tierSystem: TIER_SYSTEM, // 段位体系
    pointsSystem: POINTS_SYSTEM, // 积分体系
    userInfo: null, // 用户信息
    scanCodeData: null // 扫码数据
  },

  /**
   * 计算用户段位
   * @param {string} userType - 用户类型 'volunteer' 或 'disabled'
   * @param {number} totalRuns - 累计陪跑/跑步次数
   * @returns {object} 段位信息
   */
  calculateTier(userType, totalRuns) {
    const tiers = TIER_SYSTEM[userType] || TIER_SYSTEM.disabled;
    // 从最高级开始匹配，找到第一个满足条件的段位
    for (let i = tiers.length - 1; i >= 0; i--) {
      if (totalRuns >= tiers[i].minRuns) {
        return {
          ...tiers[i],
          currentRuns: totalRuns,
          nextLevelRuns: tiers[i + 1] ? tiers[i + 1].minRuns : null,
          progress: tiers[i + 1]
            ? Math.round((totalRuns - tiers[i].minRuns) / (tiers[i + 1].minRuns - tiers[i].minRuns) * 100)
            : 100
        };
      }
    }
    // 默认返回第一级
    return {
      ...tiers[0],
      currentRuns: totalRuns,
      nextLevelRuns: tiers[1] ? tiers[1].minRuns : null,
      progress: tiers[1]
        ? Math.round(totalRuns / tiers[1].minRuns * 100)
        : 100
    };
  },

  /**
   * 获取用户积分和经验值
   * @param {string} userType - 用户类型
   * @returns {object} { points, exp, checkInDays, lastCheckInDate }
   */
  getUserStats(userType) {
    const storageKey = `userStats_${userType}`;
    const stats = wx.getStorageSync(storageKey) || {
      points: 0,
      exp: 0,
      checkInDays: 0,
      lastCheckInDate: ''
    };
    return stats;
  },

  /**
   * 保存用户积分和经验值
   * @param {string} userType - 用户类型
   * @param {object} stats - 积分和经验值数据
   */
  saveUserStats(userType, stats) {
    const storageKey = `userStats_${userType}`;
    wx.setStorageSync(storageKey, stats);
  },

  /**
   * 添加积分和经验值
   * @param {string} userType - 用户类型 'volunteer' 或 'disabled'
   * @param {string} type - 获得类型 'run' | 'feedback' | 'checkin'
   * @returns {object} 获得的内容 { points, exp, message }
   */
  addPointsAndExp(userType, type) {
    const rules = POINTS_SYSTEM[userType];
    if (!rules) return { points: 0, exp: 0, message: '' };

    const stats = this.getUserStats(userType);
    let earned = { points: 0, exp: 0, message: '' };

    switch (type) {
      case 'run':
        // 完成陪跑
        earned.points = rules.perRun ? rules.perRun.points : 0;
        earned.exp = rules.perRun ? rules.perRun.exp : 0;
        earned.message = `完成陪跑！+${earned.exp}经验，+${earned.points}积分`;
        break;
      case 'feedback':
        // 获得好评
        earned.exp = rules.perFeedback ? rules.perFeedback.exp : 0;
        earned.message = `获得好评！+${earned.exp}经验`;
        break;
      case 'checkin':
        // 每日打卡
        earned = this.handleCheckIn(stats, userType);
        break;
    }

    // 更新数据
    stats.points += earned.points;
    stats.exp += earned.exp;

    // 连续打卡已在 handleCheckIn 中更新
    if (type !== 'checkin') {
      this.saveUserStats(userType, stats);
    }

    return earned;
  },

  /**
   * 处理每日打卡（包含连续三天奖励）
   * @param {object} stats - 用户数据
   * @param {string} userType - 用户类型
   * @returns {object} 打卡结果
   */
  handleCheckIn(stats, userType) {
    const today = new Date().toLocaleDateString();
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString();

    let earned = { points: 0, exp: 5, message: '打卡成功！+5经验' }; // 基础打卡奖励

    if (stats.lastCheckInDate === yesterday) {
      // 连续第二天
      stats.checkInDays = 2;
    } else if (stats.lastCheckInDate === today) {
      // 今日已打卡
      return { points: 0, exp: 0, message: '今日已打卡' };
    } else if (stats.lastCheckInDate !== yesterday && stats.lastCheckInDate !== '') {
      // 中断了，重新开始
      stats.checkInDays = 1;
    } else {
      // 第一次打卡
      stats.checkInDays = 1;
    }

    // 检查连续三天奖励（仅视障人士有此奖励）
    const disabledRules = POINTS_SYSTEM.disabled;
    if (disabledRules && disabledRules.consecutiveCheckIn && disabledRules.consecutiveCheckIn.days === 3 && stats.checkInDays >= 3) {
      const bonusExp = disabledRules.consecutiveCheckIn.exp;
      earned.exp += bonusExp;
      earned.message = `连续打卡3天！+${earned.exp}经验`;
      stats.checkInDays = 0; // 重置连续天数
    }

    stats.lastCheckInDate = today;
    this.saveUserStats(userType, stats);

    return earned;
  },

  /**
   * 消费积分
   * @param {string} userType - 用户类型
   * @param {number} amount - 消费积分数量
   * @returns {boolean} 是否成功
   */
  spendPoints(userType, amount) {
    const stats = this.getUserStats(userType);

    if (stats.points < amount) {
      return false;
    }

    stats.points -= amount;
    this.saveUserStats(userType, stats);
    return true;
  },

  onLaunch() {
    // 小程序启动时的逻辑判断
  },

  onShow(options) {
    // 检查扫码参数
    this.handleScanCode(options);
    // 检查登录状态
    this.checkLoginStatus();
  },

  /**
   * 处理扫码进入的小程序
   * @param {object} options - onShow 的 options 参数
   */
  handleScanCode(options) {
    // 从 scene 中获取扫码参数
    let scene = decodeURIComponent(options.scene || '');

    // 如果没有 scene，尝试从 queryString 获取
    if (!scene && options.query) {
      scene = options.query.scene || '';
    }

    if (scene) {
      // 扫码进入，保存扫码数据
      console.log('扫码进入，参数:', scene);
      this.globalData.scanCodeData = scene;

      // 解析扫码参数
      this.parseScanData(scene);
    }
  },

  /**
   * 解析扫码数据
   * @param {string} scanData - 扫码参数
   */
  parseScanData(scanData) {
    try {
      // 尝试解析为 JSON
      let data = JSON.parse(scanData);

      // 如果是用户二维码，查找对应的用户
      if (data.type === 'user_qr' && data.token) {
        this.matchUserByToken(data.token);
      }
    } catch (e) {
      // 如果不是 JSON，可能是直接的用户 token
      this.matchUserByToken(scanData);
    }
  },

  /**
   * 根据 token 匹配用户
   * @param {string} token - 用户 token
   */
  matchUserByToken(token) {
    // 查找所有已注册用户，看是否有匹配的 token
    const allUsers = this.getAllUsers();

    for (let i = 0; i < allUsers.length; i++) {
      const userType = allUsers[i];
      const userInfo = wx.getStorageSync(`userInfo_${userType}`);

      if (userInfo && userInfo.token === token) {
        console.log('找到匹配用户:', userType);

        // 设置当前用户
        wx.setStorageSync('currentUserType', userType);
        wx.setStorageSync('isRegistered', true);
        wx.setStorageSync('isLoggedIn', true);
        this.globalData.userInfo = userInfo;

        // 跳转到首页
        wx.reLaunch({
          url: '/pages/home/home',
          success: () => {
            wx.showToast({
              title: '登录成功',
              icon: 'success',
              duration: 1500
            });
          }
        });

        return true;
      }
    }

    // 未找到匹配用户，可能是新用户扫码
    console.log('未找到匹配用户');
    return false;
  },

  /**
   * 获取所有已注册用户类型
   * @returns {Array} 用户类型数组
   */
  getAllUsers() {
    const users = [];
    if (wx.getStorageSync('isRegistered_disabled')) {
      users.push('disabled');
    }
    if (wx.getStorageSync('isRegistered_volunteer')) {
      users.push('volunteer');
    }
    return users;
  },

  /**
   * 检查登录状态并跳转
   */
  checkLoginStatus() {
    const isLoggedIn = wx.getStorageSync('isLoggedIn');
    const isRegistered = wx.getStorageSync('isRegistered');
    const currentUserType = wx.getStorageSync('currentUserType');

    if (!isLoggedIn || !currentUserType) {
      // 未登录，跳转到登录页
      wx.reLaunch({
        url: '/pages/login/login'
      });
      return;
    }

    // 已登录用户，直接进入首页
    wx.reLaunch({
      url: '/pages/home/home'
    });
  },

  /**
   * 用户扫码登录
   * @param {string} qrToken - 二维码 token
   * @returns {Promise<boolean>} 是否登录成功
   */
  loginByQRCode(qrToken) {
    return new Promise((resolve) => {
      // 查找匹配的志愿者用户
      const allUsers = this.getAllUsers();

      for (let i = 0; i < allUsers.length; i++) {
        const userType = allUsers[i];
        const userInfo = wx.getStorageSync(`userInfo_${userType}`);

        if (userInfo && userInfo.token === qrToken) {
          // 匹配成功
          wx.setStorageSync('currentUserType', userType);
          this.globalData.userInfo = userInfo;

          resolve(true);
          return true;
        }
      }

      // 未匹配到用户
      resolve(false);
    });
  },

  // ==================== 云开发相关方法 ====================

  /**
   * 调用云函数
   * @param {string} name - 云函数名称
   * @param {object} data - 传递的数据
   * @returns {Promise} 云函数返回结果
   */
  callCloudFunction(name, data = {}) {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: name,
        data: data,
        success: (res) => {
          if (res.result && res.result.success) {
            resolve(res.result);
          } else {
            reject(res.result?.error || '调用失败');
          }
        },
        fail: (err) => {
          console.error(`云函数 ${name} 调用失败:`, err);
          reject(err);
        }
      });
    });
  },

  /**
   * 同步用户信息到云端
   * @param {object} userInfo - 用户信息
   * @param {string} userType - 用户类型
   * @returns {Promise} 返回用户数据
   */
  async syncUserToCloud(userInfo, userType) {
    try {
      const result = await this.callCloudFunction('syncUserInfo', {
        userInfo: userInfo,
        userType: userType
      });

      if (result.success) {
        return result.user;
      }
      throw new Error(result.error);
    } catch (err) {
      console.error('同步用户信息失败:', err);
      throw err;
    }
  },

  /**
   * 发布订单
   * @param {object} orderData - 订单数据
   * @returns {Promise} 返回订单结果
   */
  async publishOrder(orderData) {
    try {
      const result = await this.callCloudFunction('handleOrder', {
        action: 'publish',
        ...orderData
      });
      return result;
    } catch (err) {
      console.error('发布订单失败:', err);
      throw err;
    }
  },

  /**
   * 接单
   * @param {string} orderId - 订单ID
   * @returns {Promise} 返回接单结果
   */
  async acceptOrder(orderId) {
    try {
      const result = await this.callCloudFunction('handleOrder', {
        action: 'accept',
        orderId: orderId
      });
      return result;
    } catch (err) {
      console.error('接单失败:', err);
      throw err;
    }
  },

  /**
   * 取消订单
   * @param {string} orderId - 订单ID
   * @returns {Promise}
   */
  async cancelOrder(orderId) {
    try {
      const result = await this.callCloudFunction('handleOrder', {
        action: 'cancel',
        orderId: orderId
      });
      return result;
    } catch (err) {
      console.error('取消订单失败:', err);
      throw err;
    }
  },

  /**
   * 完成订单
   * @param {string} orderId - 订单ID
   * @param {object} data - 完成数据
   * @returns {Promise}
   */
  async completeOrder(orderId, data = {}) {
    try {
      const result = await this.callCloudFunction('handleOrder', {
        action: 'complete',
        orderId: orderId,
        ...data
      });
      return result;
    } catch (err) {
      console.error('完成订单失败:', err);
      throw err;
    }
  },

  /**
   * 监听订单状态变化（实时推送）
   * @param {function} callback - 回调函数
   * @returns {function} 取消监听的函数
   */
  watchOrderStatus(callback) {
    const db = wx.cloud.database();
    const watcher = db.collection('orders')
      .where({
        _openid: '{openid}' // 监听当前用户的订单
      })
      .orderBy('createdAt', 'desc')
      .watch({
        onChange: (snapshot) => {
          callback(snapshot);
        },
        onError: (err) => {
          console.error('监听订单失败:', err);
        }
      });

    // 返回取消监听的函数
    return () => {
      watcher.close();
    };
  },

  /**
   * 监听所有新订单（志愿者端使用）
   * @param {function} callback - 回调函数
   * @returns {function} 取消监听的函数
   */
  watchAllOrders(callback) {
    const db = wx.cloud.database();
    const watcher = db.collection('orders')
      .where({
        status: 'waiting' // 只监听等待中的订单
      })
      .orderBy('createdAt', 'desc')
      .watch({
        onChange: (snapshot) => {
          callback(snapshot);
        },
        onError: (err) => {
          console.error('监听订单失败:', err);
        }
      });

    return () => {
      watcher.close();
    };
  },

  /**
   * 初始化数据库（管理员调用一次即可）
   */
  async initDatabase() {
    try {
      const result = await this.callCloudFunction('initDB');
      return result;
    } catch (err) {
      console.error('初始化数据库失败:', err);
      throw err;
    }
  },

  // ==================== 商城相关方法 ====================

  async getProducts(category) {
    return await this.callCloudFunction('handleShop', {
      action: 'getProducts',
      category: category || 'all'
    });
  },

  async getExchangeOrders(status) {
    return await this.callCloudFunction('handleShop', {
      action: 'getExchangeOrders',
      status: status || 'all'
    });
  },

  // ==================== 跑友圈相关方法 ====================

  async getPosts(page) {
    return await this.callCloudFunction('handleCircle', {
      action: 'getPosts',
      page: page || 1
    });
  },

  async createPost(content, images) {
    return await this.callCloudFunction('handleCircle', {
      action: 'createPost',
      content: content,
      images: images || []
    });
  },

  async likePost(postId) {
    return await this.callCloudFunction('handleCircle', {
      action: 'likePost',
      postId: postId
    });
  },

  async addComment(postId, content) {
    return await this.callCloudFunction('handleCircle', {
      action: 'addComment',
      postId: postId,
      content: content
    });
  },

  async deletePost(postId) {
    return await this.callCloudFunction('handleCircle', {
      action: 'deletePost',
      postId: postId
    });
  },

  // ==================== 运动记录相关方法 ====================

  async saveSportRecord(recordData) {
    return await this.callCloudFunction('handleRecord', {
      action: 'saveSportRecord',
      ...recordData
    });
  },

  async getSportRecords(page, date) {
    return await this.callCloudFunction('handleRecord', {
      action: 'getSportRecords',
      page: page || 1,
      date: date
    });
  },

  async saveCompanionRecord(recordData) {
    return await this.callCloudFunction('handleRecord', {
      action: 'saveCompanionRecord',
      ...recordData
    });
  },

  async getCompanionRecords(page) {
    return await this.callCloudFunction('handleRecord', {
      action: 'getCompanionRecords',
      page: page || 1
    });
  },

  async deleteRecords(recordIds, deleteAll) {
    return await this.callCloudFunction('handleRecord', {
      action: 'deleteRecords',
      recordIds: recordIds,
      deleteAll: deleteAll || false
    });
  },

  async getTodayStats() {
    return await this.callCloudFunction('handleRecord', {
      action: 'getTodayStats'
    });
  },

  // ==================== 培训相关方法 ====================

  async getExamQuestions() {
    return await this.callCloudFunction('handleTraining', {
      action: 'getExamQuestions'
    });
  },

  async submitExam(answers) {
    return await this.callCloudFunction('handleTraining', {
      action: 'submitExam',
      answers: answers
    });
  },

  async getCertificate() {
    return await this.callCloudFunction('handleTraining', {
      action: 'getCertificate'
    });
  },

  async verifyCertificate(certificateNo) {
    return await this.callCloudFunction('handleTraining', {
      action: 'verifyCertificate',
      certificateNo: certificateNo
    });
  },

  async updateVideoWatched() {
    return await this.callCloudFunction('handleTraining', {
      action: 'updateVideoWatched'
    });
  },

  async getTrainingStatus() {
    return await this.callCloudFunction('handleTraining', {
      action: 'getTrainingStatus'
    });
  },

  // ==================== 日程相关方法 ====================

  async getAppointments(status) {
    return await this.callCloudFunction('handleSchedule', {
      action: 'getAppointments',
      status: status || 'all'
    });
  },

  async createAppointment(appointmentData) {
    return await this.callCloudFunction('handleSchedule', {
      action: 'createAppointment',
      ...appointmentData
    });
  },

  async cancelAppointment(appointmentId) {
    return await this.callCloudFunction('handleSchedule', {
      action: 'cancelAppointment',
      appointmentId: appointmentId
    });
  },

  async getAppointmentsByDate(date) {
    return await this.callCloudFunction('handleSchedule', {
      action: 'getAppointmentsByDate',
      date: date
    });
  },

  // ==================== 志愿者相关方法 ====================

  async getVolunteers(page) {
    return await this.callCloudFunction('handleVolunteer', {
      action: 'getVolunteers',
      page: page || 1
    });
  },

  async getAvailableVolunteers(latitude, longitude, radius) {
    return await this.callCloudFunction('handleVolunteer', {
      action: 'getAvailableVolunteers',
      latitude: latitude,
      longitude: longitude,
      radius: radius || 5000
    });
  },

  async updateVolunteerAvailability(isAvailable, latitude, longitude) {
    return await this.callCloudFunction('handleVolunteer', {
      action: 'updateAvailability',
      isAvailable: isAvailable,
      latitude: latitude,
      longitude: longitude
    });
  },

  async getFrequentContacts(limit) {
    return await this.callCloudFunction('handleVolunteer', {
      action: 'getFrequentContacts',
      limit: limit || 10
    });
  },

  // ==================== 用户相关方法 ====================

  async getUserProfile() {
    return await this.callCloudFunction('handleUser', {
      action: 'getUserProfile'
    });
  },

  async updateUserProfile(profileData) {
    return await this.callCloudFunction('handleUser', {
      action: 'updateProfile',
      ...profileData
    });
  },

  async updateEmergencyContact(contactData) {
    return await this.callCloudFunction('handleUser', {
      action: 'updateEmergencyContact',
      ...contactData
    });
  },

  async getEmergencyContact() {
    return await this.callCloudFunction('handleUser', {
      action: 'getEmergencyContact'
    });
  },

  async getCloudUserStats() {
    return await this.callCloudFunction('handleUser', {
      action: 'getUserStats'
    });
  },

  async updateUserLocation(latitude, longitude) {
    return await this.callCloudFunction('handleUser', {
      action: 'updateLocation',
      latitude: latitude,
      longitude: longitude
    });
  },

  // ==================== 积分云端方法 ====================

  async cloudCheckIn() {
    return await this.callCloudFunction('updatePoints', {
      action: 'checkIn'
    });
  },

  async cloudExchange(productId, productName, productPrice) {
    return await this.callCloudFunction('updatePoints', {
      action: 'exchange',
      productId: productId,
      productName: productName,
      productPrice: productPrice
    });
  },

  async cloudFeedback(rating) {
    return await this.callCloudFunction('updatePoints', {
      action: 'feedback',
      rating: rating
    });
  }
})
