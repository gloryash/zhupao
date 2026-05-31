const app = getApp();

Page({
  data: {
    orderId: '',
    orderInfo: null,
    orderStatus: 'pending',
    mapLatitude: null,
    mapLongitude: null,
    mapMarkers: [],
    polyline: [],

    // 实时统计
    runningStats: {
      totalDistance: 0,
      totalTime: 0,
      formattedTime: '0',
      avgSpeed: 0
    },

    // 轨迹追踪
    locationChangeListener: null,
    trackTimer: null,
    startTime: null,
    lastLocation: null,
    runningPath: []
  },

  onLoad(options) {
    if (options.orderId) {
      this.setData({ orderId: options.orderId });
    }
  },

  onShow() {
    this.loadOrderInfo();
    this.startPolling();
  },

  onHide() {
    this.stopPolling();
  },

  onUnload() {
    this.stopPolling();
    this.stopTracking();
  },

  /**
   * 加载订单信息
   */
  loadOrderInfo() {
    const orders = wx.getStorageSync('blind_orders') || [];
    const order = orders.find(o => o.id === this.data.orderId);

    if (order) {
      // 计算距离
      const volunteerInfo = wx.getStorageSync('userInfo_volunteer') || {};
      let distance = 0;
      if (volunteerInfo.latitude && volunteerInfo.longitude) {
        distance = this.calculateDistance(
          volunteerInfo.latitude,
          volunteerInfo.longitude,
          order.blindLatitude,
          order.blindLongitude
        );
      }

      // 设置地图标记
      let mapMarkers = [];
      let polyline = [];

      // 接单途中：志愿者（runner）+ 起点绿圆 + 绿色路径
      if (['accepted', 'arrived'].includes(order.status)) {
        // 起点绿圆 = 视障者位置
        mapMarkers.push({
          id: 2,
          latitude: order.blindLatitude,
          longitude: order.blindLongitude,
          width: 40,
          height: 40,
          iconPath: '/images/marker/dot-green.png',
          callout: {
            content: (order.blindName || '视障跑者') + '（起点）',
            display: 'ALWAYS',
            padding: 8,
            borderRadius: 6,
            bgColor: '#07C160',
            color: '#FFFFFF',
            fontSize: 12,
          },
        });
        // 志愿者跑者图标
        mapMarkers.push({
          id: 1,
          latitude: volunteerInfo.latitude || 31.2304,
          longitude: volunteerInfo.longitude || 121.4737,
          width: 48,
          height: 48,
          iconPath: '/images/marker/runner.png',
          callout: {
            content: '您',
            display: 'ALWAYS',
            padding: 8,
            borderRadius: 6,
            bgColor: '#07C160',
            color: '#FFFFFF',
            fontSize: 12,
          },
        });
        // 绿色路径：志愿者 → 视障者起点
        if (volunteerInfo.latitude && volunteerInfo.longitude) {
          polyline = [{
            points: [
              { latitude: volunteerInfo.latitude, longitude: volunteerInfo.longitude },
              { latitude: order.blindLatitude, longitude: order.blindLongitude },
            ],
            color: '#07C160',
            width: 6,
            dottedLine: false,
            arrowLine: true,
          }];
        }
      }

      // 陪跑中：起点绿 + 终点红 + 蓝色实时轨迹
      if (order.status === 'running') {
        // 起点绿
        mapMarkers.push({
          id: 2,
          latitude: order.blindLatitude,
          longitude: order.blindLongitude,
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
        // 终点红（若有 endAddress）
        const endAddr = order.endAddress;
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
        // 蓝色轨迹
        polyline = [{
          points: this.data.runningPath,
          color: '#1890FF',
          width: 6,
          dottedLine: false,
          arrowLine: true,
        }];
      }

      // 已完成状态只画起点/终点圆点（无路径）
      if (order.status === 'completed') {
        mapMarkers.push({
          id: 2,
          latitude: order.blindLatitude,
          longitude: order.blindLongitude,
          width: 40,
          height: 40,
          iconPath: '/images/marker/dot-green.png',
        });
        const endAddr = order.endAddress;
        if (endAddr && endAddr.latitude) {
          mapMarkers.push({
            id: 3,
            latitude: endAddr.latitude,
            longitude: endAddr.longitude,
            width: 40,
            height: 40,
            iconPath: '/images/marker/dot-red.png',
          });
        }
      }

      this.setData({
        orderInfo: order,
        orderStatus: order.status,
        mapLatitude: order.blindLatitude,
        mapLongitude: order.blindLongitude,
        mapMarkers: mapMarkers,
        polyline: polyline,
        distance: distance
      });
    }
  },

  /**
   * 开始轮询
   */
  startPolling() {
    this.pollingTimer = setInterval(() => {
      this.loadOrderInfo();
    }, 3000);
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
   * 计算两点间距离
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round(R * c * 10) / 10;
  },

  /**
   * 拨打电话
   */
  makeCall() {
    const phone = this.data.orderInfo?.blindPhone;
    if (phone) {
      wx.makePhoneCall({ phoneNumber: phone });
    } else {
      wx.showToast({ title: '暂无联系方式', icon: 'none' });
    }
  },

  /**
   * 导航前往
   */
  handleNavigate() {
    const { mapLatitude, mapLongitude, orderInfo } = this.data;
    wx.openLocation({
      latitude: mapLatitude,
      longitude: mapLongitude,
      name: orderInfo.blindName || '陪跑地点',
      address: orderInfo.blindAddress || '',
      scale: 18
    });
  },

  /**
   * 接单
   */
  handleAccept() {
    wx.vibrateShort();

    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        const volunteerInfo = wx.getStorageSync('userInfo_volunteer') || {};

        // 更新订单状态
        const orders = wx.getStorageSync('blind_orders') || [];
        const orderIndex = orders.findIndex(o => o.id === this.data.orderId);

        if (orderIndex !== -1) {
          orders[orderIndex].status = 'accepted';
          orders[orderIndex].volunteerLat = res.latitude;
          orders[orderIndex].volunteerLng = res.longitude;
          orders[orderIndex].volunteerPhone = volunteerInfo.phone;
          orders[orderIndex].volunteerName = volunteerInfo.name;
          orders[orderIndex].acceptedTime = new Date().toLocaleString();

          wx.setStorageSync('blind_orders', orders);

          this.setData({
            orderStatus: 'accepted',
            runningStats: { totalDistance: 0, totalTime: 0, formattedTime: '0', avgSpeed: 0 }
          });

          wx.showToast({ title: '接单成功', icon: 'success' });
        }
      },
      fail: () => {
        wx.showToast({ title: '定位失败', icon: 'none' });
      }
    });
  },

  /**
   * 确认到达
   */
  handleConfirmArrival() {
    wx.vibrateShort();

    const orders = wx.getStorageSync('blind_orders') || [];
    const orderIndex = orders.findIndex(o => o.id === this.data.orderId);

    if (orderIndex !== -1) {
      orders[orderIndex].status = 'arrived';
      wx.setStorageSync('blind_orders', orders);

      this.setData({ orderStatus: 'arrived' });

      wx.showModal({
        title: '已到达',
        content: '您已到达陪跑地点，请确认开始陪跑',
        showCancel: false,
        confirmText: '好的'
      });
    }
  },

  /**
   * 开始陪跑
   */
  handleStartRunning() {
    wx.vibrateLong();

    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        const orders = wx.getStorageSync('blind_orders') || [];
        const orderIndex = orders.findIndex(o => o.id === this.data.orderId);

        if (orderIndex !== -1) {
          orders[orderIndex].status = 'running';
          wx.setStorageSync('blind_orders', orders);

          this.setData({
            orderStatus: 'running',
            startTime: Date.now(),
            lastLocation: { latitude: res.latitude, longitude: res.longitude },
            runningPath: [{ latitude: res.latitude, longitude: res.longitude }]
          });

          // 开始轨迹追踪
          this.startTracking();

          wx.showToast({ title: '开始陪跑', icon: 'success' });
        }
      }
    });
  },

  /**
   * 开始轨迹追踪
   */
  startTracking() {
    this.data.startTime = Date.now();
    this.data.lastLocation = null;
    this.data.runningPath = [];

    this.locationChangeListener = wx.onLocationChange((res) => {
      const newPoint = { latitude: res.latitude, longitude: res.longitude };

      let segmentDistance = 0;
      if (this.data.lastLocation) {
        segmentDistance = this.calculateDistance(
          this.data.lastLocation.latitude,
          this.data.lastLocation.longitude,
          res.latitude,
          res.longitude
        );
      }
      this.data.lastLocation = newPoint;

      const totalDistance = this.data.runningStats.totalDistance + segmentDistance;
      const totalTime = Math.round((Date.now() - this.data.startTime) / 1000);

      this.data.runningPath.push(newPoint);

      this.setData({
        runningPath: this.data.runningPath,
        runningStats: {
          totalDistance: totalDistance,
          totalTime: totalTime,
          formattedTime: Math.floor(totalTime / 60).toString(),
          avgSpeed: totalTime > 0 ? (totalDistance / (totalTime / 3600)).toFixed(1) : 0
        },
        polyline: [{
          points: this.data.runningPath,
          color: '#07C160',
          width: 8,
          dottedLine: false,
          arrowLine: true
        }]
      });
    });

    wx.startLocationUpdate({
      type: 'gcj02',
      success: () => console.log('轨迹追踪已启动'),
      fail: (err) => console.error('轨迹追踪启动失败', err)
    });
  },

  /**
   * 停止轨迹追踪
   */
  stopTracking() {
    if (this.locationChangeListener) {
      this.locationChangeListener();
      this.locationChangeListener = null;
    }
    wx.stopLocationUpdate();
  },

  /**
   * 结束陪跑
   */
  handleEndRunning() {
    wx.vibrateShort();

    this.stopTracking();

    const stats = this.data.runningStats;

    const orders = wx.getStorageSync('blind_orders') || [];
    const orderIndex = orders.findIndex(o => o.id === this.data.orderId);

    if (orderIndex !== -1) {
      orders[orderIndex].status = 'completed';
      orders[orderIndex].completedTime = new Date().toLocaleString();
      wx.setStorageSync('blind_orders', orders);

      this.setData({ orderStatus: 'completed' });

      wx.showModal({
        title: '陪跑完成',
        content: `本次陪跑完成！\n里程: ${stats.totalDistance.toFixed(2)} km\n用时: ${Math.floor(stats.totalTime / 60)} 分钟`,
        showCancel: false,
        confirmText: '完成',
        success: () => {
          wx.navigateBack();
        }
      });
    }
  },

  /**
   * 取消订单
   */
  handleCancel() {
    wx.showModal({
      title: '取消订单',
      content: '确定要取消这个订单吗？',
      confirmText: '确定取消',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          const orders = wx.getStorageSync('blind_orders') || [];
          const orderIndex = orders.findIndex(o => o.id === this.data.orderId);

          if (orderIndex !== -1) {
            orders[orderIndex].status = 'cancelled';
            wx.setStorageSync('blind_orders', orders);

            wx.showToast({ title: '订单已取消', icon: 'none' });
            setTimeout(() => {
              wx.navigateBack();
            }, 1500);
          }
        }
      }
    });
  }
});
