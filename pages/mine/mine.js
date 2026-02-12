const app = getApp();

Page({
  data: {
    userInfo: null,
    userType: 'disabled',
    userName: '',
    tier: null,
    stats: {
      totalRuns: 0,
      totalDistance: 0,
      totalTime: 0
    },
    userPoints: 0,
    userExp: 0,
    monthlyData: [],
    // 任务流程状态
    taskFlow: {
      resumeCompleted: false,      // 简历填写
      videoCompleted: false,        // 观看教程
      examPassed: false,          // 通过考试
      certificateObtained: false    // 获得证书
    },
    // 所有任务是否完成
    allTasksCompleted: false
  },

  onLoad() {
    this.loadUserInfo();
  },

  onShow() {
    this.loadUserInfo();
  },

  /**
   * 加载用户信息
   */
  loadUserInfo() {
    const currentUserType = wx.getStorageSync('currentUserType') || 'disabled';
    const storageKey = `userInfo_${currentUserType}`;
    const userInfo = wx.getStorageSync(storageKey);

    // 加载统计数据
    const records = wx.getStorageSync('sport_records') || [];
    const monthlyData = this.calculateMonthlyData(records);

    // 计算统计数据
    const totalDistance = records.reduce((sum, r) => sum + (r.distance || 0), 0);
    const totalTime = records.reduce((sum, r) => sum + (r.duration || 0), 0);
    const totalRuns = records.length;

    // 加载积分和经验值
    const userStats = app.getUserStats(currentUserType);

    // 计算段位
    const tier = app.calculateTier(currentUserType, totalRuns);

    // 计算任务流程状态
    const taskFlow = this.calculateTaskFlow(currentUserType, userInfo);

    this.setData({
      userInfo: userInfo || {},
      userType: currentUserType,
      userName: (userInfo && userInfo.name) ? userInfo.name : '用户',
      tier: tier,
      stats: {
        totalRuns,
        totalDistance: totalDistance.toFixed(1),
        totalTime: (totalTime / 60).toFixed(1)
      },
      userPoints: userStats.points || 0,
      userExp: userStats.exp || 0,
      monthlyData: monthlyData,
      taskFlow: taskFlow,
      allTasksCompleted: taskFlow.resumeCompleted && taskFlow.examPassed
    });
  },

  /**
   * 计算任务流程状态
   */
  calculateTaskFlow(userType, userInfo) {
    const taskFlow = {
      resumeCompleted: false,
      videoCompleted: false,
      examPassed: false,
      certificateObtained: false
    };

    if (userType === 'disabled') {
      // 视障人士只需要填写简历
      taskFlow.resumeCompleted = !!(
        userInfo && userInfo.name &&
        userInfo.emergencyPhone && userInfo.runningLocation
      );
      taskFlow.certificateObtained = taskFlow.resumeCompleted;
    } else {
      // 志愿者需要完成所有流程
      taskFlow.resumeCompleted = !!(
        userInfo && userInfo.name &&
        userInfo.runningYears && userInfo.pace
      );
      taskFlow.videoCompleted = true; // 开发模式下跳过视频
      taskFlow.examPassed = wx.getStorageSync('exam_passed') || false;
      taskFlow.certificateObtained = taskFlow.examPassed;
    }

    return taskFlow;
  },

  /**
   * 计算月度数据
   */
  calculateMonthlyData(records) {
    const months = {};
    const today = new Date();

    // 最近6个月
    for (let i = 5; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      months[key] = {
        month: key,
        distance: 0,
        time: 0,
        runs: 0
      };
    }

    // 统计每月数据
    records.forEach(record => {
      const date = new Date(record.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (months[key]) {
        months[key].distance += record.distance || 0;
        months[key].time += record.duration || 0;
        months[key].runs += 1;
      }
    });

    return Object.values(months);
  },

  /**
   * 跳转到任务（根据当前状态）
   */
  goToNextTask() {
    const { userType, taskFlow } = this.data;

    if (userType === 'disabled') {
      // 视障人士跳转到个人信息
      wx.navigateTo({
        url: '/pages/user-info/user-info'
      });
      return;
    }

    // 志愿者任务流程
    if (!taskFlow.resumeCompleted) {
      // 跳转到填写简历
      wx.navigateTo({
        url: '/pages/user-info/user-info?userType=volunteer'
      });
    } else if (!taskFlow.videoCompleted) {
      // 跳转到培训教程
      wx.navigateTo({
        url: '/pages/training-flow/training-flow'
      });
    } else if (!taskFlow.examPassed) {
      // 跳转到考试
      wx.navigateTo({
        url: '/pages/training-flow/training-flow'
      });
    } else {
      // 跳转到证书
      wx.navigateTo({
        url: '/pages/certificate/certificate'
      });
    }
  },

  /**
   * 跳转到个人信息
   */
  goToProfile() {
    wx.navigateTo({
      url: '/pages/user-info/user-info'
    });
  },

  /**
   * 跳转到证书页面
   */
  goToCertificate() {
    wx.navigateTo({
      url: '/pages/certificate/certificate'
    });
  },

  /**
   * 跳转到培训教程
   */
  goToTraining() {
    wx.navigateTo({
      url: '/pages/training-flow/training-flow'
    });
  },

  /**
   * 跳转到经常联系的盲人页面
   */
  goToFrequentlyContacted() {
    wx.navigateTo({
      url: '/pages/frequently-contacted/frequently-contacted'
    });
  },

  /**
   * 跳转到跑步历史
   */
  goToRecords() {
    wx.navigateTo({
      url: '/pages/records-manage/records-manage'
    });
  },

  /**
   * 跳转到日程页面
   */
  goToSchedule() {
    wx.navigateTo({
      url: '/pages/schedule/schedule'
    });
  },

  /**
   * 跳转到积分商城
   */
  goToShop() {
    wx.navigateTo({
      url: '/pages/shop/shop'
    });
  },

  /**
   * 跳转到修改密码
   */
  goToChangePassword() {
    wx.navigateTo({
      url: '/pages/change-password/change-password'
    });
  },

  /**
   * 跳转到运动月报
   */
  goToMonthlyReport() {
    wx.showModal({
      title: '运动月报',
      content: '本月：跑步 12 次，总距离 45.6km，平均配速 5分30秒\n\n较上月提升 15%',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  /**
   * 退出登录
   */
  handleLogout() {
    wx.showModal({
      title: '确认退出',
      content: '退出后需要重新登录才能使用',
      confirmText: '退出',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('isLoggedIn');
          wx.removeStorageSync('isRegistered');
          wx.removeStorageSync('currentUserType');
          app.globalData.userInfo = null;
          app.globalData.isLoggedIn = false;

          wx.showToast({
            title: '已退出登录',
            icon: 'success',
            duration: 1500
          });

          setTimeout(() => {
            wx.reLaunch({
              url: '/pages/login/login'
            });
          }, 1500);
        }
      }
    });
  }
});
