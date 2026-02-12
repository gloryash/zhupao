const app = getApp();

Page({
  data: {
    hasNewOrder: false,
    latitude: null,  // 初始为空，获取位置后设置
    longitude: null,
    markers: [],
    orderStatus: 'waiting', // waiting: 等待接单, accepted: 已接单, arrived: 已到达, running: 陪跑中, completed: 已完成
    // 订单详细信息
    orderInfo: null,
    // 志愿者当前位置
    volunteerLatitude: null,
    volunteerLongitude: null,
    // 位置获取状态
    locationReady: false,
    // 距离（公里，精确到小数点后一位）
    distance: null,
    // 导航路线
    navigationPolyline: [],
    // 陪跑轨迹点
    runningPath: [],
    // 轨迹线
    runningPolyline: [],
    // 实时运动统计
    runningStats: {
      totalDistance: 0,  // 总距离(km)
      totalTime: 0,      // 总时间(秒)
      avgSpeed: 0        // 平均速度(km/h)
    },
    // 评价数据
    rating: {
      blindRate: 0,      // 盲人对志愿者的评分
      volunteerRate: 0,  // 志愿者对盲人的评分
      blindComment: '',  // 盲人评论
      volunteerComment: '' // 志愿者评论
    },
    // 是否已评价
    hasRated: false,
    // 评价弹窗
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
   * 计算两点之间的距离（Haversine公式）
   * @param {number} lat1 - 第一个点的纬度
   * @param {number} lon1 - 第一个点的经度
   * @param {number} lat2 - 第二个点的纬度
   * @param {number} lon2 - 第二个点的经度
   * @returns {number} 距离（公里，保留一位小数）
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // 地球半径（公里）
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return Math.round(distance * 10) / 10; // 保留一位小数
  },

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
      // 未通过考核，显示提示并跳转到培训页面
      wx.showModal({
        title: '暂未通过考核',
        content: '您尚未通过志愿者考核，请先完成培训教程并领取证书后方可接单。',
        confirmText: '去考核',
        cancelText: '返回',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/training-flow/training-flow'
            });
          } else {
            // 返回首页
            wx.switchTab({
              url: '/pages/home/home'
            });
          }
        }
      });
      return;
    }

    console.log("【志愿者端】正在检查信号...", app.globalData.isNeedLighted);

    // 获取志愿者当前位置
    this.getVolunteerLocation();

    // 检查是否有盲人下的订单
    this.checkForNewOrders();
  },

  onHide() {
    // 页面隐藏时停止轨迹追踪
    this.stopTracking();
  },

  onUnload() {
    // 页面卸载时停止轨迹追踪
    this.stopTracking();
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

      // 如果云端没有订单，检查本地存储
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
    }).catch(err => {
      console.error('【云端查询失败】', err);
      // 云端查询失败，继续使用本地逻辑
    });
  },

  /**
   * 从云数据库查询新订单
   */
  checkCloudOrders() {
    return new Promise((resolve, reject) => {
      const db = wx.cloud.database();

      db.collection('orders')
        .where({
          status: 'waiting' // 查询等待中的订单
        })
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get()
        .then(res => {
          console.log('【云端订单】查询结果:', res.data);

          if (res.data && res.data.length > 0) {
            // 找到第一个等待中的订单
            const order = res.data[0];

            // 显示新订单
            wx.vibrateShort();
            this.setData({
              hasNewOrder: true,
              orderStatus: 'waiting',
              latitude: order.latitude,
              longitude: order.longitude,
              locationReady: true,
              orderInfo: {
                id: order._id,
                orderId: order._id,
                userName: order.userName,
                phone: order.phone || '',
                targetDistance: order.targetDistance,
                estimatedDuration: order.estimatedDuration,
                latitude: order.latitude,
                longitude: order.longitude
              },
              markers: [{
                id: 1,
                latitude: order.latitude,
                longitude: order.longitude,
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
        if (!res.authSetting['scope.userLocation']) {
          // 未授权，请求权限
          wx.authorize({
            scope: 'scope.userLocation',
            success: () => {
              this.doGetLocation();
            },
            fail: () => {
              wx.showModal({
                title: '需要位置权限',
                content: '请允许使用位置权限，以便接收附近的求助信号',
                confirmText: '去设置',
                success: (modalRes) => {
                  if (modalRes.confirm) {
                    wx.openSetting();
                  }
                }
              });
            }
          });
        } else {
          // 已授权，直接获取位置
          this.doGetLocation();
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
          latitude: res.latitude,  // 设置地图中心为志愿者位置
          longitude: res.longitude,
          locationReady: true
        });

        // 如果有订单，计算距离
        if (app.globalData.isNeedLighted === true && app.globalData.orderInfo) {
          const distance = this.calculateDistance(
            res.latitude,
            res.longitude,
            app.globalData.orderInfo.latitude,
            app.globalData.orderInfo.longitude
          );
          this.setData({ distance });
        }
      },
      fail: () => {
        // 即使失败也设置为true，让用户看到界面
        this.setData({ locationReady: true });
        wx.showToast({
          title: '定位失败，请检查权限',
          icon: 'none'
        });
      }
    });
  },

  onHide() {
    // 页面隐藏时停止轨迹追踪
    this.stopTracking();
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
        runningStats: {
          totalDistance: totalDistance,
          totalTime: totalTime,
          formattedTime: Math.floor(totalTime / 60).toString(),
          avgSpeed: totalTime > 0 ? (totalDistance / (totalTime / 3600)).toFixed(1) : 0 // km/h
        }
      });
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
   * 计算两点间距离（Haversine公式）
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // 地球半径（公里）
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // 返回公里
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

    // 奖励志愿者：完成陪跑 +50经验 +10积分
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
    // 页面隐藏时停止轨迹追踪
    this.stopTracking();
  },

  onUnload() {
    // 页面卸载时停止轨迹追踪
    this.stopTracking();
  }
});
