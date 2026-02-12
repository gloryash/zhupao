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
   * 加载接单中的志愿者列表
   */
  loadVolunteers() {
    const userInfo = wx.getStorageSync('userInfo_disabled') || {};
    this.setData({ userInfo });

    // 获取接单中的志愿者列表
    let takingOrdersList = wx.getStorageSync('takingOrdersList') || [];

    // 如果没有志愿者，添加测试数据（开发测试用）
    if (takingOrdersList.length === 0) {
      // 测试数据
      takingOrdersList = [
        {
          phone: '13800138000',
          name: '测试志愿者',
          avatar: '',
          latitude: 31.2304,
          longitude: 121.4737,
          pace: '5分30秒/公里',
          runningYears: '3',
          takingOrdersTime: Date.now()
        }
      ];
    }

    // 获取盲人当前位置
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        const volunteersWithDistance = takingOrdersList.map(v => ({
          ...v,
          distance: this.calculateDistance(res.latitude, res.longitude, v.latitude, v.longitude)
        })).sort((a, b) => a.distance - b.distance);

        this.setData({
          volunteers: volunteersWithDistance,
          loading: false
        });
      },
      fail: () => {
        // 如果获取位置失败，显示列表不计算距离
        this.setData({
          volunteers: takingOrdersList,
          loading: false
        });
      }
    });
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
   * 创建订单
   */
  createOrder(volunteer, userInfo) {
    wx.showLoading({ title: '下单中...' });

    // 获取盲人当前位置
    wx.getLocation({
      type: 'gcj02',
      success: (locationRes) => {
        // 创建订单
        const order = {
          id: Date.now(),
          blindPhone: userInfo.phone,
          blindName: userInfo.name || '视障跑者',
          blindAvatar: userInfo.avatarUrl || '',
          blindLatitude: locationRes.latitude,
          blindLongitude: locationRes.longitude,
          volunteerPhone: volunteer.phone,
          volunteerName: volunteer.name,
          volunteerAvatar: volunteer.avatar || '',
          status: 'pending', // pending-待接单, accepted-已接单
          createTime: Date.now()
        };

        // 保存订单
        let orders = wx.getStorageSync('blind_orders') || [];
        orders.unshift(order);
        wx.setStorageSync('blind_orders', orders);

        wx.hideLoading();

        wx.showModal({
          title: '下单成功',
          content: `已向「${volunteer.name}」发送陪跑请求，请等待对方接单。`,
          confirmText: '查看订单',
          success: () => {
            // 跳转到订单跟踪页面
            wx.navigateTo({
              url: '/pages/blind-order-track/blind-order-track'
            });
          }
        });

        // 通知志愿者有新订单（通过全局状态）
        app.globalData.hasNewOrderFromBlind = true;
        app.globalData.newOrderInfo = order;
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
