const app = getApp();

Page({
  data: {
    userInfo: null,
    userType: 'disabled', // disabled 或 volunteer
    userName: '',
    greeting: '',
    stats: {
      totalRuns: 0,
      totalDistance: 0,
      totalTime: 0
    },
    tier: null, // 段位信息
    userPoints: 0, // 积分
    userExp: 0, // 经验值
    checkInDays: 0, // 连续打卡天数
    todayCheckedIn: false, // 今日是否已打卡
    showCertificateGuide: false, // 是否显示证书引导弹窗
    isTakingOrders: false, // 志愿者是否正在接单
    examPassed: false, // 志愿者是否已通过考试
    videoWatched: false, // 志愿者是否已观看视频
    trainingCompleted: false // 志愿者培训是否完成
  },

  onLoad() {
    this.loadUserInfo();
  },

  onShow() {
    this.loadUserInfo();
  },

  /**
   * 加载用户信息（优先本地缓存，异步同步云端）
   */
  loadUserInfo() {
    const isLoggedIn = wx.getStorageSync('isLoggedIn');
    if (!isLoggedIn) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }

    const currentUserType = wx.getStorageSync('currentUserType');
    const storageKey = `userInfo_${currentUserType}`;
    const userInfo = wx.getStorageSync(storageKey);

    if (!userInfo || !currentUserType) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }

    // 先用本地缓存快速渲染
    const localStats = app.getUserStats(currentUserType);
    const today = new Date().toLocaleDateString();
    const todayCheckedIn = localStats.lastCheckInDate === today;

    this.setData({
      userInfo: userInfo,
      userType: currentUserType,
      userName: userInfo.name || '用户',
      userPoints: localStats.points || 0,
      userExp: localStats.exp || 0,
      checkInDays: localStats.checkInDays || 0,
      todayCheckedIn: todayCheckedIn,
      isTakingOrders: currentUserType === 'volunteer' ? (wx.getStorageSync('volunteerTakingOrders') || false) : false
    });

    // 计算段位（先用本地数据）
    const localRecords = wx.getStorageSync('companion_records') || [];
    const tier = app.calculateTier(currentUserType, localRecords.length);
    this.setData({ tier });
    this.setGreeting();

    // 异步从云端获取最新数据
    app.getCloudUserStats().then(res => {
      if (res.success) {
        const s = res.stats;
        const cloudCheckedIn = s.lastCheckInDate === today;
        this.setData({
          userPoints: s.points || 0,
          userExp: s.exp || 0,
          checkInDays: s.checkInDays || 0,
          todayCheckedIn: cloudCheckedIn,
          examPassed: s.examPassed || false,
          videoWatched: s.videoWatched || false,
          trainingCompleted: s.examPassed || false,
          trainingStep: currentUserType === 'volunteer' ? (s.examPassed ? 3 : (s.videoWatched ? 2 : 1)) : 0,
          stats: {
            totalRuns: s.totalRuns || 0,
            totalDistance: (s.totalDistance || 0).toFixed ? (s.totalDistance || 0).toFixed(1) : s.totalDistance || 0,
            totalTime: s.totalTime || 0
          }
        });
        // 更新段位
        const cloudTier = app.calculateTier(currentUserType, s.totalRuns || 0);
        this.setData({ tier: cloudTier });
        // 同步到本地缓存
        const stats = app.getUserStats(currentUserType);
        stats.points = s.points || 0;
        stats.exp = s.exp || 0;
        stats.checkInDays = s.checkInDays || 0;
        stats.lastCheckInDate = s.lastCheckInDate || '';
        app.saveUserStats(currentUserType, stats);
      }
    }).catch(() => {
      // 云端不可用时使用本地培训状态
      if (currentUserType === 'volunteer') {
        const examPassed = wx.getStorageSync('exam_passed');
        const videoWatched = wx.getStorageSync('volunteer_video_watched');
        this.setData({
          examPassed: !!examPassed,
          videoWatched: !!videoWatched,
          trainingCompleted: !!examPassed,
          trainingStep: examPassed ? 3 : (videoWatched ? 2 : 1)
        });
      }
    });
  },

  /**
   * 检查志愿者证书状态并显示引导弹窗
   */
  checkCertificateGuide() {
    const currentUserType = this.data.userType;

    // 只对志愿者检查证书状态
    if (currentUserType !== 'volunteer') {
      return;
    }

    // 检查是否已显示过引导（避免每次都弹）
    const guideShown = wx.getStorageSync('certificateGuideShown');
    if (guideShown) {
      return;
    }

    // 检查证书状态
    const hasCertificate = wx.getStorageSync('exam_passed');
    if (!hasCertificate) {
      this.setData({ showCertificateGuide: true });
    }
  },

  /**
   * 关闭证书引导弹窗
   */
  closeCertificateGuide() {
    this.setData({ showCertificateGuide: false });
    wx.setStorageSync('certificateGuideShown', true);
  },

  /**
   * 前往完成考核
   */
  goToCompleteTraining() {
    this.closeCertificateGuide();
    wx.navigateTo({
      url: '/pages/training-flow/training-flow'
    });
  },

  /**
   * 切换接单状态（志愿者，同步到云端）
   */
  toggleTakingOrders() {
    const { userType, isTakingOrders } = this.data;
    if (userType !== 'volunteer') return;

    // 检查是否已通过考核（优先云端数据）
    if (!this.data.examPassed) {
      const hasCertificate = wx.getStorageSync('exam_passed');
      if (!hasCertificate) {
        wx.showModal({
          title: '暂未通过考核',
          content: '您尚未通过志愿者考核，请先完成培训教程并领取证书后方可接单。',
          confirmText: '去考核',
          success: (res) => {
            if (res.confirm) {
              wx.navigateTo({ url: '/pages/training-flow/training-flow' });
            }
          }
        });
        return;
      }
    }

    wx.showModal({
      title: isTakingOrders ? '停止接单' : '开始接单',
      content: isTakingOrders ? '确定要停止接单吗？' : '确定要开始接单吗？开始后盲人可以给您下单。',
      confirmText: isTakingOrders ? '停止' : '开始',
      success: (res) => {
        if (res.confirm) {
          const newStatus = !isTakingOrders;

          // 获取位置并同步到云端
          wx.getLocation({
            type: 'gcj02',
            success: (locationRes) => {
              app.updateVolunteerAvailability(newStatus, locationRes.latitude, locationRes.longitude).then(() => {
                this.setData({ isTakingOrders: newStatus });
                wx.setStorageSync('volunteerTakingOrders', newStatus);
                wx.showToast({ title: newStatus ? '已开始接单' : '已停止接单', icon: 'success' });
              }).catch(() => {
                // 降级到本地
                this.setData({ isTakingOrders: newStatus });
                wx.setStorageSync('volunteerTakingOrders', newStatus);
                wx.showToast({ title: newStatus ? '已开始接单' : '已停止接单', icon: 'success' });
              });
            },
            fail: () => {
              app.updateVolunteerAvailability(newStatus, 0, 0).catch(() => {});
              this.setData({ isTakingOrders: newStatus });
              wx.setStorageSync('volunteerTakingOrders', newStatus);
              wx.showToast({ title: newStatus ? '已开始接单' : '已停止接单', icon: 'success' });
            }
          });
        }
      }
    });
  },

  /**
   * 前往接单页面（志愿者端）
   */
  goToTakeOrder() {
    // 检查是否已完成培训
    const examPassed = wx.getStorageSync('exam_passed');
    if (!examPassed) {
      wx.showModal({
        title: '提示',
        content: '请先完成培训教程才能接单',
        confirmText: '去培训',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/training-flow/training-flow'
            });
          }
        }
      });
      return;
    }
    wx.navigateTo({
      url: '/pages/take-order/take-order'
    });
  },

  /**
   * 前往培训教程（志愿者端）
   */
  goToTraining() {
    wx.navigateTo({
      url: '/pages/training-flow/training-flow'
    });
  },

  /**
   * 获取当前培训步骤
   */
  getTrainingStep() {
    const { videoWatched, examPassed } = this.data;
    if (examPassed) return 3; // 已完成（可领证/已领证）
    if (videoWatched) return 2; // 已观看视频，去考试
    return 1; // 还未观看视频
  },

  /**
   * 设置问候语
   */
  setGreeting() {
    const hour = new Date().getHours();
    let greeting = '';

    if (hour < 6) {
      greeting = '夜深了';
    } else if (hour < 9) {
      greeting = '早上好';
    } else if (hour < 12) {
      greeting = '上午好';
    } else if (hour < 14) {
      greeting = '中午好';
    } else if (hour < 18) {
      greeting = '下午好';
    } else if (hour < 22) {
      greeting = '晚上好';
    } else {
      greeting = '夜深了';
    }

    this.setData({ greeting });
  },

  /**
   * 加载陪跑记录
   * @returns {object} 统计数据
   */
  loadRecords() {
    const records = wx.getStorageSync('companion_records') || [];
    let stats = {
      totalRuns: records.length,
      totalDistance: 0,
      totalTime: 0
    };

    if (records.length > 0) {
      const totalDistance = records.reduce((sum, r) => sum + parseFloat(r.actualDistance || 0), 0);
      const totalTime = (records.reduce((sum, r) => sum + parseInt(r.duration || 0), 0) / 60).toFixed(1);

      stats = {
        totalRuns: records.length,
        totalDistance: totalDistance.toFixed(1),
        totalTime: totalTime
      };

      this.setData({ stats });
    }

    return stats;
  },

  /**
   * 返回首页（切换账号）
   */
  goToLogin() {
    wx.showModal({
      title: '切换账号',
      content: '确定要返回登录页面吗？',
      confirmText: '确定',
      success: (res) => {
        if (res.confirm) {
          wx.reLaunch({
            url: '/pages/quick-login/quick-login'
          });
        }
      }
    });
  },

  /**
   * 视障人士：发布需求
   */
  goToPublish() {
    wx.navigateTo({
      url: '/pages/publish-need/publish-need'
    });
  },

  /**
   * 每日打卡（云端）
   */
  handleCheckIn() {
    if (this.data.userType !== 'disabled') return;

    if (this.data.todayCheckedIn) {
      wx.showToast({ title: '今日已打卡', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '打卡中...' });
    app.cloudCheckIn().then(res => {
      wx.hideLoading();
      if (res.success) {
        this.setData({
          userExp: (this.data.userExp || 0) + res.earnedExp,
          checkInDays: res.checkInDays,
          todayCheckedIn: true
        });
        // 同步本地缓存
        const stats = app.getUserStats('disabled');
        stats.exp += res.earnedExp;
        stats.checkInDays = res.checkInDays;
        stats.lastCheckInDate = new Date().toLocaleDateString();
        app.saveUserStats('disabled', stats);

        wx.showModal({
          title: '打卡成功',
          content: res.message,
          showCancel: false,
          confirmText: '知道了'
        });
      }
    }).catch(err => {
      wx.hideLoading();
      // 降级到本地打卡
      const result = app.addPointsAndExp('disabled', 'checkin');
      if (result.message === '今日已打卡') {
        this.setData({ todayCheckedIn: true });
        wx.showToast({ title: '今日已打卡', icon: 'none' });
        return;
      }
      const userStats = app.getUserStats('disabled');
      this.setData({
        userExp: userStats.exp,
        checkInDays: userStats.checkInDays,
        todayCheckedIn: true
      });
      wx.showModal({
        title: '打卡成功',
        content: result.message,
        showCancel: false,
        confirmText: '知道了'
      });
    });
  },

  /**
   * 志愿者：接单
   */
  goToTakeOrder() {
    // 检查志愿者证书状态
    const hasCertificate = wx.getStorageSync('exam_passed');

    if (!hasCertificate) {
      wx.showModal({
        title: '暂未通过考核',
        content: '您尚未通过志愿者考核，请先完成培训教程并领取证书后方可接单。',
        confirmText: '去考核',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/training-flow/training-flow'
            });
          }
        }
      });
      return;
    }

    wx.navigateTo({
      url: '/pages/take-order/take-order'
    });
  },

  /**
   * 查看个人信息
   */
  goToProfile() {
    wx.navigateTo({
      url: '/pages/user-info/user-info'
    });
  },

  /**
   * 查看我的证书
   */
  goToCertificate() {
    wx.navigateTo({
      url: '/pages/certificate/certificate'
    });
  },

  /**
   * 查看跑步历史
   */
  goToRecords() {
    wx.navigateTo({
      url: '/pages/records-manage/records-manage'
    });
  },

  /**
   * 查看我的日程
   */
  goToSchedule() {
    wx.navigateTo({
      url: '/pages/schedule/schedule'
    });
  },

  /**
   * 修改密码
   */
  goToChangePassword() {
    wx.navigateTo({
      url: '/pages/change-password/change-password'
    });
  },

  /**
   * 客服与帮助
   */
  goToHelp() {
    wx.showModal({
      title: '客服与帮助',
      content: '如需帮助，请联系客服热线：400-123-4567\n\n或发送邮件至：support@blindrun.com',
      confirmText: '我知道了'
    });
  },

  /**
   * 关于我们
   */
  goToAbout() {
    wx.showModal({
      title: '关于我们',
      content: '助盲跑平台\n\n' +
        '产品愿景：用科技连接光明，让每一位视障人士都能享受奔跑的自由。\n\n' +
        '创始人故事：在宋海峰教练的指导下，我们看到了视障人士对奔跑的渴望。' +
        '10年来，宋教练帮助了600多位视障人士完成马拉松梦想，却从未帮助过一个盲人孩子。\n\n' +
        '我们的使命：让每一个热爱奔跑的视障人士都能找到属于自己的光。\n\n' +
        '© 2026 助盲跑平台 · 爱心出品',
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  /**
   * 退出登录
   */
  handleLogout() {
    wx.showModal({
      title: '确认退出',
      content: '退出后需要重新登录才能继续使用',
      confirmText: '退出',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          // 清除登录状态
          wx.removeStorageSync('isLoggedIn');
          wx.removeStorageSync('isRegistered');
          wx.removeStorageSync('currentUserType');

          // 清除全局用户信息
          app.globalData.userInfo = null;
          app.globalData.isLoggedIn = false;

          wx.showToast({
            title: '已退出登录',
            icon: 'success',
            duration: 1500
          });

          // 跳转到登录页
          setTimeout(() => {
            wx.reLaunch({
              url: '/pages/login/login'
            });
          }, 1500);
        }
      }
    });
  }
})
