const app = getApp();
const fmt = require('../../utils/format');

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
    polyline: [],
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
   * 加载订单状态（云端优先）
   */
  loadOrderStatus() {
    // 云端查询我的订单
    app.getMyOrders('all', 1).then(res => {
      if (res.success && res.orders.length > 0) {
        // 找到最近的活跃订单
        const activeOrder = res.orders.find(o =>
          ['waiting', 'accepted', 'arrived', 'running', 'completed'].includes(o.status)
        );
        if (activeOrder) {
          this._renderOrder({
            ...activeOrder,
            id: activeOrder._id,
            blindPhone: '',
            blindName: activeOrder.userName,
            blindLatitude: (() => {
              const start = fmt.orderStart(activeOrder);
              return (start && start.latitude) || activeOrder.latitude;
            })(),
            blindLongitude: (() => {
              const start = fmt.orderStart(activeOrder);
              return (start && start.longitude) || activeOrder.longitude;
            })(),
            startAddress: {
              name: fmt.startAddress(activeOrder),
              address: fmt.startAddress(activeOrder),
              ...(fmt.orderStart(activeOrder) || {})
            },
            endAddress: fmt.destinationAddress(activeOrder)
              ? {
                  name: fmt.destinationAddress(activeOrder),
                  address: fmt.destinationAddress(activeOrder),
                  ...(fmt.orderDestination(activeOrder) || {})
                }
              : null,
            volunteerName: activeOrder.volunteerName,
            volunteerPhone: activeOrder.volunteerPhone,
            volunteerLat: activeOrder.volunteerLat || 0,
            volunteerLng: activeOrder.volunteerLng || 0,
            status: activeOrder.status === 'waiting' ? 'pending' : activeOrder.status,
            createTime: activeOrder.publishTime,
            // 从云端获取实时跑步数据
            runningStats: activeOrder.runningStats || null,
            runningPath: activeOrder.runningPath || []
          });
          return;
        }
      }
      // 云端没有，降级本地
      this._loadLocalOrder();
    }).catch(() => {
      this._loadLocalOrder();
    });
  },

  /**
   * 本地降级加载订单
   */
  _loadLocalOrder() {
    const userInfo = wx.getStorageSync('userInfo_disabled') || {};
    const orders = wx.getStorageSync('blind_orders') || [];
    const myOrder = orders.find(o =>
      o.blindPhone === userInfo.phone &&
      ['pending', 'accepted', 'arrived', 'running', 'completed'].includes(o.status)
    );
    if (myOrder) {
      this._renderOrder(myOrder);
    } else {
      this.setData({ hasOrder: false, orderStatus: 'pending', orderInfo: null, mapMarkers: [], polyline: [] });
    }
  },

  /**
   * 渲染订单数据到页面
   */
  _renderOrder(myOrder) {
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
      let polyline = [];
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

      // 接单途中：志愿者 → 起点（视障者位置）绿色路径
      if (['accepted', 'arrived'].includes(myOrder.status)) {
        // 起点绿圆（视障者位置）
        mapMarkers.push({
          id: 2,
          latitude: myOrder.blindLatitude,
          longitude: myOrder.blindLongitude,
          width: 40,
          height: 40,
          iconPath: '/images/marker/dot-green.png',
          callout: {
            content: '您（起点）',
            display: 'ALWAYS',
            padding: 8,
            borderRadius: 6,
            bgColor: '#07C160',
            color: '#FFFFFF',
            fontSize: 12,
          },
        });
        // 志愿者跑者图标
        if (myOrder.volunteerLat && myOrder.volunteerLng) {
          mapMarkers.push({
            id: 1,
            latitude: myOrder.volunteerLat,
            longitude: myOrder.volunteerLng,
            width: 48,
            height: 48,
            iconPath: '/images/marker/runner.png',
            callout: {
              content: '志愿者 ' + (myOrder.volunteerName || ''),
              display: 'ALWAYS',
              padding: 8,
              borderRadius: 6,
              bgColor: '#07C160',
              color: '#FFFFFF',
              fontSize: 12,
            },
          });
          // 绿色带箭头路径：志愿者 → 视障者起点
          polyline = [{
            points: [
              { latitude: myOrder.volunteerLat, longitude: myOrder.volunteerLng },
              { latitude: myOrder.blindLatitude, longitude: myOrder.blindLongitude },
            ],
            color: '#07C160',
            width: 6,
            dottedLine: false,
            arrowLine: true,
          }];
        }
      }

      // 陪跑中：起点绿 + 终点红 + 蓝色实时轨迹
      if (myOrder.status === 'running') {
        // 起点绿圆（最初的视障者位置）
        mapMarkers.push({
          id: 2,
          latitude: myOrder.blindLatitude,
          longitude: myOrder.blindLongitude,
          width: 40,
          height: 40,
          iconPath: '/images/marker/dot-green.png',
          callout: {
            content: '起点',
            display: 'ALWAYS',
            padding: 6,
            borderRadius: 6,
            bgColor: '#07C160',
            color: '#FFFFFF',
            fontSize: 12,
          },
        });
        // 终点红圆（若有 endAddress）
        const endAddr = myOrder.endAddress ||
          (fmt.destinationAddress(myOrder)
            ? {
                name: fmt.destinationAddress(myOrder),
                address: fmt.destinationAddress(myOrder),
                ...(fmt.orderDestination(myOrder) || {})
              }
            : null) ||
          ((app.globalData.orderInfo || {}).endAddress);
        if (endAddr && endAddr.latitude) {
          mapMarkers.push({
            id: 3,
            latitude: endAddr.latitude,
            longitude: endAddr.longitude,
            width: 40,
            height: 40,
            iconPath: '/images/marker/dot-red.png',
            callout: {
              content: '终点 ' + (endAddr.name || ''),
              display: 'ALWAYS',
              padding: 6,
              borderRadius: 6,
              bgColor: '#FF3B30',
              color: '#FFFFFF',
              fontSize: 12,
            },
          });
        }
        // 蓝色轨迹线
        if (myOrder.runningPath && myOrder.runningPath.length >= 2) {
          polyline = [{
            points: myOrder.runningPath,
            color: '#1890FF',
            width: 6,
            dottedLine: false,
            arrowLine: true,
          }];
        }
      }

      this.setData({
        hasOrder: true,
        orderStatus: myOrder.status,
        orderInfo: myOrder,
        volunteerInfo: volunteerInfo,
        mapLatitude: myOrder.blindLatitude,
        mapLongitude: myOrder.blindLongitude,
        mapMarkers: mapMarkers,
        statusText: statusText,
        runningStats: myOrder.runningStats ? {
          totalDistance: parseFloat(Number(myOrder.runningStats.totalDistance).toFixed(2)),
          totalTime: myOrder.runningStats.totalTime || 0,
          formattedTime: myOrder.runningStats.formattedTime || '0',
          avgSpeed: myOrder.runningStats.avgSpeed || 0
        } : this.data.runningStats,
        polyline: polyline,
      });
    } else {
      this.setData({
        hasOrder: false,
        orderStatus: 'pending',
        orderInfo: null,
        mapMarkers: [],
        polyline: []
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
    wx.vibrateShort();
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
    wx.vibrateShort();
    wx.showModal({
      title: '取消订单',
      content: '确定要取消这次陪跑请求吗？',
      confirmText: '确定取消',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          // 本地更新
          const orders = wx.getStorageSync('blind_orders') || [];
          const orderIndex = orders.findIndex(o => o.id === this.data.orderInfo.id);
          if (orderIndex !== -1) {
            orders[orderIndex].status = 'cancelled';
            wx.setStorageSync('blind_orders', orders);
          }
          // 云端取消
          if (this.data.orderInfo && this.data.orderInfo.id) {
            app.cancelOrder(this.data.orderInfo.id).catch(err => {
              console.error('云端取消订单失败:', err);
            });
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
    wx.vibrateLong();
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
    wx.vibrateShort();
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
    wx.vibrateShort();
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
    wx.vibrateShort();
    wx.switchTab({ url: '/pages/home/home' });
  },

  /**
   * 发起新订单
   */
  createOrder() {
    wx.vibrateShort();
    wx.navigateTo({ url: '/pages/appointment/appointment' });
  }
})
