const app = getApp();

Page({
  data: {
    // ============ 地图 ============
    latitude: 31.2304,
    longitude: 121.4737,
    markers: [],
    navigationPolyline: [],

    // ============ 发布前 5 步流程 ============
    flowStep: 'address-start',  // address-start | address-end | duration | confirm
    startAddress: null,         // { name, address, latitude, longitude }
    endAddress: null,
    selectedDuration: '1小时',
    durationChips: ['30分钟', '1小时', '1.5小时', '2小时', '3小时'],
    addressHistory: [],         // 历史地址（去重，最多 8 条）
    canProceed: true,           // dev 模式：默认允许下一步，nextStep 内自动补 mock

    // ============ 发布后状态（保留旧逻辑） ============
    isLighted: false,
    statusText: '等待发布需求...',
    orderStatus: 'idle',        // idle | waiting | accepted | arrived | running | completed
    volunteerName: '',
    volunteerDistance: 0,
    volunteerMarker: null,

    // ============ 其他 ============
    userName: '',
    emergencyPhone: '',
    vibrateTimer: null,
    estimatedDistance: 0,       // 起终点直线距离 km
  },

  // ==================== 生命周期 ====================

  onLoad() {
    const userInfo = wx.getStorageSync('userInfo_disabled') || {};
    this.setData({
      userName: userInfo.name || '视障跑者',
      emergencyPhone: userInfo.emergencyPhone || '',
      addressHistory: wx.getStorageSync('blind_address_history') || [],
    });
    this.getUserCurrentLocation();
  },

  onShow() {
    this.startOrderStatusListener();
  },

  onHide() { this.stopOrderStatusListener(); },
  onUnload() { this.stopOrderStatusListener(); },

  // ==================== 4 步发布流程 ====================

  /** 调微信原生地图选点选起点 */
  chooseStartAddress() {
    wx.chooseLocation({
      success: (res) => {
        const addr = {
          name: res.name || '未命名地点',
          address: res.address || '',
          latitude: res.latitude,
          longitude: res.longitude,
        };
        this.setData({ startAddress: addr, canProceed: true });
        this._saveToHistory(addr);
        this._refreshMapMarkers();
      },
      fail: (err) => {
        if (err.errMsg && err.errMsg.indexOf('cancel') === -1) {
          wx.showToast({ title: '需要位置权限', icon: 'none' });
        }
      },
    });
  },

  /** 选终点 */
  chooseEndAddress() {
    wx.chooseLocation({
      success: (res) => {
        const addr = {
          name: res.name || '未命名地点',
          address: res.address || '',
          latitude: res.latitude,
          longitude: res.longitude,
        };
        this.setData({ endAddress: addr, canProceed: true });
        this._saveToHistory(addr);
        this._refreshMapMarkers();
        // 计算直线距离作为预估
        const dist = this.calculateDistance(
          this.data.startAddress.latitude, this.data.startAddress.longitude,
          addr.latitude, addr.longitude
        );
        this.setData({ estimatedDistance: dist });
      },
      fail: (err) => {
        if (err.errMsg && err.errMsg.indexOf('cancel') === -1) {
          wx.showToast({ title: '需要位置权限', icon: 'none' });
        }
      },
    });
  },

  /** 从历史地址点选 */
  useHistoryAddress(e) {
    const idx = e.currentTarget.dataset.index;
    const addr = this.data.addressHistory[idx];
    if (!addr) return;

    const isStart = this.data.flowStep === 'address-start';
    if (isStart) {
      this.setData({ startAddress: addr, canProceed: true });
    } else {
      this.setData({ endAddress: addr, canProceed: true });
      if (this.data.startAddress) {
        const dist = this.calculateDistance(
          this.data.startAddress.latitude, this.data.startAddress.longitude,
          addr.latitude, addr.longitude
        );
        this.setData({ estimatedDistance: dist });
      }
    }
    this._refreshMapMarkers();
  },

  /** 时长 chip 点击 */
  selectDuration(e) {
    const duration = e.currentTarget.dataset.duration;
    this.setData({ selectedDuration: duration, canProceed: true });
  },

  /** 下一步（dev 模式：缺失数据自动补 mock） */
  nextStep() {
    const order = ['address-start', 'address-end', 'duration', 'confirm'];
    const idx = order.indexOf(this.data.flowStep);
    if (idx < 0 || idx >= order.length - 1) return;

    // 离开当前步骤时，若缺数据则注入 mock
    this._fillMockIfMissing(this.data.flowStep);

    const next = order[idx + 1];
    this.setData({ flowStep: next, canProceed: true });
  },

  /** 上一步 */
  prevStep() {
    const order = ['address-start', 'address-end', 'duration', 'confirm'];
    const idx = order.indexOf(this.data.flowStep);
    if (idx <= 0) return;
    this.setData({ flowStep: order[idx - 1], canProceed: true });
  },

  /** dev: 当前步骤缺数据时填 mock，确保后续步骤有内容显示 */
  _fillMockIfMissing(step) {
    const baseLat = this.data.latitude || 31.2304;
    const baseLng = this.data.longitude || 121.4737;

    if (step === 'address-start' && !this.data.startAddress) {
      const mock = {
        name: '世纪公园 1 号门',
        address: '上海市浦东新区锦绣路 1001 号',
        latitude: baseLat,
        longitude: baseLng,
      };
      this.setData({ startAddress: mock });
      this._refreshMapMarkers();
    }
    if (step === 'address-end' && !this.data.endAddress) {
      const mock = {
        name: '滨江绿地',
        address: '上海市浦东新区滨江大道',
        latitude: baseLat + 0.012,
        longitude: baseLng + 0.008,
      };
      const dist = this.data.startAddress
        ? this.calculateDistance(
            this.data.startAddress.latitude, this.data.startAddress.longitude,
            mock.latitude, mock.longitude
          )
        : 1.5;
      this.setData({ endAddress: mock, estimatedDistance: dist });
      this._refreshMapMarkers();
    }
    // duration 默认值已经在 data 里设置为 '1小时'，无需补
  },

  // ==================== 历史地址 ====================

  _saveToHistory(addr) {
    const history = (this.data.addressHistory || []).slice();
    // 按 name+address 去重
    const key = `${addr.name}|${addr.address}`;
    const filtered = history.filter(h => `${h.name}|${h.address}` !== key);
    filtered.unshift(addr);
    const trimmed = filtered.slice(0, 8);
    this.setData({ addressHistory: trimmed });
    wx.setStorageSync('blind_address_history', trimmed);
  },

  // ==================== 地图 markers ====================

  _refreshMapMarkers() {
    const markers = [];
    const { startAddress, endAddress } = this.data;

    if (startAddress) {
      markers.push({
        id: 1,
        latitude: startAddress.latitude,
        longitude: startAddress.longitude,
        iconPath: '/images/marker/dot-green.png',
        width: 36,
        height: 36,
        callout: {
          content: `起点 · ${startAddress.name}`,
          display: 'ALWAYS',
          padding: 8,
          borderRadius: 6,
          bgColor: '#07C160',
          color: '#FFFFFF',
          fontSize: 12,
        },
      });
    }

    if (endAddress) {
      markers.push({
        id: 2,
        latitude: endAddress.latitude,
        longitude: endAddress.longitude,
        iconPath: '/images/marker/dot-red.png',
        width: 36,
        height: 36,
        callout: {
          content: `终点 · ${endAddress.name}`,
          display: 'ALWAYS',
          padding: 8,
          borderRadius: 6,
          bgColor: '#FF3B30',
          color: '#FFFFFF',
          fontSize: 12,
        },
      });
    }

    // 若起终点都有 → 画虚线预览
    let polyline = [];
    if (startAddress && endAddress) {
      polyline = [{
        points: [
          { latitude: startAddress.latitude, longitude: startAddress.longitude },
          { latitude: endAddress.latitude, longitude: endAddress.longitude },
        ],
        color: '#9CA3AF',
        width: 4,
        dottedLine: true,
        arrowLine: false,
      }];
    }

    // 地图中心：起点优先，否则终点，否则用户位置
    const center = startAddress || endAddress;
    const newData = { markers, navigationPolyline: polyline };
    if (center) {
      newData.latitude = center.latitude;
      newData.longitude = center.longitude;
    }
    this.setData(newData);
  },

  // ==================== 发布需求 ====================

  /** 确认页：执行发布 */
  publishNeed() {
    // dev 模式：缺数据自动补
    if (!this.data.startAddress) this._fillMockIfMissing('address-start');
    if (!this.data.endAddress) this._fillMockIfMissing('address-end');

    const { startAddress, endAddress, selectedDuration, estimatedDistance } = this.data;

    wx.vibrateLong();

    // 写入全局状态（保留兼容老逻辑）
    app.globalData.isNeedLighted = true;
    app.globalData.userLocation = {
      latitude: startAddress.latitude,
      longitude: startAddress.longitude,
    };

    const orderInfo = {
      userName: this.data.userName,
      // 用预估距离作为 targetDistance（保留旧字段，避免 cloud function 报错）
      targetDistance: estimatedDistance > 0 ? `${estimatedDistance.toFixed(1)}公里` : '5公里',
      estimatedDuration: selectedDuration,
      // 起点作为发布坐标
      latitude: startAddress.latitude,
      longitude: startAddress.longitude,
      // 新字段：起终点完整信息
      startAddress: startAddress,
      endAddress: endAddress,
      publishTime: new Date().toLocaleString(),
      phone: (wx.getStorageSync('userInfo_disabled') || {}).phone || '',
      status: 'waiting',
    };

    app.globalData.orderInfo = orderInfo;

    this.setData({
      isLighted: true,
      orderStatus: 'waiting',
      latitude: startAddress.latitude,
      longitude: startAddress.longitude,
      statusText: '需求已发布，等待志愿者响应...',
    });

    wx.showLoading({ title: '发布中...' });

    app.publishOrder({
      targetDistance: orderInfo.targetDistance,
      estimatedDuration: orderInfo.estimatedDuration,
      latitude: orderInfo.latitude,
      longitude: orderInfo.longitude,
      address: startAddress.address || startAddress.name,
      startAddress: startAddress,
      endAddress: endAddress,
    }).then(result => {
      wx.hideLoading();
      app.globalData.orderInfo.orderId = result.orderId;
      wx.showModal({
        title: '发布成功',
        content: '您的需求已发送给周边志愿者，请留在原地等待。',
        showCancel: false,
        confirmText: '我知道了',
      });
    }).catch(err => {
      wx.hideLoading();
      console.error('【发布失败】', err);
      wx.showModal({
        title: '发布成功',
        content: '您的需求已发送（本地模式），请留在原地等待。',
        showCancel: false,
        confirmText: '我知道了',
      });
    });
  },

  // ==================== 订单状态轮询（保留旧逻辑） ====================

  startOrderStatusListener() {
    this.checkOrderStatus();
    this.data.orderStatusTimer = setInterval(() => this.checkOrderStatus(), 2000);
  },

  stopOrderStatusListener() {
    if (this.data.orderStatusTimer) {
      clearInterval(this.data.orderStatusTimer);
      this.data.orderStatusTimer = null;
    }
    this.stopVibrate();
  },

  checkOrderStatus() {
    if (!this.data.isLighted) return;
    const orderInfo = app.globalData.orderInfo;
    if (!orderInfo) return;

    if (orderInfo.status === 'accepted' && this.data.orderStatus !== 'accepted') {
      this.handleVolunteerAccepted(orderInfo);
    }
    if (orderInfo.status === 'accepted' && this.data.orderStatus === 'accepted') {
      this.updateVolunteerDistance(orderInfo);
    }
    if (orderInfo.status === 'running' && this.data.orderStatus !== 'running') {
      this.handleVolunteerStartedRunning(orderInfo);
    }
    if (orderInfo.status === 'completed' && this.data.orderStatus !== 'completed') {
      this.handleOrderCompleted(orderInfo);
    }
  },

  handleVolunteerAccepted(orderInfo) {
    const distance = this.calculateDistance(
      this.data.latitude, this.data.longitude,
      orderInfo.volunteerLat, orderInfo.volunteerLng
    );

    const volunteerMarker = {
      id: 99,
      latitude: orderInfo.volunteerLat,
      longitude: orderInfo.volunteerLng,
      iconPath: '/images/marker/runner.png',
      width: 44,
      height: 44,
      callout: {
        content: `🏃 ${orderInfo.volunteerName || '志愿者'} 正在赶来`,
        display: 'ALWAYS',
        padding: 10,
        borderRadius: 8,
        bgColor: '#07C160',
        color: '#FFFFFF',
        fontSize: 14,
      },
    };

    this.setData({
      orderStatus: 'accepted',
      volunteerName: orderInfo.volunteerName || '志愿者',
      volunteerDistance: distance,
      volunteerMarker,
      statusText: `志愿者 ${orderInfo.volunteerName || ''} 已接单，距离您约 ${distance}km`,
    });

    // 接单态地图：起点绿圆 + 志愿者跑者 + 绿色路径
    const startMarker = this.data.markers.find(m => m.id === 1);
    const newMarkers = [];
    if (startMarker) newMarkers.push(startMarker);
    newMarkers.push(volunteerMarker);
    this.setData({ markers: newMarkers });

    this.drawNavigationLine(orderInfo.volunteerLat, orderInfo.volunteerLng);
    this.startVibrate();

    wx.showModal({
      title: '志愿者接单啦！',
      content: `${orderInfo.volunteerName || '志愿者'} 已接单，正在赶来与您会合`,
      showCancel: false,
      confirmText: '我知道了',
    });
  },

  updateVolunteerDistance(orderInfo) {
    const distance = this.calculateDistance(
      this.data.latitude, this.data.longitude,
      orderInfo.volunteerLat, orderInfo.volunteerLng
    );
    if (Math.abs(distance - this.data.volunteerDistance) > 0.01) {
      this.setData({
        volunteerDistance: distance,
        statusText: `志愿者 ${this.data.volunteerName} 已接单，距离您约 ${distance}km`,
        [`volunteerMarker.latitude`]: orderInfo.volunteerLat,
        [`volunteerMarker.longitude`]: orderInfo.volunteerLng,
      });
      const markers = this.data.markers.slice();
      const idx = markers.findIndex(m => m.id === 99);
      if (idx >= 0) markers[idx] = this.data.volunteerMarker;
      this.setData({ markers });
    }
  },

  handleVolunteerStartedRunning(orderInfo) {
    this.setData({
      orderStatus: 'running',
      statusText: `志愿者 ${orderInfo.volunteerName || this.data.volunteerName} 已开始陪跑，祝您跑步愉快！`,
    });
    wx.vibrateLong();
    wx.showModal({
      title: '开始陪跑',
      content: `志愿者 ${this.data.volunteerName} 已开始陪跑，祝您跑步愉快！`,
      showCancel: false,
      confirmText: '好的',
    });
  },

  handleOrderCompleted(orderInfo) {
    const volunteerName = orderInfo.volunteerName || this.data.volunteerName;
    this.setData({
      orderStatus: 'completed',
      statusText: `本次陪跑已完成，感谢${volunteerName}的付出！`,
      lastOrderInfo: orderInfo,
    });
    wx.vibrateLong();
    wx.showModal({
      title: '陪跑完成',
      content: `志愿者 ${volunteerName} 已完成陪跑！\n\n请为志愿者评分。`,
      confirmText: '去评价',
      success: (res) => {
        if (res.confirm) this.showRatingDialog(volunteerName);
        else this.handleCancelOrder();
      },
    });
  },

  showRatingDialog(volunteerName) {
    wx.showActionSheet({
      itemList: ['非常满意', '满意', '一般', '不满意'],
      itemColor: '#333333',
      success: (res) => {
        const ratings = ['非常满意', '满意', '一般', '不满意'];
        const rating = ratings[res.tapIndex];
        const isPositive = res.tapIndex < 3;
        if (isPositive) app.addPointsAndExp('volunteer', 'feedback');
        wx.showModal({
          title: '感谢您的评价',
          content: `您对志愿者${volunteerName}的评价：${rating}\n\n${isPositive ? '已为志愿者发放好评奖励！' : ''}`,
          showCancel: false,
          confirmText: '完成',
          success: () => this.handleCancelOrder(),
        });
      },
      fail: () => this.handleCancelOrder(),
    });
  },

  // ==================== 工具方法 ====================

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  },

  drawNavigationLine(volLat, volLng) {
    const polyline = [{
      points: [
        { latitude: this.data.latitude, longitude: this.data.longitude },
        { latitude: volLat, longitude: volLng },
      ],
      color: '#07C160',
      width: 6,
      dottedLine: false,
      arrowLine: true,
    }];
    this.setData({ navigationPolyline: polyline });
  },

  startVibrate() {
    this.data.vibrateTimer = setInterval(() => wx.vibrateShort(), 3000);
  },

  stopVibrate() {
    if (this.data.vibrateTimer) {
      clearInterval(this.data.vibrateTimer);
      this.data.vibrateTimer = null;
    }
  },

  getUserCurrentLocation() {
    // dev 模式：不强制要求位置权限，拒绝也用默认上海坐标继续
    wx.getSetting({
      success: (res) => {
        if (res.authSetting['scope.userLocation']) {
          this.doGetLocation();
        } else {
          wx.authorize({
            scope: 'scope.userLocation',
            success: () => this.doGetLocation(),
            fail: () => {
              // 静默回退：用 data 里已有的默认坐标（上海）
              console.log('[dev] 位置权限未授权，使用默认坐标');
            },
          });
        }
      },
    });
  },

  doGetLocation() {
    wx.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      success: (res) => {
        this.setData({ latitude: res.latitude, longitude: res.longitude });
      },
      fail: () => {
        console.log('[dev] 定位失败，使用默认坐标');
      },
    });
  },

  // ==================== 安全 & 取消（保留旧） ====================

  handleCallVolunteer() {
    const orderInfo = app.globalData.orderInfo;
    if (orderInfo && orderInfo.volunteerPhone) {
      wx.makePhoneCall({ phoneNumber: orderInfo.volunteerPhone });
    } else {
      wx.showToast({ title: '暂无志愿者电话', icon: 'none' });
    }
  },

  handleCancelOrder() {
    wx.showModal({
      title: '确认取消',
      content: '确定要取消这次陪跑需求吗？',
      confirmText: '取消订单',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          this.stopVibrate();
          app.globalData.isNeedLighted = false;
          app.globalData.orderInfo = null;
          this.setData({
            isLighted: false,
            orderStatus: 'idle',
            statusText: '等待发布需求...',
            volunteerName: '',
            volunteerDistance: 0,
            volunteerMarker: null,
            flowStep: 'address-start',
            startAddress: null,
            endAddress: null,
            selectedDuration: '1小时',
            estimatedDistance: 0,
            canProceed: false,
            markers: [],
            navigationPolyline: [],
          });
          wx.showToast({ title: '订单已取消', icon: 'success' });
        }
      },
    });
  },

  handleEmergencyCall() {
    wx.showModal({
      title: '紧急求助',
      content: '确认拨打110报警电话？',
      confirmText: '拨打',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) wx.makePhoneCall({ phoneNumber: '110' });
      },
    });
  },

  handleCallEmergencyContact() {
    if (this.data.emergencyPhone) {
      wx.makePhoneCall({ phoneNumber: this.data.emergencyPhone });
    } else {
      wx.showModal({
        title: '提示',
        content: '您尚未设置紧急联系人电话，请前往个人信息页面设置',
        confirmText: '去设置',
        success: (res) => {
          if (res.confirm) wx.navigateTo({ url: '/pages/user-info/user-info' });
        },
      });
    }
  },

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
              const complaints = wx.getStorageSync('complaints') || [];
              complaints.unshift({
                id: Date.now(),
                orderInfo: orderInfo || {},
                volunteerName,
                complaintType,
                detail: modalRes.content || '',
                createTime: new Date().toLocaleString(),
                status: 'pending',
              });
              wx.setStorageSync('complaints', complaints);
              wx.showToast({ title: '投诉已提交', icon: 'success' });
            }
          },
        });
      },
    });
  },
});
