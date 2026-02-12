const app = getApp();

Page({
  data: {
    appointments: [],
    volunteerInfo: null
  },

  onLoad() {
    this.loadVolunteerInfo();
  },

  onShow() {
    this.loadAppointments();
  },

  /**
   * 加载志愿者信息
   */
  loadVolunteerInfo() {
    const volunteerInfo = wx.getStorageSync('userInfo_volunteer') || {};
    this.setData({ volunteerInfo });
  },

  /**
   * 加载预约列表
   */
  loadAppointments() {
    const orders = wx.getStorageSync('blind_orders') || [];
    const now = new Date();

    // 筛选预约单
    const appointments = orders
      .filter(order => order.type === 'appointment' && order.status !== 'cancelled' && order.status !== 'rated')
      .map(order => {
        // 计算距离
        const distance = this.calculateDistance(
          this.data.volunteerInfo?.latitude || 31.2304,
          this.data.volunteerInfo?.longitude || 121.4737,
          order.blindLatitude,
          order.blindLongitude
        );

        // 解析日期显示
        const dateParts = order.appointmentDate?.match(/(\d+)月(\d+)日/) || ['未知日期'];
        const dateDay = dateParts[2] || '--';
        const dateMonth = dateParts[1] + '月';

        // 状态文本
        const statusMap = {
          'pending': '待接单',
          'accepted': '已接单',
          'arrived': '已到达',
          'running': '陪跑中',
          'completed': '已完成'
        };

        return {
          ...order,
          distance: distance.toFixed(1),
          dateDay,
          dateMonth,
          statusText: statusMap[order.status] || '未知'
        };
      })
      .sort((a, b) => {
        // 按日期和时间排序
        return a.appointmentDate.localeCompare(b.appointmentDate);
      });

    this.setData({ appointments });
  },

  /**
   * 计算两点间距离（km）
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    if (!lat1 || !lng1 || !lat2 || !lng2) return 0;

    const R = 6371; // 地球半径（km）
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  },

  /**
   * 刷新预约列表
   */
  refreshAppointments() {
    wx.showToast({
      title: '刷新中...',
      icon: 'loading'
    });
    this.loadAppointments();
    setTimeout(() => {
      wx.showToast({
        title: '已刷新',
        icon: 'success'
      });
    }, 500);
  },

  /**
   * 查看预约详情
   */
  viewAppointment(e) {
    const orderId = e.currentTarget.dataset.id;
    const order = this.data.appointments.find(a => a.id === orderId);

    if (order) {
      wx.showModal({
        title: '预约详情',
        content: `预约人：${order.blindName}\n日期：${order.appointmentDate}\n时间：${order.appointmentTime}\n时长：${order.duration}\n地点：${order.blindAddress}\n备注：${order.notes || '无'}`,
        showCancel: false,
        confirmText: '知道了'
      });
    }
  },

  /**
   * 接单
   */
  acceptAppointment(e) {
    const orderId = e.currentTarget.dataset.id;

    wx.showModal({
      title: '确认接单',
      content: '确定要接下这个预约陪跑订单吗？',
      confirmText: '确认接单',
      confirmColor: '#07C160',
      success: (res) => {
        if (res.confirm) {
          this.doAcceptOrder(orderId);
        }
      }
    });
  },

  /**
   * 执行接单操作
   */
  doAcceptOrder(orderId) {
    const orders = wx.getStorageSync('blind_orders') || [];
    const orderIndex = orders.findIndex(o => o.id === orderId);

    if (orderIndex !== -1) {
      const order = orders[orderIndex];

      // 更新订单状态
      orders[orderIndex].status = 'accepted';
      orders[orderIndex].appointmentStatus = 1;
      orders[orderIndex].volunteerPhone = this.data.volunteerInfo.phone;
      orders[orderIndex].volunteerName = this.data.volunteerInfo.name;
      orders[orderIndex].acceptedTime = new Date().toLocaleString();

      wx.setStorageSync('blind_orders', orders);

      wx.showToast({
        title: '接单成功！',
        icon: 'success'
      });

      // 跳转到订单跟踪页
      setTimeout(() => {
        wx.navigateTo({
          url: `/pages/volunteer-order-track/volunteer-order-track?orderId=${orderId}`
        });
      }, 1500);
    }
  },

  /**
   * 联系盲人
   */
  contactBlind(e) {
    const phone = e.currentTarget.dataset.phone;
    if (phone) {
      wx.makePhoneCall({
        phoneNumber: phone
      });
    } else {
      wx.showToast({
        title: '暂无联系方式',
        icon: 'none'
      });
    }
  },

  /**
   * 导航前往
   */
  navigateToLocation(e) {
    const lat = e.currentTarget.dataset.lat;
    const lng = e.currentTarget.dataset.lng;

    if (lat && lng) {
      wx.openLocation({
        latitude: lat,
        longitude: lng,
        scale: 18
      });
    } else {
      wx.showToast({
        title: '位置信息缺失',
        icon: 'none'
      });
    }
  }
});
