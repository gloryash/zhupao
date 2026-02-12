const app = getApp();

Page({
  data: {
    hasOrder: false,
    orderStatus: 'pending',
    orderInfo: null,
    volunteerInfo: null,
    // 地图相关
    mapLatitude: null,
    mapLongitude: null,
    mapMarkers: [],
    runningStats: {
      totalDistance: 0,
      totalTime: 0,
      formattedTime: '0',
      avgSpeed: 0
    },
    finalStats: null,
    rating: 0,
    comment: '',
    showRatingPopup: false
  },

  onShow() {
    this.loadOrderStatus();
    // 轮询更新状态
    this.startPolling();
  },

  onHide() {
    this.stopPolling();
  },

  onUnload() {
    this.stopPolling();
  },

  /**
   * 加载订单状态
   */
  loadOrderStatus() {
    const userInfo = wx.getStorageSync('userInfo_disabled') || {};
    const orders = wx.getStorageSync('blind_orders') || [];
    // 查找当前用户最近的未完成订单
    const myOrder = orders.find(o =>
      o.blindPhone === userInfo.phone &&
      ['pending', 'accepted', 'arrived', 'running', 'completed'].includes(o.status)
    );

    if (myOrder) {
      // 获取志愿者信息
      const volunteerInfo = {
        name: myOrder.volunteerName,
        phone: myOrder.volunteerPhone,
        pace: myOrder.volunteerPace || '',
        runningYears: myOrder.volunteerRunningYears || '',
        latitude: myOrder.volunteerLat || null,
        longitude: myOrder.volunteerLng || null
      };

      // 设置地图标记
      let mapMarkers = [];
      let statusText = '';
      if (myOrder.status === 'pending') {
        statusText = '等待接单';
      } else if (myOrder.status === 'accepted') {
        statusText = '对方已接单';
      } else if (myOrder.status === 'arrived') {
        statusText = '已到达';
      } else if (myOrder.status === 'running') {
        statusText = '陪跑中';
      } else if (myOrder.status === 'completed') {
        statusText = '已完成';
      }

      if (['accepted', 'arrived', 'running'].includes(myOrder.status)) {
        // 显示志愿者位置标记
        mapMarkers.push({
          id: 1,
          latitude: myOrder.volunteerLat,
          longitude: myOrder.volunteerLng,
          width: 40,
          height: 40,
          iconPath: '/images/volunteer-marker.png',
          callout: {
            content: '志愿者: ' + (myOrder.volunteerName || '志愿者'),
            display: 'ALWAYS',
            padding: 8,
            borderRadius: 6,
            bgColor: '#07C160',
            color: '#ffffff',
            fontSize: 12
          }
        });
        // 显示盲人位置标记
        mapMarkers.push({
          id: 2,
          latitude: myOrder.blindLatitude,
          longitude: myOrder.blindLongitude,
          width: 40,
          height: 40,
          iconPath: '/images/blind-marker.png',
          callout: {
            content: '您的位置',
            display: 'ALWAYS',
            padding: 8,
            borderRadius: 6,
            bgColor: '#1890FF',
            color: '#ffffff',
            fontSize: 12
          }
        });
      }

      this.setData({
        hasOrder: true,
        orderStatus: myOrder.status,
        orderInfo: myOrder,
        volunteerInfo: volunteerInfo,
        mapLatitude: myOrder.blindLatitude,
        mapLongitude: myOrder.blindLongitude,
        mapMarkers: mapMarkers,
        statusText: statusText
      });
    } else {
      this.setData({
        hasOrder: false,
        orderStatus: 'pending',
        orderInfo: null,
        mapMarkers: []
      });
    }
  },

  /**
   * 开始轮询状态
   */
  startPolling() {
    this.pollingTimer = setInterval(() => {
      this.loadOrderStatus();
    }, 3000); // 每3秒更新一次
  },

  /**
   * 停止轮询
   */
  stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  },

  /**
   * 获取状态文本
   */
  getStatusText(status) {
    const statusMap = {
      pending: '等待志愿者接单',
      accepted: '志愿者已接单，正在赶来',
      arrived: '志愿者已到达',
      running: '正在陪跑中',
      completed: '陪跑已完成'
    };
    return statusMap[status] || '未知状态';
  },

  /**
   * 获取状态描述
   */
  getStatusDesc(status) {
    const descMap = {
      pending: '请耐心等待附近的志愿者响应',
      accepted: '志愿者正在赶来与您会合',
      arrived: '请与志愿者确认后开始陪跑',
      running: '祝您跑步愉快！',
      completed: '感谢您的参与！'
    };
    return descMap[status] || '';
  },

  /**
   * 拨打电话
   */
  makeCall() {
    const phone = this.data.volunteerInfo?.phone;
    if (phone) {
      wx.makePhoneCall({
        phoneNumber: phone
      });
    }
  },

  /**
   * 取消订单
   */
  cancelOrder() {
    wx.showModal({
      title: '取消订单',
      content: '确定要取消这次陪跑请求吗？',
      confirmText: '确定取消',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          const orders = wx.getStorageSync('blind_orders') || [];
          const orderIndex = orders.findIndex(o => o.id === this.data.orderInfo.id);
          if (orderIndex !== -1) {
            orders[orderIndex].status = 'cancelled';
            wx.setStorageSync('blind_orders', orders);
          }
          this.setData({ hasOrder: false });
          wx.showToast({ title: '订单已取消', icon: 'none' });
        }
      }
    });
  },

  /**
   * 结束陪跑（盲人端主动结束）
   */
  endRun() {
    wx.showModal({
      title: '结束陪跑',
      content: '确定要结束这次陪跑吗？',
      confirmText: '确定结束',
      success: (res) => {
        if (res.confirm) {
          // 更新订单状态
          const orders = wx.getStorageSync('blind_orders') || [];
          const orderIndex = orders.findIndex(o => o.id === this.data.orderInfo.id);
          if (orderIndex !== -1) {
            orders[orderIndex].status = 'completed';
            orders[orderIndex].completedTime = new Date().toLocaleString();
            wx.setStorageSync('blind_orders', orders);
          }
          this.setData({
            orderStatus: 'completed',
            finalStats: this.data.runningStats
          });
          // 显示评价弹窗
          this.setData({ showRatingPopup: true });
        }
      }
    });
  },

  /**
   * 设置评分
   */
  setRating(e) {
    this.setData({ rating: e.currentTarget.dataset.score });
  },

  /**
   * 输入评论
   */
  onCommentInput(e) {
    this.setData({ comment: e.detail.value });
  },

  /**
   * 提交评价
   */
  submitRating() {
    if (this.data.rating === 0) {
      wx.showToast({ title: '请先评分', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '提交中...' });

    // 保存评价
    const orders = wx.getStorageSync('blind_orders') || [];
    const orderIndex = orders.findIndex(o => o.id === this.data.orderInfo.id);
    if (orderIndex !== -1) {
      orders[orderIndex].status = 'rated';
      orders[orderIndex].blindRate = this.data.rating;
      orders[orderIndex].blindComment = this.data.comment;
      wx.setStorageSync('blind_orders', orders);
    }

    setTimeout(() => {
      wx.hideLoading();
      this.setData({ showRatingPopup: false });
      wx.showModal({
        title: '感谢您的评价！',
        content: '期待您下次使用！',
        showCancel: false,
        success: () => {
          wx.switchTab({ url: '/pages/home/home' });
        }
      });
    }, 500);
  },

  /**
   * 关闭评价弹窗
   */
  closeRatingPopup() {
    this.setData({ showRatingPopup: false });
  },

  /**
   * 返回首页
   */
  goHome() {
    wx.switchTab({ url: '/pages/home/home' });
  },

  /**
   * 发起新订单
   */
  createOrder() {
    wx.navigateTo({ url: '/pages/appointment/appointment' });
  }
})
