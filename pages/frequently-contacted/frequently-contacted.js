// pages/frequently-contacted/frequently-contacted.js
const app = getApp();

Page({
  data: {
    contacts: [],
    userType: 'volunteer'
  },

  onLoad() {
    this.loadContacts();
  },

  onShow() {
    this.loadContacts();
  },

  /**
   * 从云端加载经常联系的人
   */
  loadContacts() {
    // 先从本地快速显示
    this._loadLocalContacts();

    // 从云端获取最新数据
    app.getFrequentContacts(10).then(res => {
      if (res.success && res.contacts.length > 0) {
        const contacts = res.contacts.map(c => ({
          name: c.nickName || c.name || '未知',
          phone: '',
          avatar: c.name ? c.name[0] : '未',
          runCount: c.count || 0,
          lastRunDate: c.lastTime ? this.formatDate(c.lastTime) : '',
          totalDistance: 0,
          totalTime: 0
        }));
        this.setData({ contacts });
      }
    }).catch(() => {});
  },

  /**
   * 本地降级加载
   */
  _loadLocalContacts() {
    const volunteerPhone = wx.getStorageSync('userInfo_volunteer')?.phone;
    if (!volunteerPhone) {
      this.setData({ contacts: [] });
      return;
    }

    const records = wx.getStorageSync('sport_records') || [];
    const contactStats = {};

    records.forEach(record => {
      if (record.type === 'paired' && record.volunteerPhone === volunteerPhone && record.blindInfo) {
        const blindPhone = record.blindPhone || record.blindInfo.phone;
        if (!blindPhone) return;
        if (!contactStats[blindPhone]) {
          contactStats[blindPhone] = {
            name: record.blindInfo.name || '未知',
            phone: blindPhone,
            avatar: record.blindInfo.name ? record.blindInfo.name[0] : '未',
            runCount: 0, lastRunDate: '', totalDistance: 0, totalTime: 0
          };
        }
        contactStats[blindPhone].runCount += 1;
        contactStats[blindPhone].totalDistance += record.distance || 0;
        contactStats[blindPhone].totalTime += record.duration || 0;
        if (!contactStats[blindPhone].lastRunDate || record.date > contactStats[blindPhone].lastRunDate) {
          contactStats[blindPhone].lastRunDate = record.date;
        }
      }
    });

    const contacts = Object.values(contactStats)
      .filter(c => c.runCount > 0)
      .sort((a, b) => b.runCount - a.runCount)
      .map(c => ({
        ...c,
        totalTime: Math.round(c.totalTime / 60),
        lastRunDate: c.lastRunDate ? this.formatDate(c.lastRunDate) : ''
      }));

    this.setData({ contacts });
  },

  /**
   * 格式化日期
   */
  formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateStr === this.formatDateOnly(today)) {
      return '今天';
    } else if (dateStr === this.formatDateOnly(yesterday)) {
      return '昨天';
    }
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  },

  formatDateOnly(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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
  },

  /**
   * 添加紧急联系人（目前没有这个功能，显示提示）
   */
  addContact() {
    wx.showModal({
      title: '提示',
      content: '经常联系的盲人将从您的一起跑步记录中自动统计',
      showCancel: false,
      confirmText: '知道了'
    });
  }
})
