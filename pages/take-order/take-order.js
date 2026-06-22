const app = getApp();
const fmt = require('../../utils/format');

Page({
  data: {
    // ============ 列表 / 详情视图切换 ============
    viewMode: 'list',          // list | detail
    nearbyOrders: [],          // mock 12 个附近订单
    filteredOrders: [],        // 应用筛选后
    filters: {
      distanceMax: 5,          // 1 / 3 / 5 km
      gender: 'all',           // all | male | female
      ageRange: 'all',         // all | <30 | 30-50 | >50
      timeSlot: 'all',         // all | morning | afternoon | evening
      city: 'all',
    },
    distanceFilters: [{ k: 1, label: '1km' }, { k: 3, label: '3km' }, { k: 5, label: '5km' }],
    genderFilters: [{ k: 'all', label: '全部' }, { k: 'male', label: '男' }, { k: 'female', label: '女' }],
    ageFilters: [{ k: 'all', label: '全部' }, { k: '<30', label: '<30' }, { k: '30-50', label: '30-50' }, { k: '>50', label: '>50' }],
    timeFilters: [{ k: 'all', label: '全部' }, { k: 'morning', label: '上午' }, { k: 'afternoon', label: '下午' }, { k: 'evening', label: '晚间' }],
    activeFilterPanel: null,   // null | 'distance' | 'gender' | 'age' | 'time'

    // ============ 旧版字段（保留） ============
    hasNewOrder: false,
    latitude: null,
    longitude: null,
    markers: [],
    orderStatus: 'waiting', // waiting: 等待接单, accepted: 已接单, arrived: 已到达, running: 陪跑中, completed: 已完成
    orderInfo: null,
    volunteerLatitude: null,
    volunteerLongitude: null,
    locationReady: false,
    distance: null,
    navigationPolyline: [],
    runningPath: [],
    runningPolyline: [],
    runningStats: {
      totalDistance: 0,
      totalTime: 0,
      avgSpeed: 0
    },
    rating: {
      blindRate: 0,
      volunteerRate: 0,
      blindComment: '',
      volunteerComment: ''
    },
    hasRated: false,
    showRatingPopup: false
  },

  /**
   * 获取格式化后的时间（分钟）
   */
  getFormattedTime() {
    const seconds = this.data.runningStats.totalTime || 0;
    if (seconds < 60) return '0';
    return Math.floor(seconds / 60).toString();
  },

  /**
   * 获取状态文本
   */
  getStatusText(status) {
    const statusMap = {
      waiting: '等待接单',
      accepted: '已接单',
      arrived: '已到达',
      running: '陪跑中',
      completed: '已完成'
    };
    return statusMap[status] || '未知';
  },

  /**
   * 生命周期回调
   */

  /**
   * 计算两点之间的距离（实现见文件末尾，统一返回 2 位小数 km）
   */

  /**
   * 格式化时间（分钟转友好格式）
   */
  formatDuration(minutes) {
    if (minutes < 60) {
      return `${minutes}分钟`;
    } else {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
    }
  },

  onShow() {
    // 检查志愿者证书状态
    const hasCertificate = wx.getStorageSync('exam_passed');

    if (!hasCertificate) {
      wx.showModal({
        title: '暂未通过考核',
        content: '您尚未通过志愿者考核，请先完成培训教程并领取证书后方可接单。',
        confirmText: '去考核',
        cancelText: '返回',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/training-flow/training-flow' });
          } else {
            wx.switchTab({ url: '/pages/home/home' });
          }
        }
      });
      return;
    }

    // 获取志愿者当前位置，拿到后生成 mock 订单列表
    this.getVolunteerLocation();
  },

  /**
   * 开始轮询新订单
   */
  _startOrderPolling() {
    this._stopOrderPolling();
    this._orderPollingTimer = setInterval(() => {
      // 只在等待接单状态下轮询
      if (this.data.orderStatus === 'waiting' && !this.data.hasNewOrder) {
        this.checkForNewOrders();
      }
    }, 5000);
  },

  /**
   * 停止轮询新订单
   */
  _stopOrderPolling() {
    if (this._orderPollingTimer) {
      clearInterval(this._orderPollingTimer);
      this._orderPollingTimer = null;
    }
  },

  /**
   * 检查是否有新的订单
   */
  checkForNewOrders() {
    const volunteerInfo = wx.getStorageSync('userInfo_volunteer');
    const volunteerPhone = volunteerInfo ? volunteerInfo.phone : null;
    if (!volunteerPhone) return;

    // 优先从云数据库查询新订单
    this.checkCloudOrders().then(hasCloudOrder => {
      if (hasCloudOrder) {
        return; // 已处理云端订单
      }

      // 云端没有订单，降级到本地检查
      this._checkLocalOrders(volunteerPhone);
    }).catch(err => {
      console.error('【云端查询失败】', err);
      // 云端查询失败，降级到本地检查
      this._checkLocalOrders(volunteerPhone);
    });
  },

  /**
   * 本地降级检查订单（云端失败时使用）
   */
  _checkLocalOrders(volunteerPhone) {
    // 检查本地存储
    const orders = wx.getStorageSync('blind_orders') || [];
    const myOrder = orders.find(o => o.volunteerPhone === volunteerPhone && o.status === 'pending');

    if (myOrder) {
      // 有新订单
      wx.vibrateShort();
      this.setData({
        hasNewOrder: true,
        orderStatus: 'waiting',
        latitude: myOrder.blindLatitude,
        longitude: myOrder.blindLongitude,
        locationReady: true,
        orderInfo: {
          ...myOrder,
          userName: myOrder.blindName,
          phone: myOrder.blindPhone,
          targetDistance: '5公里',
          estimatedDuration: this.formatDuration(60)
        },
        markers: [{
          id: 1,
          latitude: myOrder.blindLatitude,
          longitude: myOrder.blindLongitude,
          width: 50,
          height: 50,
          callout: {
            content: '🏃 ' + (myOrder.blindName || '视障跑者'),
            display: 'ALWAYS',
            padding: 10,
            borderRadius: 8,
            bgColor: '#ffffff',
            color: '#333333',
            fontSize: 14
          }
        }]
      });

      wx.showModal({
        title: '有新订单！',
        content: `${myOrder.blindName}向您发起了陪跑请求`,
        confirmText: '立即接单',
        cancelText: '稍后处理',
        success: (res) => {
          if (res.confirm) {
            this.handleAccept();
          }
        }
      });
    } else if (app.globalData.isNeedLighted === true) {
      // 原有逻辑：发现光点
      console.log("【发现光点】坐标为:", app.globalData.userLocation);
      const loc = app.globalData.userLocation;
      const orderInfo = app.globalData.orderInfo || {};

      this.setData({
        hasNewOrder: true,
        latitude: loc.latitude,
        longitude: loc.longitude,
        locationReady: true,
        orderInfo: {
          ...orderInfo,
          targetDistance: orderInfo.targetDistance || '5公里',
          estimatedDuration: orderInfo.estimatedDuration || this.formatDuration(60)
        },
        markers: [{
          id: 1,
          latitude: loc.latitude,
          longitude: loc.longitude,
          width: 50,
          height: 50,
          callout: {
            content: '🏃 ' + (orderInfo.userName || '视障跑者'),
            display: 'ALWAYS',
            padding: 10,
            borderRadius: 8,
            bgColor: '#ffffff',
            color: '#333333',
            fontSize: 14
          }
        }]
      });
    } else {
      this.setData({ hasNewOrder: false, markers: [], orderInfo: null, orderStatus: 'waiting' });
    }
  },

  /**
   * 从云数据库查询新订单（通过云函数，绕过客户端权限限制）
   */
  checkCloudOrders() {
    return new Promise((resolve, reject) => {
      const volLat = this.data.volunteerLatitude;
      const volLng = this.data.volunteerLongitude;

      app.getWaitingOrders(1, volLat, volLng)
        .then(res => {
          console.log('【云端订单】查询结果:', res);

          if (res.success && res.orders && res.orders.length > 0) {
            // 找到第一个等待中的订单
            const order = res.orders[0];
            const startAddress = fmt.startAddress(order);
            const destinationAddress = fmt.destinationAddress(order);
            const orderStart = fmt.orderStart(order);
            const orderDestination = fmt.orderDestination(order);

            // 显示新订单
            wx.vibrateShort();
            this.setData({
              hasNewOrder: true,
              orderStatus: 'waiting',
              latitude: (orderStart && orderStart.latitude) || order.latitude,
              longitude: (orderStart && orderStart.longitude) || order.longitude,
              locationReady: true,
              orderInfo: {
                id: order._id,
                orderId: order._id,
                userName: order.userName,
                phone: order.phone || '',
                targetDistance: order.targetDistance,
                estimatedDuration: order.estimatedDuration,
                latitude: (orderStart && orderStart.latitude) || order.latitude,
                longitude: (orderStart && orderStart.longitude) || order.longitude,
                startAddress: startAddress ? { name: startAddress, address: startAddress, ...(orderStart || {}) } : null,
                endAddress: destinationAddress ? { name: destinationAddress, address: destinationAddress, ...(orderDestination || {}) } : null,
                address: startAddress || order.address || '视障人士位置'
              },
              markers: [{
                id: 1,
                latitude: (orderStart && orderStart.latitude) || order.latitude,
                longitude: (orderStart && orderStart.longitude) || order.longitude,
                width: 50,
                height: 50,
                callout: {
                  content: '🏃 ' + (order.userName || '视障跑者'),
                  display: 'ALWAYS',
                  padding: 10,
                  borderRadius: 8,
                  bgColor: '#ffffff',
                  color: '#333333',
                  fontSize: 14
                }
              }]
            });

            wx.showModal({
              title: '有新订单！',
              content: `${order.userName}向您发起了陪跑请求`,
              confirmText: '立即接单',
              cancelText: '稍后处理',
              success: (modalRes) => {
                if (modalRes.confirm) {
                  this.handleAccept();
                }
              }
            });

            resolve(true);
          } else {
            resolve(false);
          }
        })
        .catch(err => {
          console.error('【云端查询失败】', err);
          reject(err);
        });
    });
  },

  /**
   * 获取志愿者当前位置（带权限检查）
   */
  getVolunteerLocation() {
    wx.getSetting({
      success: (res) => {
        if (res.authSetting['scope.userLocation']) {
          this.doGetLocation();
        } else {
          wx.authorize({
            scope: 'scope.userLocation',
            success: () => this.doGetLocation(),
            fail: () => {
              // dev 静默回退：用上海默认坐标继续，仍生成 mock 列表
              console.log('[dev] 位置权限未授权，使用默认坐标');
              this.setData({
                volunteerLatitude: 31.2304,
                volunteerLongitude: 121.4737,
                latitude: 31.2304,
                longitude: 121.4737,
                locationReady: true,
              });
              this.generateMockOrders();
              this.applyFilters();
              this.renderListMarkers();
            }
          });
        }
      }
    });
  },

  /**
   * 执行获取位置
   */
  doGetLocation() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({
          volunteerLatitude: res.latitude,
          volunteerLongitude: res.longitude,
          latitude: res.latitude,
          longitude: res.longitude,
          locationReady: true
        });

        // 拿到位置后立即生成 mock 订单列表并刷新地图
        this.generateMockOrders();
        this.applyFilters();
        this.renderListMarkers();

        // 旧逻辑兼容：若全局有 isNeedLighted，计算距离（不再自动弹窗）
        if (app.globalData.isNeedLighted === true && app.globalData.orderInfo) {
          const distance = this.calculateDistance(
            res.latitude, res.longitude,
            app.globalData.orderInfo.latitude, app.globalData.orderInfo.longitude
          );
          this.setData({ distance });
        }
      },
      fail: () => {
        // dev 静默回退：用上海默认坐标
        console.log('[dev] 定位失败，使用默认坐标');
        this.setData({
          volunteerLatitude: 31.2304,
          volunteerLongitude: 121.4737,
          latitude: 31.2304,
          longitude: 121.4737,
          locationReady: true,
        });
        this.generateMockOrders();
        this.applyFilters();
        this.renderListMarkers();
      }
    });
  },

  /**
   * 志愿者接单
   */
  handleAccept() {
    if (!this.data.hasNewOrder) {
      wx.showToast({
        title: '暂无需求',
        icon: 'none'
      });
      return;
    }

    // 震动反馈
    wx.vibrateShort();

    // 获取志愿者当前位置
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        const { latitude: volLat, longitude: volLng } = res;
        const { latitude: blindLat, longitude: blindLng } = this.data;

        // 绘制导航路线（直线）
        const navigationPolyline = [{
          points: [
            { latitude: volLat, longitude: volLng },
            { latitude: blindLat, longitude: blindLng }
          ],
          color: '#07c160',
          width: 8,
          dottedLine: false,
          arrowLine: true,
          borderColor: '#05a850',
          borderWidth: 2
        }];

        // 更新状态和导航路线
        this.setData({
          orderStatus: 'accepted',
          volunteerLatitude: volLat,
          volunteerLongitude: volLng,
          navigationPolyline: navigationPolyline
        });

        // 获取志愿者信息
        const volunteerInfo = wx.getStorageSync('userInfo_volunteer') || {};

        // 更新全局订单信息，通知盲人端（本地备份）
        app.globalData.orderInfo = {
          ...app.globalData.orderInfo,
          volunteerName: volunteerInfo.name || '志愿者',
          volunteerPhone: volunteerInfo.phone || '',
          volunteerLat: volLat,
          volunteerLng: volLng,
          status: 'accepted',
          acceptedTime: new Date().toLocaleString()
        };

        // 更新订单状态到存储
        const orders = wx.getStorageSync('blind_orders') || [];
        const orderIndex = orders.findIndex(o => o.id === this.data.orderInfo.id);
        if (orderIndex !== -1) {
          orders[orderIndex].status = 'accepted';
          orders[orderIndex].acceptedTime = new Date().toLocaleString();
          wx.setStorageSync('blind_orders', orders);
        }

        // 保存导航状态，用于返回时识别
        wx.setStorageSync('volunteerNavigating', {
          orderId: this.data.orderInfo.id,
          status: 'navigating',
          startTime: Date.now()
        });

        // 如果有云端订单ID，调用云函数更新状态
        if (this.data.orderInfo.orderId) {
          wx.showLoading({ title: '接单中...' });

          app.acceptOrder(this.data.orderInfo.orderId)
            .then(result => {
              wx.hideLoading();
              console.log('【云端接单成功】', result);

              // 显示接单成功
              this.showAcceptSuccessModal();
            })
            .catch(err => {
              wx.hideLoading();
              console.error('【云端接单失败】', err);

              // 即使云端失败，本地状态已更新，仍可继续
              this.showAcceptSuccessModal();
            });
        } else {
          // 没有云端订单ID，直接显示成功
          this.showAcceptSuccessModal();
        }

        console.log("【接单成功】志愿者已接单，路线已绘制");
      },
      fail: () => {
        // 如果获取位置失败，仍更新状态
        this.setData({
          orderStatus: 'accepted'
        });
        wx.showToast({
          title: '接单成功',
          icon: 'success'
        });
      }
    });
  },

  /**
   * 显示接单成功弹窗
   */
  showAcceptSuccessModal() {
    wx.showModal({
      title: '接单成功',
      content: `正在前往帮助 ${this.data.orderInfo.userName || '视障跑者'}`,
      showCancel: true,
      cancelText: '稍后导航',
      confirmText: '开始导航',
      success: (resConfirm) => {
        if (resConfirm.confirm) {
          // 打开地图导航
          const { latitude, longitude, orderInfo } = this.data;
          wx.openLocation({
            latitude,
            longitude,
            name: orderInfo.userName || '陪跑地点',
            address: orderInfo.address || '视障人士位置',
            scale: 18
          });
        }
      }
    });
  },

  /**
   * 拨打电话
   */
  handleCall() {
    const { orderInfo } = this.data;
    if (orderInfo && orderInfo.phone) {
      wx.makePhoneCall({
        phoneNumber: orderInfo.phone,
        success: () => console.log('拨打电话成功'),
        fail: (err) => console.log('拨打电话失败', err)
      });
    } else {
      wx.showToast({
        title: '暂无联系方式',
        icon: 'none'
      });
    }
  },

  /**
   * 重新导航
   */
  handleNavigate() {
    const { latitude, longitude, orderInfo } = this.data;
    wx.openLocation({
      latitude,
      longitude,
      name: orderInfo.userName || '陪跑地点',
      address: orderInfo.address || '视障人士位置',
      scale: 18
    });
  },

  /**
   * 跳转到预约广场
   */
  goToAppointmentSquare() {
    wx.navigateTo({
      url: '/pages/appointment-square/appointment-square'
    });
  },

  /**
   * 确认到达
   */
  handleConfirmArrival() {
    wx.vibrateShort();

    this.setData({
      orderStatus: 'arrived'
    });

    // 同步到云端
    if (this.data.orderInfo && this.data.orderInfo.orderId) {
      app.updateOrderStatus(this.data.orderInfo.orderId, 'arrived').catch(err => {
        console.error('云端更新到达状态失败:', err);
      });
    }

    // 无障碍强提醒：确保读屏软件播报到达状态
    wx.showModal({
      title: '已到达',
      content: '您已到达视障跑者身边，请确认开始陪跑',
      showCancel: false,
      confirmText: '我知道了',
      success: () => {
        console.log("【确认到达】志愿者已到达目标位置");
      }
    });
  },

  /**
   * 开始陪跑
   */
  handleStartRunning() {
    wx.vibrateLong();

    // 获取起始位置
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({
          orderStatus: 'running',
          runningPath: [{
            latitude: res.latitude,
            longitude: res.longitude,
            time: new Date().getTime()
          }]
        });

        // 开始记录轨迹
        this.startTracking();

        // 更新全局订单状态，通知盲人端
        app.globalData.orderInfo = {
          ...app.globalData.orderInfo,
          status: 'running'
        };

        // 同步到云端
        if (this.data.orderInfo && this.data.orderInfo.orderId) {
          app.updateOrderStatus(this.data.orderInfo.orderId, 'running').catch(err => {
            console.error('云端更新陪跑状态失败:', err);
          });
        }
      }
    });

    wx.showModal({
      title: '开始陪跑',
      content: '祝您和视障人士有一个愉快的陪跑体验！',
      showCancel: false,
      confirmText: '好的'
    });

    console.log("【开始陪跑】陪跑活动开始");
  },

  /**
   * 开始轨迹追踪 - 使用 onLocationChange 实现实时轨迹
   */
  startTracking() {
    const startTime = new Date().getTime();
    let lastLocation = null;
    let lastSyncTime = 0; // 上次云端同步时间

    // 使用 onLocationChange 监听位置变化
    this.locationChangeListener = wx.onLocationChange((res) => {
      const newPoint = {
        latitude: res.latitude,
        longitude: res.longitude,
        speed: res.speed,
        accuracy: res.accuracy,
        time: new Date().getTime()
      };

      // 计算本次移动距离
      let segmentDistance = 0;
      if (lastLocation) {
        segmentDistance = this.calculateDistance(
          lastLocation.latitude, lastLocation.longitude,
          res.latitude, res.longitude
        );
      }
      lastLocation = newPoint;

      // 获取当前统计数据
      const currentStats = this.data.runningStats || { totalDistance: 0, totalTime: 0 };

      const newPath = [...this.data.runningPath, newPoint];
      const totalDistance = currentStats.totalDistance + segmentDistance;
      const totalTime = Math.round((newPoint.time - startTime) / 1000); // 秒

      const newStats = {
        totalDistance: totalDistance,
        totalTime: totalTime,
        formattedTime: Math.floor(totalTime / 60).toString(),
        avgSpeed: totalTime > 0 ? (totalDistance / (totalTime / 3600)).toFixed(1) : 0 // km/h
      };

      // 更新轨迹线、路径和统计
      this.setData({
        runningPath: newPath,
        runningPolyline: [{
          points: newPath,
          color: '#07c160',
          width: 8,
          dottedLine: false,
          arrowLine: true
        }],
        runningStats: newStats
      });

      // 每5秒同步一次跑步数据到云端（盲人端可实时查看）
      const now = Date.now();
      if (now - lastSyncTime >= 5000) {
        lastSyncTime = now;
        const orderId = this.data.orderInfo && this.data.orderInfo.orderId;
        if (orderId) {
          // 只传最近100个轨迹点，避免数据过大
          const pathToSync = newPath.slice(-100).map(p => ({
            latitude: p.latitude,
            longitude: p.longitude
          }));
          app.updateVolunteerLocation(orderId, res.latitude, res.longitude, newStats, pathToSync).catch(err => {
            console.error('同步跑步数据失败:', err);
          });
        }
      }
    });

    // 开始持续定位
    wx.startLocationUpdate({
      type: 'gcj02',
      success: () => {
        console.log("【轨迹追踪】已开始监听位置变化");
      },
      fail: (err) => {
        console.error("【轨迹追踪】启动失败", err);
        wx.showToast({
          title: '定位启动失败',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 停止轨迹追踪
   */
  stopTracking() {
    // 停止监听位置变化
    if (this.locationChangeListener) {
      this.locationChangeListener();
      this.locationChangeListener = null;
    }

    // 停止持续定位
    wx.stopLocationUpdate();

    if (this.trackTimer) {
      clearInterval(this.trackTimer);
      this.trackTimer = null;
    }
  },

  /**
   * 格式化时间显示
   */
  formatTime(seconds) {
    if (seconds < 60) {
      return `${seconds}秒`;
    } else if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}分${secs}秒`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      return `${hours}时${mins}分`;
    }
  },

  /**
   * 计算两点间距离（Haversine公式）— 返回 2 位小数 km
   * 注：原先文件里有两个同名实现，已合并为统一版本（保留 2 位小数）
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100;
  },

  /**
   * 结束陪跑
   */
  handleEndRunning() {
    wx.vibrateShort();

    this.stopTracking();

    // 使用实时统计的数据
    const stats = this.data.runningStats;
    const duration = Math.round(stats.totalTime / 60); // 转换为分钟

    this.setData({
      orderStatus: 'completed',
      showRatingPopup: true,
      runningDuration: duration,
      finalStats: stats
    });

    // 同步完成状态到云端
    if (this.data.orderInfo && this.data.orderInfo.orderId) {
      app.completeOrder(this.data.orderInfo.orderId, {
        actualDistance: stats.totalDistance.toFixed(2),
        duration: stats.totalTime
      }).catch(err => {
        console.error('云端完成订单失败:', err);
      });
    }

    console.log("【陪跑结束】总里程:", stats.totalDistance, "km，总用时:", this.formatTime(stats.totalTime));
  },

  /**
   * 提交评价
   */
  submitRating() {
    const { rating, hasRated, orderInfo, runningDuration, distance, runningStats, runningPath } = this.data;
    if (hasRated) return;

    // 获取志愿者信息
    const volunteerInfo = wx.getStorageSync('userInfo_volunteer') || {};

    // 构建陪跑记录
    const record = {
      id: Date.now(),
      volunteerName: volunteerInfo.name || '未命名志愿者',
      volunteerPhone: volunteerInfo.phone || '',
      blindName: orderInfo.userName || '未命名视障者',
      blindPhone: orderInfo.phone || '',
      blindAvatar: orderInfo.avatarUrl || '',
      targetDistance: orderInfo.targetDistance || '',
      estimatedDuration: orderInfo.estimatedDuration || '',
      actualDistance: (runningStats.totalDistance || distance).toString(),
      duration: runningDuration || 0,
      avgSpeed: runningStats.avgSpeed || 0,
      location: orderInfo.startLocation || '',
      runType: orderInfo.runType || '跑步',
      completedTime: new Date().toLocaleString(),
      // 保存轨迹点用于回放
      trajectoryPath: runningPath.map(p => ({
        lat: p.latitude,
        lng: p.longitude,
        time: p.time
      })),
      // 评价信息
      volunteerRate: rating.volunteerRate,
      blindComment: rating.volunteerComment,
      blindRate: rating.blindRate,
      volunteerComment: rating.blindComment
    };

    // 保存到后台记录
    const records = wx.getStorageSync('companion_records') || [];
    records.unshift(record);
    wx.setStorageSync('companion_records', records);

    // 同步陪跑记录到云端
    app.saveCompanionRecord({
      orderId: orderInfo.orderId || '',
      partnerName: orderInfo.userName || '',
      partnerType: 'disabled',
      distance: runningStats.totalDistance || 0,
      duration: runningStats.totalTime || 0,
      rating: rating.volunteerRate || 0,
      comment: rating.volunteerComment || '',
      startTime: record.completedTime,
      endTime: new Date().toLocaleString()
    }).catch(err => {
      console.error('云端保存陪跑记录失败:', err);
    });

    // 奖励志愿者：完成陪跑 +50经验 +10积分（本地备份，云端已在completeOrder中处理）
    const volunteerReward = app.addPointsAndExp('volunteer', 'run');

    // 奖励视障用户：完成运动 +30经验
    app.addPointsAndExp('disabled', 'run');

    console.log('【记录保存】陪跑记录已保存:', record);
    console.log('【积分奖励】志愿者获得:', volunteerReward);

    // 模拟提交评价
    wx.showLoading({ title: '提交中...' });

    setTimeout(() => {
      wx.hideLoading();
      this.setData({ hasRated: true, showRatingPopup: false });

      wx.showModal({
        title: '感谢您的付出',
        content: `本次陪跑已记录！\n获得 +${volunteerReward.exp}经验，+${volunteerReward.points}积分\n期待您的下一次陪伴！`,
        showCancel: false,
        confirmText: '完成',
        success: () => {
          // 重置页面状态（本地记录已清空，但后台已有保存）
          this.setData({
            hasNewOrder: false,
            orderStatus: 'waiting',
            orderInfo: null,
            markers: [],
            runningPath: [],
            runningPolyline: [],
            runningStats: { totalDistance: 0, totalTime: 0, formattedTime: '0', avgSpeed: 0 },
            rating: { blindRate: 0, volunteerRate: 0, blindComment: '', volunteerComment: '' },
            hasRated: false
          });
        }
      });
    }, 500);
  },

  /**
   * 设置评分
   */
  setRating(e) {
    const { type, score } = e.currentTarget.dataset;
    this.setData({
      [`rating.${type}`]: score
    });
  },

  /**
   * 更新评论
   */
  onCommentInput(e) {
    const { type } = e.currentTarget.dataset;
    this.setData({
      [`rating.${type}Comment`]: e.detail.value
    });
  },

  /**
   * 关闭评价弹窗
   */
  closeRatingPopup() {
    if (this.data.hasRated) {
      this.setData({ showRatingPopup: false });
    }
  },

  onHide() {
    // 页面隐藏时停止轨迹追踪和轮询
    this.stopTracking();
    this._stopOrderPolling();
  },

  onUnload() {
    // 页面卸载时停止轨迹追踪和轮询
    this.stopTracking();
    this._stopOrderPolling();
  },

  // ========================================================
  // ================ 列表 + 筛选 (新增) =====================
  // ========================================================

  /**
   * 生成 mock 附近订单（基于志愿者位置 5km 内随机分布）
   */
  generateMockOrders() {
    const { volunteerLatitude: vLat, volunteerLongitude: vLng } = this.data;
    if (!vLat || !vLng) return;

    const NAMES = ['李明', '王芳', '张伟', '刘洋', '陈静', '杨帆', '赵磊', '周琳', '吴桐', '徐宁', '孙雨', '马超'];
    const CITIES = ['上海', '上海', '上海', '北京', '杭州'];
    const ROUTES = [
      { start: '世纪公园 1 号门', end: '滨江绿地' },
      { start: '人民公园', end: '南京西路' },
      { start: '陆家嘴绿地', end: '东方明珠' },
      { start: '中山公园', end: '苏州河畔' },
      { start: '复兴公园', end: '新天地' },
      { start: '徐家汇公园', end: '衡山路' },
      { start: '世博公园', end: '后滩湿地' },
      { start: '共青森林公园', end: '黄浦江畔' },
      { start: '长风公园', end: '苏州河' },
      { start: '辰山植物园', end: '佘山' },
      { start: '上海植物园', end: '徐汇滨江' },
      { start: '虹口足球场', end: '鲁迅公园' },
    ];
    const DURATIONS = ['30分钟', '1小时', '1.5小时', '2小时'];
    const TIME_SLOTS = ['morning', 'afternoon', 'evening'];
    const TIME_LABELS = { morning: '08:30', afternoon: '14:00', evening: '19:00' };

    const orders = [];
    for (let i = 0; i < 12; i++) {
      // 在 4.4km 内随机点（控制在 5km 边界内，避免浮点误差越界被 distanceMax=5 过滤）
      const angle = Math.random() * 2 * Math.PI;
      const radius = Math.sqrt(Math.random()) * 0.04;
      const lat = vLat + radius * Math.cos(angle);
      const lng = vLng + radius * Math.sin(angle) / Math.cos(vLat * Math.PI / 180);

      const dist = this.calculateDistance(vLat, vLng, lat, lng);
      const route = ROUTES[i % ROUTES.length];
      const gender = i % 2 === 0 ? 'male' : 'female';
      // 年龄分布：4 个 <30，5 个 30-50，3 个 >50
      const ageRaw = i < 4 ? (22 + i * 2) : (i < 9 ? (32 + (i - 4) * 4) : (52 + (i - 9) * 5));
      const timeSlot = TIME_SLOTS[i % 3];

      orders.push({
        id: `mock_${i + 1}`,
        orderId: null,                                    // mock 无云端 ID
        userName: NAMES[i] || `视障跑者${i + 1}`,
        gender,
        age: ageRaw,
        avatarEmoji: gender === 'male' ? '👨' : '👩',
        city: CITIES[i % CITIES.length],
        latitude: lat,
        longitude: lng,
        distance: dist,                                   // km
        startAddress: { name: route.start },
        endAddress: { name: route.end },
        targetDistance: `${(2 + i % 8).toFixed(1)}公里`,
        estimatedDuration: DURATIONS[i % DURATIONS.length],
        timeSlot,
        timeLabel: TIME_LABELS[timeSlot],
      });
    }

    // 按距离排序
    orders.sort((a, b) => a.distance - b.distance);
    this.setData({ nearbyOrders: orders });
  },

  /**
   * 应用当前筛选
   */
  applyFilters() {
    const { nearbyOrders, filters } = this.data;
    const filtered = nearbyOrders.filter(o => {
      if (filters.distanceMax && o.distance > filters.distanceMax) return false;
      if (filters.gender !== 'all' && o.gender !== filters.gender) return false;
      if (filters.ageRange !== 'all') {
        if (filters.ageRange === '<30' && o.age >= 30) return false;
        if (filters.ageRange === '30-50' && (o.age < 30 || o.age > 50)) return false;
        if (filters.ageRange === '>50' && o.age <= 50) return false;
      }
      if (filters.timeSlot !== 'all' && o.timeSlot !== filters.timeSlot) return false;
      if (filters.city !== 'all' && o.city !== filters.city) return false;
      return true;
    });
    this.setData({ filteredOrders: filtered });
    // 列表模式同步刷新地图 markers
    if (this.data.viewMode === 'list') this.renderListMarkers();
  },

  /**
   * 列表模式：把 filteredOrders 全部画到地图上（橙色小圆点）
   */
  renderListMarkers() {
    const markers = (this.data.filteredOrders || []).map((o, idx) => ({
      id: 1000 + idx,
      latitude: o.latitude,
      longitude: o.longitude,
      iconPath: '/images/marker/dot-green.png',
      width: 28,
      height: 28,
    }));
    this.setData({ markers });
  },

  /**
   * 切换筛选面板
   */
  toggleFilterPanel(e) {
    const key = e.currentTarget.dataset.panel;
    this.setData({
      activeFilterPanel: this.data.activeFilterPanel === key ? null : key,
    });
  },

  closeFilterPanel() {
    this.setData({ activeFilterPanel: null });
  },

  /**
   * 设置筛选值
   */
  setFilter(e) {
    const { type, value } = e.currentTarget.dataset;
    // distanceMax 是数字
    const v = type === 'distanceMax' ? Number(value) : value;
    this.setData({ [`filters.${type}`]: v, activeFilterPanel: null });
    this.applyFilters();
  },

  /**
   * 点击列表项 → 进入详情视图
   */
  selectOrder(e) {
    const idx = e.currentTarget.dataset.index;
    const order = this.data.filteredOrders[idx];
    if (!order) return;

    wx.vibrateShort();

    // 写入兼容旧状态机的字段
    this.setData({
      viewMode: 'detail',
      hasNewOrder: true,
      orderStatus: 'waiting',
      latitude: order.latitude,
      longitude: order.longitude,
      orderInfo: {
        ...order,
        startLocation: order.startAddress && order.startAddress.name,
      },
      markers: [{
        id: 1,
        latitude: order.latitude,
        longitude: order.longitude,
        iconPath: '/images/marker/dot-green.png',
        width: 40,
        height: 40,
        callout: {
          content: `🏃 ${order.userName} · ${order.distance}km`,
          display: 'ALWAYS',
          padding: 10,
          borderRadius: 8,
          bgColor: '#FFFFFF',
          color: '#1A1A1A',
          fontSize: 14,
        },
      }],
    });
  },

  /**
   * 返回列表
   */
  backToList() {
    this.setData({
      viewMode: 'list',
      hasNewOrder: false,
      orderInfo: null,
      orderStatus: 'waiting',
      navigationPolyline: [],
      runningPolyline: [],
    });
    // 回到自身位置
    if (this.data.volunteerLatitude) {
      this.setData({
        latitude: this.data.volunteerLatitude,
        longitude: this.data.volunteerLongitude,
      });
    }
    this.renderListMarkers();
  },
});
