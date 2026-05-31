// pages/find-volunteers/find-volunteers.js
const app = getApp();

Page({
  data: {
    volunteers: [],
    loading: true,
    userInfo: null
  },

  onLoad() {
    this.loadVolunteers();
  },

  onShow() {
    this.loadVolunteers();
  },

  onPullDownRefresh() {
    this.loadVolunteers();
  },

  /**
   * 从云端加载接单中的志愿者列表
   */
  loadVolunteers() {
    const userInfo = wx.getStorageSync('userInfo_disabled') || {};
    this.setData({ userInfo, loading: true });

    // 获取盲人当前位置，然后查询附近志愿者
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        // 云端查询可用志愿者
        app.getAvailableVolunteers(res.latitude, res.longitude, 10000).then(cloudRes => {
          if (cloudRes.success && cloudRes.volunteers.length > 0) {
            const volunteers = cloudRes.volunteers.map(v => ({
              openid: v.openid,
              phone: v.phone || '',
              name: v.nickName || v.name || '志愿者',
              avatar: v.avatarUrl || '',
              latitude: v.latitude,
              longitude: v.longitude,
              tierName: v.tierName || '',
              totalRuns: v.totalRuns || 0,
              likes: v.likes || 0,
              distance: v.distance ? (v.distance / 1000).toFixed(1) : null
            }));
            this.setData({ volunteers, loading: false });
            wx.stopPullDownRefresh();
          } else {
            this._loadLocalVolunteers(res.latitude, res.longitude);
          }
        }).catch(() => {
          this._loadLocalVolunteers(res.latitude, res.longitude);
        });
      },
      fail: () => {
        // 位置获取失败，尝试不带坐标查询
        app.getVolunteers(1).then(cloudRes => {
          if (cloudRes.success && cloudRes.volunteers.length > 0) {
            const volunteers = cloudRes.volunteers.map(v => ({
              openid: v.openid,
              phone: '',
              name: v.nickName || v.name || '志愿者',
              avatar: v.avatarUrl || '',
              tierName: v.tierName || '',
              totalRuns: v.totalRuns || 0,
              distance: null
            }));
            this.setData({ volunteers, loading: false });
          } else {
            this._loadLocalVolunteers();
          }
        }).catch(() => {
          this._loadLocalVolunteers();
        });
        wx.stopPullDownRefresh();
      }
    });
  },

  /**
   * 本地降级加载志愿者
   */
  _loadLocalVolunteers(lat, lng) {
    let takingOrdersList = wx.getStorageSync('takingOrdersList') || [];
    if (lat && lng) {
      takingOrdersList = takingOrdersList.map(v => ({
        ...v,
        distance: this.calculateDistance(lat, lng, v.latitude, v.longitude)
      })).sort((a, b) => a.distance - b.distance);
    }
    this.setData({ volunteers: takingOrdersList, loading: false });
    wx.stopPullDownRefresh();
  },

  /**
   * 计算两点间距离
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    if (lat2 === 0 && lon2 === 0) return null;

    const R = 6371; // 地球半径（公里）
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return Math.round(distance * 10) / 10;
  },

  /**
   * 下单：邀请志愿者一起跑步
   */
  placeOrder(e) {
    const volunteer = e.currentTarget.dataset.volunteer;
    const userInfo = this.data.userInfo;

    wx.showModal({
      title: '确认下单',
      content: `确定要邀请「${volunteer.name}」一起跑步吗？`,
      confirmText: '确认下单',
      success: (res) => {
        if (res.confirm) {
          this.createOrder(volunteer, userInfo);
        }
      }
    });
  },

  /**
   * 创建订单（云端优先，本地降级）
   */
  createOrder(volunteer, userInfo) {
    wx.showLoading({ title: '下单中...' });

    // 获取盲人当前位置
    wx.getLocation({
      type: 'gcj02',
      success: (locationRes) => {
        // 云端发布订单
        app.publishOrder({
          targetDistance: '3',
          estimatedDuration: '30分钟',
          latitude: locationRes.latitude,
          longitude: locationRes.longitude,
          address: '当前位置'
        }).then(res => {
          wx.hideLoading();
          if (res.success) {
            // 同步到本地缓存
            const localOrder = {
              id: res.orderId,
              blindPhone: userInfo.phone,
              blindName: userInfo.name || '视障跑者',
              blindLatitude: locationRes.latitude,
              blindLongitude: locationRes.longitude,
              volunteerName: volunteer.name,
              status: 'waiting',
              createTime: Date.now()
            };
            let orders = wx.getStorageSync('blind_orders') || [];
            orders.unshift(localOrder);
            wx.setStorageSync('blind_orders', orders);

            wx.showModal({
              title: '下单成功',
              content: `已向「${volunteer.name}」发送陪跑请求，请等待对方接单。`,
              confirmText: '查看订单',
              success: () => {
                wx.navigateTo({
                  url: '/pages/blind-order-track/blind-order-track'
                });
              }
            });
          }
        }).catch(() => {
          wx.hideLoading();
          // 降级到本地保存
          const order = {
            id: Date.now(),
            blindPhone: userInfo.phone,
            blindName: userInfo.name || '视障跑者',
            blindLatitude: locationRes.latitude,
            blindLongitude: locationRes.longitude,
            volunteerPhone: volunteer.phone,
            volunteerName: volunteer.name,
            status: 'pending',
            createTime: Date.now()
          };
          let orders = wx.getStorageSync('blind_orders') || [];
          orders.unshift(order);
          wx.setStorageSync('blind_orders', orders);

          wx.showModal({
            title: '下单成功',
            content: `已向「${volunteer.name}」发送陪跑请求，请等待对方接单。`,
            confirmText: '查看订单',
            success: () => {
              wx.navigateTo({
                url: '/pages/blind-order-track/blind-order-track'
              });
            }
          });
        });
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({
          title: '获取位置失败',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 拨打电话
   */
  makeCall(e) {
    const phone = e.currentTarget.dataset.phone;
    wx.makePhoneCall({
      phoneNumber: phone,
      fail: (err) => {
        if (err.errMsg !== 'makePhoneCall:fail cancel') {
          wx.showToast({
            title: '拨打电话失败',
            icon: 'none'
          });
        }
      }
    });
  }
})
