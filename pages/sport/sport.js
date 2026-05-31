const app = getApp();

Page({
  data: {
    userType: 'disabled', // disabled 或 volunteer
    sportType: 'companion', // companion: 陪跑, solo: 自主跑, walk: 步行
    sportTypes: [
      { key: 'companion', name: '陪跑', icon: '🤝' },
      { key: 'solo', name: '自主跑', icon: '🏃' },
      { key: 'walk', name: '步行', icon: '🚶' }
    ],
    // 地图数据
    latitude: 31.2304, // 默认上海
    longitude: 121.4737,
    hasLocation: false,
    markers: [],
    // 运动状态
    isRecording: false, // 是否正在运动
    recordingTime: 0, // 运动时长（秒）
    recordingDistance: 0, // 运动距离（km）
    recordingCalories: 0, // 消耗卡路里
    timer: null, // 计时器
    location: null, // 当前位置
    locations: [], // 轨迹点
    // 今日目标数据
    todaySteps: 5236,
    todayDistance: 3.2,
    todayDuration: 25,
    todayProgress: 52,
    userInfo: null
  },

  onLoad() {
    this.loadUserInfo();
    this.getCurrentLocation();
    this.loadTodayStats();
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

    this.setData({
      userType: currentUserType,
      userInfo: userInfo
    });
  },

  /**
   * 切换运动类型
   */
  onSportTypeChange(e) {
    const index = e.currentTarget.dataset.index;
    const sportType = this.data.sportTypes[index].key;

    this.setData({ sportType });
  },

  /**
   * 开始/结束运动
   */
  toggleRecording() {
    if (this.data.isRecording) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  },

  /**
   * 开始运动
   */
  startRecording() {
    // 获取位置权限
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({
          isRecording: true,
          location: res,
          locations: [{
            latitude: res.latitude,
            longitude: res.longitude,
            timestamp: Date.now()
          }],
          recordingTime: 0,
          recordingDistance: 0,
          recordingCalories: 0
        });

        // 开始计时
        this.startTimer();

        wx.showToast({
          title: '开始运动',
          icon: 'success'
        });
      },
      fail: () => {
        wx.showModal({
          title: '提示',
          content: '需要位置权限才能记录运动轨迹',
          confirmText: '去设置',
          success: (res) => {
            if (res.confirm) {
              wx.openSetting();
            }
          }
        });
      }
    });
  },

  /**
   * 开始/结束处理（根据类型决定行为）
   */
  handleStart() {
    const { userType, sportType, isRecording } = this.data;

    // 如果正在录制，先停止
    if (isRecording) {
      this.stopRecording();
      return;
    }

    // 盲人用户 + 陪跑 → 跳转到打车式发布需求页面
    if (userType === 'disabled' && sportType === 'companion') {
      wx.vibrateLong();
      wx.navigateTo({
        url: '/pages/publish-need/publish-need'
      });
      return;
    }

    // 盲人用户 + 其他运动类型 → 走运动记录或保留旧预约流程
    if (userType === 'disabled') {
      wx.vibrateLong();
      wx.navigateTo({
        url: '/pages/appointment/appointment'
      });
      return;
    }

    // 志愿者 + 陪跑 → 跳转到接单页面
    if (userType === 'volunteer' && sportType === 'companion') {
      wx.navigateTo({
        url: '/pages/take-order/take-order'
      });
      return;
    }

    // 其他情况 → 开始运动
    this.startRecording();
  },

  /**
   * 开始计时器
   */
  startTimer() {
    this.data.timer = setInterval(() => {
      const newTime = this.data.recordingTime + 1;
      const newDistance = this.calculateDistance(newTime);
      const newCalories = this.calculateCalories(newTime);

      this.setData({
        recordingTime: newTime,
        recordingDistance: newDistance,
        recordingCalories: newCalories
      });
    }, 1000);
  },

  /**
   * 停止运动（保存到云端）
   */
  stopRecording() {
    clearInterval(this.data.timer);

    const record = {
      date: new Date().toLocaleString(),
      type: this.data.sportType,
      duration: this.data.recordingTime,
      distance: this.data.recordingDistance,
      calories: this.data.recordingCalories,
      locations: this.data.locations
    };

    // 保存到本地存储（即时显示）
    const records = wx.getStorageSync('sport_records') || [];
    records.push(record);
    wx.setStorageSync('sport_records', records);

    // 同步到云端
    app.saveSportRecord({
      distance: record.distance,
      duration: record.duration,
      calories: record.calories,
      pace: record.duration > 0 && record.distance > 0 ? (record.duration / 60 / record.distance).toFixed(2) : '',
      trajectory: record.locations,
      startTime: record.date,
      endTime: new Date().toLocaleString()
    }).catch(() => {});

    this.updateStats();

    this.setData({
      isRecording: false,
      timer: null
    });

    wx.showModal({
      title: '运动结束',
      content: `时长: ${this.formatTime(this.data.recordingTime)}\n距离: ${this.data.recordingDistance.toFixed(2)} km\n消耗: ${this.data.recordingCalories.toFixed(0)} kCal`,
      showCancel: false,
      confirmText: '知道了'
    });
  },

  /**
   * 计算运动距离（模拟数据）
   */
  calculateDistance(seconds) {
    // 假设平均配速 6 分钟/公里
    return seconds * 60 / 1000; // km
  },

  /**
   * 计算消耗卡路里
   */
  calculateCalories(seconds) {
    // 假设每小时消耗 300 卡路里
    return (seconds / 3600) * 300;
  },

  /**
   * 格式化时间
   */
  formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    if (h > 0) {
      return `${h}小时${m}分${s}秒`;
    }
    return `${m}分${s}秒`;
  },

  /**
   * 更新统计数据
   */
  updateStats() {
    const records = wx.getStorageSync('sport_records') || [];
    const todayRecords = records.filter(r => {
      const today = new Date().toDateString();
      return new Date(r.date).toDateString() === today;
    });

    let totalTime = 0;
    let totalDistance = 0;
    let totalCalories = 0;

    todayRecords.forEach(r => {
      totalTime += r.duration;
      totalDistance += r.distance;
      totalCalories += r.calories;
    });

    // 保存今日数据
    wx.setStorageSync('today_stats', {
      time: totalTime,
      distance: totalDistance,
      calories: totalCalories
    });
  },

  /**
   * 获取当前位置
   */
  getCurrentLocation() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({
          latitude: res.latitude,
          longitude: res.longitude,
          location: res,
          hasLocation: true,
          // 使用默认标记点 + 橙色标签
          markers: [{
            id: 1,
            latitude: res.latitude,
            longitude: res.longitude,
            width: 32,
            height: 32,
            // 使用 callout 展示橙色标签
            callout: {
              content: '📍 您的位置',
              color: '#FF6B00',
              fontSize: 12,
              borderRadius: 8,
              bgColor: '#FFFFFF',
              padding: 6,
              display: 'ALWAYS'
            }
          }]
        });
      },
      fail: () => {
        // 使用默认位置
        this.setData({
          hasLocation: false,
          markers: []
        });
      }
    });
  },

  /**
   * 加载今日统计数据
   */
  loadTodayStats() {
    const todayStats = wx.getStorageSync('today_stats') || {
      time: 0,
      distance: 0,
      calories: 0
    };
    const steps = Math.floor(todayStats.distance * 1300); // 估算步数

    this.setData({
      todaySteps: steps,
      todayDistance: todayStats.distance,
      todayDuration: Math.floor(todayStats.time / 60),
      todayProgress: Math.min(100, Math.floor(steps / 10000 * 100))
    });
  },

  /**
   * 标记点点击事件
   */
  onMarkerTap(e) {
    const markerId = e.markerId;
    wx.showToast({
      title: '标记点 #' + markerId,
      icon: 'none'
    });
  },

  onUnload() {
    if (this.data.timer) {
      clearInterval(this.data.timer);
    }
  }
});
