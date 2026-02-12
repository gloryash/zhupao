const app = getApp();

Page({
  data: {
    orders: [],
    emptyTip: '还没有兑换记录',
    showOrderModal: false,
    selectedOrder: null
  },

  onLoad() {
    this.loadOrders();
  },

  onShow() {
    this.loadOrders();
  },

  /**
   * 从云端加载订单数据
   */
  loadOrders() {
    wx.showLoading({ title: '加载中...' });
    app.getExchangeOrders().then(res => {
      wx.hideLoading();
      if (res.success) {
        this.setData({ orders: res.orders || [] });
      }
    }).catch(() => {
      wx.hideLoading();
      // 降级到本地
      const currentUserType = wx.getStorageSync('currentUserType') || 'disabled';
      const orders = wx.getStorageSync(`exchange_orders_${currentUserType}`) || [];
      const formattedOrders = orders.map(order => {
        let status = order.status;
        if (status === 'pending') {
          const expiredTime = new Date(order.expiredTime).getTime();
          if (Date.now() > expiredTime) status = 'expired';
        }
        return { ...order, status };
      });
      this.setData({ orders: formattedOrders });
    });
  },

  /**
   * 点击订单
   */
  onOrderTap(e) {
    const order = e.currentTarget.dataset.order;
    this.setData({
      selectedOrder: order,
      showOrderModal: true
    });
  },

  /**
   * 关闭订单弹窗
   */
  closeOrderModal() {
    this.setData({
      showOrderModal: false,
      selectedOrder: null
    });
  },

  /**
   * 显示兑换码
   */
  showCode() {
    const { selectedOrder } = this.data;
    if (selectedOrder) {
      wx.showModal({
        title: '兑换码',
        content: selectedOrder.code,
        showCancel: false,
        confirmText: '复制'
      });
    }
  },

  /**
   * 删除已过期的订单
   */
  deleteOrder(e) {
    const index = e.currentTarget.dataset.index;

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条兑换记录吗？',
      confirmText: '删除',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          const currentUserType = wx.getStorageSync('currentUserType') || 'disabled';
          const orders = wx.getStorageSync(`exchange_orders_${currentUserType}`) || [];
          orders.splice(index, 1);
          wx.setStorageSync(`exchange_orders_${currentUserType}`, orders);

          this.setData({ orders });
          this.closeOrderModal();

          wx.showToast({
            title: '已删除',
            icon: 'success'
          });
        }
      }
    });
  },

  /**
   * 计算订单状态
   */
  getStatusText(order) {
    if (order.status === 'completed') return '已核销';
    if (order.status === 'expired') return '已过期';
    return '待核销';
  },

  /**
   * 获取状态颜色
   */
  getStatusColor(order) {
    if (order.status === 'completed') return '#10b981';
    if (order.status === 'expired') return '#ef4444';
    return '#f59e0b';
  },

  /**
   * 核销订单（模拟）
   */
  verifyOrder() {
    wx.showToast({
      title: '请出示二维码给店员',
      icon: 'none'
    });
  }
});
