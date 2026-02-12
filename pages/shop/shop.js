const app = getApp();

Page({
  data: {
    userPoints: 0,
    userPointsAnim: false,
    currentCategory: 'all',
    categories: [
      { key: 'all', name: '全部' },
      { key: 'food', name: '能量补给' },
      { key: 'equipment', name: '专业装备' },
      { key: 'honor', name: '荣誉周边' },
      { key: 'virtual', name: '虚拟权益' }
    ],
    products: [],
    filteredProducts: [],
    exchangedOrders: [],
    showExchangeModal: false,
    selectedProduct: null,
    exchangeCode: '',
    showCodeModal: false,
    // 滚动公告
    notices: [],
    showNotice: false,
    currentNoticeIndex: 0
  },

  onLoad() {
    this.loadUserPoints();
    this.loadProducts();
    this.loadExchangedOrders();
    this.loadNotices();
  },

  onShow() {
    this.loadUserPoints();
  },

  onPullDownRefresh() {
    this.loadUserPoints();
    this.loadProducts();
    this.loadExchangedOrders();
    wx.stopPullDownRefresh();
  },

  /**
   * 加载用户积分（从云端获取）
   */
  loadUserPoints() {
    // 先从本地缓存快速显示
    const currentUserType = wx.getStorageSync('currentUserType') || 'disabled';
    const userStats = app.getUserStats(currentUserType);
    this.setData({ userPoints: userStats.points || 0 });

    // 再从云端同步最新数据
    app.getCloudUserStats().then(res => {
      if (res.success) {
        this.setData({ userPoints: res.stats.points || 0 });
        // 同步到本地缓存
        const stats = app.getUserStats(currentUserType);
        stats.points = res.stats.points || 0;
        stats.exp = res.stats.exp || 0;
        app.saveUserStats(currentUserType, stats);
      }
    }).catch(() => {});
  },

  /**
   * 从云端加载商品数据
   */
  loadProducts() {
    wx.showLoading({ title: '加载中...' });
    app.getProducts(this.data.currentCategory).then(res => {
      wx.hideLoading();
      if (res.success) {
        const products = res.products.map(p => ({
          ...p,
          id: p._id // 兼容前端使用 id 字段
        }));
        this.setData({
          products: products,
          filteredProducts: products
        });
      }
    }).catch(() => {
      wx.hideLoading();
      // 云端失败时使用本地备份数据
      this._loadLocalProducts();
    });
  },

  /**
   * 本地备份商品数据（云端不可用时使用）
   */
  _loadLocalProducts() {
    const products = [
      { id: 1, name: '奶茶券', price: 200, image: '🧋', category: 'food', stock: 50, sold: 23, desc: '任意门店兑换一杯奶茶', limit: 1 },
      { id: 2, name: '咖啡券', price: 150, image: '☕', category: 'food', stock: 80, sold: 45, desc: '连锁咖啡店通用券', limit: 1 },
      { id: 3, name: '运动饮料', price: 80, image: '🥤', category: 'food', stock: 100, sold: 67, desc: '补充电解质能量', limit: 5 },
      { id: 4, name: '能量棒', price: 50, image: '🍫', category: 'food', stock: 200, sold: 156, desc: '跑步前后补充能量', limit: 10 },
      { id: 5, name: '蛋白棒', price: 100, image: '🥨', category: 'food', stock: 150, sold: 89, desc: '高蛋白营养补给', limit: 5 },
      { id: 6, name: '专业跑鞋', price: 2000, image: '👟', category: 'equipment', stock: 10, sold: 3, desc: '减震透气专业跑鞋', limit: 1 },
      { id: 7, name: '护膝', price: 300, image: '🦵', category: 'equipment', stock: 30, sold: 12, desc: '保护膝盖关节', limit: 2 },
      { id: 8, name: '运动手表', price: 1500, image: '⌚', category: 'equipment', stock: 5, sold: 1, desc: '心率监测GPS定位', limit: 1 },
      { id: 9, name: '速干衣', price: 500, image: '👕', category: 'equipment', stock: 25, sold: 8, desc: '透气排汗速干面料', limit: 2 },
      { id: 10, name: '空顶帽', price: 150, image: '🧢', category: 'equipment', stock: 60, sold: 34, desc: '防晒透气空顶帽', limit: 3 },
      { id: 11, name: '助盲跑文化衫', price: 300, image: '👕', category: 'honor', stock: 100, sold: 56, desc: '彰显志愿者身份', limit: 3 },
      { id: 12, name: '荣誉勋章', price: 500, image: '🏅', category: 'honor', stock: 50, sold: 23, desc: '收藏级纪念勋章', limit: 2 },
      { id: 13, name: '段位徽章', price: 200, image: '⭐', category: 'honor', stock: 200, sold: 145, desc: '展示你的段位等级', limit: 5 },
      { id: 14, name: '定制水壶', price: 250, image: '🫖', category: 'honor', stock: 40, sold: 18, desc: '刻有助盲跑logo', limit: 2 },
      { id: 15, name: '专属头像框', price: 100, image: '🖼️', category: 'virtual', stock: 999, sold: 234, desc: '头像显示荣誉边框', limit: 1 },
      { id: 16, name: '段位加速卡', price: 300, image: '🚀', category: 'virtual', stock: 100, sold: 45, desc: '下次陪跑双倍经验', limit: 3 },
      { id: 17, name: '个性昵称', price: 150, image: '💬', category: 'virtual', stock: 500, sold: 178, desc: '特殊颜色昵称', limit: 1 },
      { id: 18, name: '入场动画', price: 200, image: '✨', category: 'virtual', stock: 300, sold: 89, desc: '进入app时的特效', limit: 1 }
    ];
    this.setData({ products: products, filteredProducts: products });
  },

  /**
   * 从云端加载已兑换订单
   */
  loadExchangedOrders() {
    app.getExchangeOrders().then(res => {
      if (res.success) {
        this.setData({ exchangedOrders: res.orders || [] });
      }
    }).catch(() => {
      // 降级到本地
      const currentUserType = wx.getStorageSync('currentUserType') || 'disabled';
      const orders = wx.getStorageSync(`exchange_orders_${currentUserType}`) || [];
      this.setData({ exchangedOrders: orders });
    });
  },

  /**
   * 加载滚动公告
   */
  loadNotices() {
    const notices = [
      '🏃 志愿者张先生刚刚兑换了一杯奶茶',
      '👁️ 视障跑者李女士兑换了一双跑鞋',
      '❤️ 志愿者王女士兑换了荣誉勋章',
      '⭐ 用户陈先生兑换了专属头像框'
    ];
    this.setData({ notices });

    // 开始滚动
    this.startNoticeAnimation();
  },

  /**
   * 开始公告滚动动画
   */
  startNoticeAnimation() {
    let index = 0;
    this.setData({
      showNotice: true,
      currentNoticeIndex: 0
    });

    setInterval(() => {
      index = (index + 1) % this.data.notices.length;
      this.setData({ currentNoticeIndex: index });
    }, 3000);
  },

  /**
   * 切换分类
   */
  onCategoryChange(e) {
    const key = e.currentTarget.dataset.key;
    let filtered = this.data.products;

    if (key !== 'all') {
      filtered = this.data.products.filter(p => p.category === key);
    }

    this.setData({
      currentCategory: key,
      filteredProducts: filtered
    });
  },

  /**
   * 点击商品
   */
  onProductTap(e) {
    const product = e.currentTarget.dataset.product;
    this.setData({
      selectedProduct: product,
      showExchangeModal: true
    });
  },

  /**
   * 关闭兑换弹窗
   */
  closeExchangeModal() {
    this.setData({
      showExchangeModal: false,
      selectedProduct: null
    });
  },

  /**
   * 确认兑换（通过云函数事务处理）
   */
  confirmExchange() {
    const { selectedProduct, userPoints } = this.data;

    if (userPoints < selectedProduct.price) {
      wx.showModal({
        title: '积分不足',
        content: `您的爱心积分还差 ${selectedProduct.price - userPoints} 分，再去陪跑一次吧！`,
        showCancel: false,
        confirmText: '知道了'
      });
      return;
    }

    if (selectedProduct.stock <= 0) {
      wx.showToast({ title: '已被抢光', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '兑换中...' });

    // 使用云函数事务处理兑换（原子操作：扣积分+减库存+创建订单）
    const productId = selectedProduct._id || selectedProduct.id;
    app.cloudExchange(productId, selectedProduct.name, selectedProduct.price).then(res => {
      wx.hideLoading();
      if (res.success) {
        // 更新本地积分缓存
        const currentUserType = wx.getStorageSync('currentUserType') || 'disabled';
        const userStats = app.getUserStats(currentUserType);
        userStats.points = res.remainingPoints;
        app.saveUserStats(currentUserType, userStats);

        this.setData({
          userPoints: res.remainingPoints,
          showExchangeModal: false,
          selectedProduct: null,
          exchangeCode: res.exchangeCode,
          showCodeModal: true
        });

        // 刷新商品列表和订单
        this.loadProducts();
        this.loadExchangedOrders();

        wx.showToast({ title: '兑换成功', icon: 'success' });
      }
    }).catch(err => {
      wx.hideLoading();
      wx.showModal({
        title: '兑换失败',
        content: typeof err === 'string' ? err : '请稍后重试',
        showCancel: false
      });
    });
  },

  /**
   * 关闭兑换码弹窗
   */
  closeCodeModal() {
    this.setData({
      showCodeModal: false,
      exchangeCode: ''
    });
  },

  /**
   * 保存兑换码到相册
   */
  saveCodeToAlbum() {
    if (!this.data.exchangeCode) return;

    wx.showToast({
      title: '请截图保存',
      icon: 'none'
    });
  },

  /**
   * 查看我的订单
   */
  goToOrders() {
    wx.navigateTo({
      url: '/pages/shop-orders/shop-orders'
    });
  },

  /**
   * 积分动画效果
   */
  animatePoints() {
    this.setData({ userPointsAnim: true });
    setTimeout(() => {
      this.setData({ userPointsAnim: false });
    }, 500);
  }
});
