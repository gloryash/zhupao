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
   * 加载经常联系的盲人
   */
  loadContacts() {
    const volunteerPhone = wx.getStorageSync('userInfo_volunteer')?.phone;
    if (!volunteerPhone) {
      this.setData({ contacts: [] });
      return;
    }

    // 获取所有运动记录
    const records = wx.getStorageSync('sport_records') || [];

    // 统计与每个盲人的运动次数
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
            runCount: 0,
            lastRunDate: '',
            totalDistance: 0,
            totalTime: 0
          };
        }

        contactStats[blindPhone].runCount += 1;
        contactStats[blindPhone].totalDistance += record.distance || 0;
        contactStats[blindPhone].totalTime += record.duration || 0;

        // 更新最后一起跑步日期
        if (!contactStats[blindPhone].lastRunDate || record.date > contactStats[blindPhone].lastRunDate) {
          contactStats[blindPhone].lastRunDate = record.date;
        }
      }
    });

    // 转换为数组并按跑步次数排序
    const contacts = Object.values(contactStats)
      .filter(c => c.runCount > 0) // 只显示有一起跑步记录的
      .sort((a, b) => b.runCount - a.runCount) // 按跑步次数降序
      .map(c => ({
        ...c,
        totalTime: Math.round(c.totalTime / 60), // 转换为小时
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
