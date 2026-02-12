const app = getApp();

Page({
  data: {
    // 模式切换
    orderMode: 'appointment', // 'instant' 或 'appointment'

    // 即时模式数据
    latitude: null,
    longitude: null,
    markers: [],
    isLighted: false,
    distanceOptions: ['3公里', '5公里', '10公里', '15公里', '20公里'],
    distanceIndex: 1,
    durationOptions: ['30分钟', '1小时', '1.5小时', '2小时', '自定义'],
    durationIndex: 1,

    // 预约模式数据
    selectedAddress: '',
    selectedDate: '',
    selectedDateIndex: 0,
    selectedTime: '',
    notes: '',
    nearbyVolunteers: [], // 附近志愿者列表
    canPublish: false,

    // 日期时间选择器配置
    minDate: '',
    availableDates: [],
    durationOptions: ['30分钟', '1小时', '1.5小时', '2小时', '2.5小时', '3小时'],
    durationIndex: 1,

    // 确认弹窗
    showConfirm: false
  },

  onLoad(options) {
    this.initDateRange();
    this.getUserLocation();
  },

  /**
   * 初始化日期范围（未来3天）
   */
  initDateRange() {
    const today = new Date();
    const dates = [];
    const dateValues = [];

    for (let i = 0; i < 3; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);

      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      const weekDay = weekDays[date.getDay()];

      const displayDate = `${month}月${day}日 ${weekDay}`;
      const valueDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

      dates.push(displayDate);
      dateValues.push(valueDate);
    }

    this.setData({
      minDate: dateValues[0],
      availableDates: dates,
      availableDateValues: dateValues
    });
  },

  /**
   * 获取用户位置
   */
  getUserLocation() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({
          latitude: res.latitude,
          longitude: res.longitude
        });
      },
      fail: () => {
        wx.showToast({
          title: '需要获取您的位置',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 切换模式
   */
  switchMode(e) {
    const mode = e.currentTarget.dataset.mode;
    if (mode !== this.data.orderMode) {
      this.setData({ orderMode: mode });
    }
  },

  /**
   * 地址输入
   */
  onAddressInput(e) {
    const address = e.detail.value;
    this.setData({ selectedAddress: address });
    this.checkPublishable();
  },

  /**
   * 日期选择
   */
  onDateChange(e) {
    const dateIndex = e.detail.value;
    const selectedDate = this.data.availableDates[dateIndex];
    this.setData({
      selectedDate: selectedDate,
      selectedDateIndex: dateIndex
    });
    this.checkPublishable();
  },

  /**
   * 时间选择
   */
  onTimeChange(e) {
    this.setData({ selectedTime: e.detail.value });
    this.checkPublishable();
  },

  /**
   * 时长选择
   */
  onDurationChange(e) {
    this.setData({ durationIndex: e.detail.value });
    this.checkPublishable();
  },

  /**
   * 备注输入
   */
  onNotesInput(e) {
    this.setData({ notes: e.detail.value });
  },

  /**
   * 查找附近志愿者
   */
  findNearbyVolunteers() {
    wx.showLoading({ title: '查找中...' });

    // 获取所有志愿者（模拟数据，实际应从云端获取）
    const allVolunteers = wx.getStorageSync('all_volunteers') || [];
    const userLocation = {
      lat: this.data.latitude,
      lng: this.data.longitude
    };

    // 模拟查找附近1km内的志愿者
    // 实际应用中应该调用云函数查询
    let nearbyVolunteers = [];

    // 生成一些模拟的附近志愿者数据用于演示
    // 实际应该根据真实志愿者位置计算距离
    if (allVolunteers.length > 0) {
      nearbyVolunteers = allVolunteers.filter(v => v.latitude && v.longitude)
        .map(v => {
          const distance = this.calculateDistance(
            userLocation.lat, userLocation.lng,
            v.latitude, v.longitude
          );
          if (distance <= 1) {
            return {
              name: v.name || '志愿者',
              phone: v.phone,
              gender: v.gender || 'male',
              latitude: v.latitude,
              longitude: v.longitude,
              distance: distance.toFixed(1)
            };
          }
          return null;
        })
        .filter(v => v !== null);
    }

    // 如果没有真实数据，生成一些模拟数据用于演示
    if (nearbyVolunteers.length === 0) {
      nearbyVolunteers = [
        { name: '张跑步', phone: '138****1234', gender: 'male', distance: '0.3' },
        { name: '李天使', phone: '139****5678', gender: 'female', distance: '0.5' },
        { name: '王助跑', phone: '136****9012', gender: 'male', distance: '0.8' }
      ];
    }

    this.setData({ nearbyVolunteers: nearbyVolunteers });

    wx.hideLoading();

    if (nearbyVolunteers.length > 0) {
      wx.showToast({
        title: `找到 ${nearbyVolunteers.length} 位志愿者`,
        icon: 'success'
      });
    } else {
      wx.showToast({
        title: '附近暂无志愿者',
        icon: 'none'
      });
    }
  },

  /**
   * 计算两点间距离（km）
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    if (!lat1 || !lng1 || !lat2 || !lng2) return 999;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  },

  /**
   * 检查是否可发布
   */
  checkPublishable() {
    if (this.data.orderMode === 'appointment') {
      const canPublish = !!(
        this.data.selectedAddress &&
        this.data.selectedDate &&
        this.data.selectedTime
      );
      this.setData({ canPublish });
    }
  },

  /**
   * 即时模式：选择位置
   */
  onInstantDistanceChange(e) {
    this.setData({ distanceIndex: e.detail.value });
  },

  onInstantDurationChange(e) {
    this.setData({ durationIndex: e.detail.value });
  },

  /**
   * 发布按钮点击（根据模式判断）
   */
  handlePublish() {
    if (this.data.orderMode === 'instant') {
      // 即时模式：直接发布
      this.publishInstantOrder();
    } else {
      // 预约模式
      if (this.data.canPublish) {
        this.publishAppointment();
      } else {
        wx.showToast({
          title: '请完善预约信息',
          icon: 'none'
        });
      }
    }
  },

  /**
   * 发布即时订单
   */
  publishInstantOrder() {
    if (this.data.isLighted) return;

    wx.showLoading({ title: '正在发布...' });

    const userInfo = wx.getStorageSync('userInfo_disabled') || {};
    const orderId = 'INSTANT_' + Date.now();

    const order = {
      id: orderId,
      blindPhone: userInfo.phone,
      blindName: userInfo.name || '盲人用户',
      blindLatitude: this.data.latitude,
      blindLongitude: this.data.longitude,
      blindAddress: this.data.selectedAddress || '当前位置',
      distance: this.data.distanceOptions[this.data.distanceIndex],
      duration: this.data.durationOptions[this.data.durationIndex],
      type: 'instant',
      status: 'pending',
      createdTime: new Date().toLocaleString(),
      notes: this.data.notes || ''
    };

    // 保存订单
    const orders = wx.getStorageSync('blind_orders') || [];
    orders.unshift(order);
    wx.setStorageSync('blind_orders', orders);

    // 更新点亮状态
    this.setData({ isLighted: true });

    wx.hideLoading();

    wx.showToast({
      title: '已点亮！等待响应',
      icon: 'success'
    });

    // 跳转到订单跟踪页
    setTimeout(() => {
      wx.navigateTo({
        url: '/pages/blind-order-track/blind-order-track'
      });
    }, 1500);
  },

  /**
   * 发布预约订单
   */
  publishAppointment() {
    wx.showLoading({ title: '正在发布...' });

    const userInfo = wx.getStorageSync('userInfo_disabled') || {};
    const orderId = 'APPOINT_' + Date.now();

    const order = {
      id: orderId,
      blindPhone: userInfo.phone,
      blindName: userInfo.name || '盲人用户',
      blindLatitude: this.data.latitude,
      blindLongitude: this.data.longitude,
      blindAddress: this.data.selectedAddress,
      appointmentDate: this.data.selectedDate,
      appointmentTime: this.data.selectedTime,
      duration: this.data.durationOptions[this.data.durationIndex],
      type: 'appointment',
      status: 'pending',
      appointmentStatus: 0, // 0-待接单，1-已接单，2-已完成
      createdTime: new Date().toLocaleString(),
      nearbyVolunteers: this.data.nearbyVolunteers, // 保存附近志愿者信息
      notes: this.data.notes || ''
    };

    // 保存订单
    const orders = wx.getStorageSync('blind_orders') || [];
    orders.unshift(order);
    wx.setStorageSync('blind_orders', orders);

    // 如果有附近志愿者，保存到云端（模拟）
    if (this.data.nearbyVolunteers.length > 0) {
      wx.setStorageSync('pending_appointments', orders.filter(o => o.type === 'appointment' && o.status === 'pending'));
    }

    wx.hideLoading();

    wx.showToast({
      title: '预约已发布！',
      icon: 'success'
    });

    // 跳转到订单跟踪页
    setTimeout(() => {
      wx.navigateTo({
        url: '/pages/blind-order-track/blind-order-track'
      });
    }, 1500);
  },

  /**
   * 获取用户当前位置（即时模式）
   */
  getUserCurrentLocation() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({
          latitude: res.latitude,
          longitude: res.longitude,
          markers: [{
            id: 1,
            latitude: res.latitude,
            longitude: res.longitude,
            width: 40,
            height: 40,
            iconPath: '/images/my-location.png'
          }]
        });
      }
    });
  }
});
