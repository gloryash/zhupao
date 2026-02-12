// 1. 必须在文件最上方获取 app 实例，否则无法修改全局变量
const app = getApp();

Page({
  /**
   * 页面的初始数据
   */
  data: {
    latitude: 31.2304, // 默认纬度（上海）
    longitude: 121.4737, // 默认经度
    markers: [],       // 地图上的标记点
    isLighted: false,  // 记录当前是否已点亮
    statusText: "等待点亮位置...",
    // 订单状态
    orderStatus: 'idle', // idle-未发布, waiting-等待中, accepted-已接单, arrived-已到达, running-陪跑中
    volunteerName: '',   // 志愿者名字
    volunteerDistance: 0, // 志愿者距离
    volunteerMarker: null, // 志愿者位置标记
    navigationPolyline: [], // 导航路线
    // 订单详情
    userName: '',
    distanceOptions: ['3公里', '5公里', '10公里', '半程马拉松(21km)', '全程马拉松(42km)'],
    distanceIndex: 0,
    durationOptions: ['30分钟', '1小时', '1.5小时', '2小时', '3小时', '4小时以上'],
    durationIndex: 1,
    // 震动定时器
    vibrateTimer: null,
    // 紧急联系人
    emergencyPhone: '' // 紧急联系人电话
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad() {
    // 加载用户信息
    const userInfo = wx.getStorageSync('userInfo_disabled') || {};
    this.setData({
      userName: userInfo.name || '视障跑者',
      emergencyPhone: userInfo.emergencyPhone || '' // 紧急联系人电话
    });

    this.getUserCurrentLocation();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 启动订单状态监听
    this.startOrderStatusListener();
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {
    // 停止订单状态监听
    this.stopOrderStatusListener();
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {
    // 停止订单状态监听
    this.stopOrderStatusListener();
  },

  /**
   * 启动订单状态监听
   */
  startOrderStatusListener() {
    // 每2秒检查一次订单状态
    this.checkOrderStatus();
    this.data.orderStatusTimer = setInterval(() => {
      this.checkOrderStatus();
    }, 2000);
  },

  /**
   * 停止订单状态监听
   */
  stopOrderStatusListener() {
    if (this.data.orderStatusTimer) {
      clearInterval(this.data.orderStatusTimer);
      this.data.orderStatusTimer = null;
    }
    // 停止震动
    this.stopVibrate();
  },

  /**
   * 检查订单状态
   */
  checkOrderStatus() {
    if (!this.data.isLighted) return;

    const orderInfo = app.globalData.orderInfo;
    if (!orderInfo) return;

    // 检测志愿者是否接单
    if (orderInfo.status === 'accepted' && this.data.orderStatus !== 'accepted') {
      this.handleVolunteerAccepted(orderInfo);
    }

    // 实时更新志愿者距离
    if (orderInfo.status === 'accepted' && this.data.orderStatus === 'accepted') {
      this.updateVolunteerDistance(orderInfo);
    }

    // 检测志愿者是否开始陪跑（无障碍强提醒）
    if (orderInfo.status === 'running' && this.data.orderStatus !== 'running') {
      this.handleVolunteerStartedRunning(orderInfo);
    }

    // 检测陪跑是否完成（无障碍强提醒）
    if (orderInfo.status === 'completed' && this.data.orderStatus !== 'completed') {
      this.handleOrderCompleted(orderInfo);
    }
  },

  /**
   * 志愿者开始陪跑
   */
  handleVolunteerStartedRunning(orderInfo) {
    this.setData({
      orderStatus: 'running',
      statusText: `志愿者 ${orderInfo.volunteerName || this.data.volunteerName} 已开始陪跑，祝您跑步愉快！`
    });

    // 无障碍强提醒：确保读屏软件播报开始陪跑
    wx.vibrateLong();
    wx.showModal({
      title: '开始陪跑',
      content: `志愿者 ${this.data.volunteerName} 已开始陪跑，祝您跑步愉快！`,
      showCancel: false,
      confirmText: '好的'
    });

    console.log('【盲人端】志愿者已开始陪跑');
  },

  /**
   * 陪跑完成
   */
  handleOrderCompleted(orderInfo) {
    const volunteerName = orderInfo.volunteerName || this.data.volunteerName;
    this.setData({
      orderStatus: 'completed',
      statusText: `本次陪跑已完成，感谢${volunteerName}的付出！`,
      lastOrderInfo: orderInfo
    });

    // 无障碍强提醒：确保读屏软件播报完成
    wx.vibrateLong();
    wx.showModal({
      title: '陪跑完成',
      content: `志愿者 ${volunteerName} 已完成陪跑！\n\n请为志愿者评分，发表您的评价。`,
      confirmText: '去评价',
      success: (res) => {
        if (res.confirm) {
          this.showRatingDialog(volunteerName);
        } else {
          this.handleCancelOrder();
        }
      }
    });

    console.log('【盲人端】陪跑已完成');
  },

  /**
   * 展示评价弹窗
   */
  showRatingDialog(volunteerName) {
    wx.showActionSheet({
      itemList: ['非常满意', '满意', '一般', '不满意'],
      itemColor: '#333333',
      success: (res) => {
        const ratings = ['非常满意', '满意', '一般', '不满意'];
        const rating = ratings[res.tapIndex];

        // 如果选择了"不满意"，不给志愿者额外奖励
        const isPositive = res.tapIndex < 3; // 前三个选项为好评

        // 如果好评，给志愿者 +20 经验
        if (isPositive) {
          app.addPointsAndExp('volunteer', 'feedback');
        }

        wx.showModal({
          title: '感谢您的评价',
          content: `您对志愿者${volunteerName}的评价：${rating}\n\n${isPositive ? '已为志愿者发放好评奖励！' : ''}`,
          showCancel: false,
          confirmText: '完成',
          success: () => {
            this.handleCancelOrder();
          }
        });
      },
      fail: () => {
        this.handleCancelOrder();
      }
    });
  },

  /**
   * 志愿者已接单
   */
  handleVolunteerAccepted(orderInfo) {
    // 计算志愿者与盲人之间的距离
    const distance = this.calculateDistance(
      this.data.latitude,
      this.data.longitude,
      orderInfo.volunteerLat,
      orderInfo.volunteerLng
    );

    // 更新状态
    this.setData({
      orderStatus: 'accepted',
      volunteerName: orderInfo.volunteerName || '志愿者',
      volunteerDistance: distance,
      // 添加志愿者位置标记
      volunteerMarker: {
        id: 2,
        latitude: orderInfo.volunteerLat,
        longitude: orderInfo.volunteerLng,
        width: 40,
        height: 40,
        // 使用系统默认标记点
        callout: {
          content: `🏃 志愿者 ${orderInfo.volunteerName || ''} 正在赶来`,
          display: 'ALWAYS',
          padding: 10,
          borderRadius: 8,
          bgColor: '#07c160',
          color: '#ffffff',
          fontSize: 14
        }
      },
      // 更新状态文案
      statusText: `志愿者 ${orderInfo.volunteerName || ''} 已接单，距离您约 ${distance}km`
    });

    // 更新 markers，合并盲人位置和志愿者位置
    this.setData({
      markers: [
        this.data.markers[0], // 盲人位置
        this.data.volunteerMarker // 志愿者位置
      ]
    });

    // 绘制导航路线
    this.drawNavigationLine(orderInfo.volunteerLat, orderInfo.volunteerLng);

    // 开始持续震动提醒
    this.startVibrate();

    // 弹出提示
    wx.showModal({
      title: '志愿者接单啦！',
      content: `${orderInfo.volunteerName || '志愿者'} 已接单，正在赶来与您会合`,
      showCancel: false,
      confirmText: '我知道了'
    });

    console.log('【盲人端】志愿者已接单:', orderInfo.volunteerName);
  },

  /**
   * 实时更新志愿者距离
   */
  updateVolunteerDistance(orderInfo) {
    const distance = this.calculateDistance(
      this.data.latitude,
      this.data.longitude,
      orderInfo.volunteerLat,
      orderInfo.volunteerLng
    );

    if (Math.abs(distance - this.data.volunteerDistance) > 0.01) {
      this.setData({
        volunteerDistance: distance,
        statusText: `志愿者 ${this.data.volunteerName} 已接单，距离您约 ${distance}km`
      });

      // 更新志愿者标记位置
      this.setData({
        [`volunteerMarker.latitude`]: orderInfo.volunteerLat,
        [`volunteerMarker.longitude`]: orderInfo.volunteerLng
      });

      // 更新 markers
      const markers = [
        this.data.markers[0],
        this.data.volunteerMarker
      ];
      this.setData({ markers });
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
    const distance = R * c;
    return Math.round(distance * 10) / 10; // 保留一位小数
  },

  /**
   * 绘制导航路线
   */
  drawNavigationLine(volLat, volLng) {
    const polyline = [{
      points: [
        { latitude: this.data.latitude, longitude: this.data.longitude },
        { latitude: volLat, longitude: volLng }
      ],
      color: '#07c160',
      width: 6,
      dottedLine: false,
      arrowLine: true
    }];
    this.setData({ navigationPolyline: polyline });
  },

  /**
   * 开始持续震动提醒
   */
  startVibrate() {
    // 每3秒轻微震动一次
    this.data.vibrateTimer = setInterval(() => {
      wx.vibrateShort();
    }, 3000);
  },

  /**
   * 停止震动
   */
  stopVibrate() {
    if (this.data.vibrateTimer) {
      clearInterval(this.data.vibrateTimer);
      this.data.vibrateTimer = null;
    }
  },

  // 获取当前真实的地理位置
  getUserCurrentLocation() {
    // 先检查权限状态
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
              // 用户拒绝，提示去设置
              wx.showModal({
                title: '需要位置权限',
                content: '请允许使用位置权限，以便志愿者能找到您',
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

  // 执行获取位置
  doGetLocation() {
    wx.showLoading({ title: '正在获取定位...' });

    wx.getLocation({
      type: 'gcj02', // 腾讯地图专用坐标系
      isHighAccuracy: true,
      success: (res) => {
        console.log("获取位置成功：", res);
        const { latitude, longitude } = res;
        this.setData({
          latitude,
          longitude,
          markers: [{
            id: 0,
            latitude,
            longitude,
            title: "我的位置",
            width: 30,
            height: 30
          }]
        });
        wx.hideLoading();
      },
      fail: (err) => {
        wx.hideLoading();
        console.error("定位失败：", err);
        wx.showToast({
          title: '定位失败，请检查权限',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 目标里程选择
   */
  onDistanceChange(e) {
    this.setData({
      distanceIndex: e.detail.value
    });
  },

  /**
   * 预计时间选择
   */
  onDurationChange(e) {
    this.setData({
      durationIndex: e.detail.value
    });
  },

  /**
   * 核心功能：点亮位置发布
   */
  handlePublish() {
    // 1. 震动反馈（对视障人士非常重要）
    wx.vibrateLong();

    // 2. 修改全局变量，把信号发出去（保留作为本地备份）
    app.globalData.isNeedLighted = true;
    app.globalData.userLocation = {
      latitude: this.data.latitude,
      longitude: this.data.longitude
    };

    // 3. 保存完整的订单信息
    const orderInfo = {
      userName: this.data.userName,
      targetDistance: this.data.distanceOptions[this.data.distanceIndex],
      estimatedDuration: this.data.durationOptions[this.data.durationIndex],
      latitude: this.data.latitude,
      longitude: this.data.longitude,
      publishTime: new Date().toLocaleString(),
      // 从用户信息中读取电话
      phone: (wx.getStorageSync('userInfo_disabled') || {}).phone || '',
      status: 'waiting'
    };

    app.globalData.orderInfo = orderInfo;

    // 4. 更新本地 UI 状态
    this.setData({
      isLighted: true,
      orderStatus: 'waiting',
      statusText: "位置已点亮，等待志愿者响应..."
    });

    // 5. 发布订单到云数据库
    wx.showLoading({ title: '发布中...' });

    app.publishOrder({
      targetDistance: orderInfo.targetDistance,
      estimatedDuration: orderInfo.estimatedDuration,
      latitude: orderInfo.latitude,
      longitude: orderInfo.longitude,
      address: ''
    }).then(result => {
      wx.hideLoading();

      // 保存订单ID到全局变量
      app.globalData.orderInfo.orderId = result.orderId;

      // 弹出成功提示
      wx.showModal({
        title: '点亮成功',
        content: '您的求助信号已发送给周边志愿者，请留在原地等待。',
        showCancel: false,
        confirmText: '我知道了'
      });

      console.log("【信号发射】订单已发布到云端:", result);
    }).catch(err => {
      wx.hideLoading();
      console.error("【发布失败】", err);

      // 即使云端发布失败，本地全局变量已设置，仍可使用本地模式
      wx.showModal({
        title: '点亮成功',
        content: '您的求助信号已发送（本地模式），请留在原地等待。',
        showCancel: false,
        confirmText: '我知道了'
      });
    });

    console.log("【信号发射】当前全局状态：", app.globalData);
  },

  /**
   * 拨打志愿者电话
   */
  handleCallVolunteer() {
    const orderInfo = app.globalData.orderInfo;
    if (orderInfo && orderInfo.volunteerPhone) {
      wx.makePhoneCall({
        phoneNumber: orderInfo.volunteerPhone,
        success: () => console.log('拨打电话成功'),
        fail: (err) => console.log('拨打电话失败', err)
      });
    } else {
      wx.showToast({
        title: '暂无志愿者电话',
        icon: 'none'
      });
    }
  },

  /**
   * 取消订单
   */
  handleCancelOrder() {
    wx.showModal({
      title: '确认取消',
      content: '确定要取消这次陪跑需求吗？',
      confirmText: '取消订单',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          // 停止震动
          this.stopVibrate();

          // 重置全局状态
          app.globalData.isNeedLighted = false;
          app.globalData.orderInfo = null;

          // 重置本地状态
          this.setData({
            isLighted: false,
            orderStatus: 'idle',
            statusText: '等待点亮位置...',
            volunteerName: '',
            volunteerDistance: 0,
            volunteerMarker: null,
            markers: [{
              id: 0,
              latitude: this.data.latitude,
              longitude: this.data.longitude,
              title: '我的位置',
              width: 30,
              height: 30
            }],
            navigationPolyline: []
          });

          wx.showToast({
            title: '订单已取消',
            icon: 'success'
          });
        }
      }
    });
  },

  /**
   * 一键报警 - 拨打110
   */
  handleEmergencyCall() {
    wx.showModal({
      title: '紧急求助',
      content: '确认拨打110报警电话？',
      confirmText: '拨打',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          wx.makePhoneCall({
            phoneNumber: '110',
            success: () => console.log('紧急报警电话拨打成功'),
            fail: (err) => console.log('拨打电话失败', err)
          });
        }
      }
    });
  },

  /**
   * 拨打紧急联系人
   */
  handleCallEmergencyContact() {
    if (this.data.emergencyPhone) {
      wx.makePhoneCall({
        phoneNumber: this.data.emergencyPhone,
        success: () => console.log('紧急联系人电话拨打成功'),
        fail: (err) => console.log('拨打电话失败', err)
      });
    } else {
      wx.showModal({
        title: '提示',
        content: '您尚未设置紧急联系人电话，请前往个人信息页面设置',
        confirmText: '去设置',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/user-info/user-info'
            });
          }
        }
      });
    }
  },

  /**
   * 投诉志愿者
   */
  handleComplaint() {
    const orderInfo = app.globalData.orderInfo;
    const volunteerName = orderInfo ? orderInfo.volunteerName : this.data.volunteerName;

    wx.showActionSheet({
      itemList: ['志愿者态度不好', '志愿者迟到', '志愿者未到', '其他问题'],
      itemColor: '#333333',
      success: (res) => {
        const complaintTypes = ['志愿者态度不好', '志愿者迟到', '志愿者未到', '其他问题'];
        const complaintType = complaintTypes[res.tapIndex];

        wx.showModal({
          title: '提交投诉',
          content: `投诉类型：${complaintType}\n\n请详细描述问题（可选）：`,
          editable: true,
          placeholderText: '请输入详细内容...',
          success: (modalRes) => {
            if (modalRes.confirm) {
              // 保存投诉记录
              const complaints = wx.getStorageSync('complaints') || [];
              const newComplaint = {
                id: Date.now(),
                orderInfo: orderInfo || {},
                volunteerName: volunteerName,
                complaintType: complaintType,
                detail: modalRes.content || '',
                createTime: new Date().toLocaleString(),
                status: 'pending'
              };
              complaints.unshift(newComplaint);
              wx.setStorageSync('complaints', complaints);

              wx.showToast({
                title: '投诉已提交',
                icon: 'success'
              });

              console.log('【投诉】已提交投诉:', newComplaint);
            }
          }
        });
      }
    });
  }
})