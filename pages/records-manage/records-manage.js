/**
 * 陪跑记录管理页面
 * 保存志愿者与视障人士的陪跑记录
 */
Page({
  data: {
    records: [],      // 陪跑记录列表
    filteredRecords: [], // 筛选后的记录
    currentTab: 'all', // 当前筛选：all-全部, volunteer-志愿者视角, blind-盲人视角
    searchKeyword: '', // 搜索关键词
    stats: {
      total: 0,
      totalDistance: 0,
      totalTime: 0
    }
  },

  onLoad() {
    this.loadRecords();
  },

  onShow() {
    // 每次显示页面时重新加载数据
    this.loadRecords();
  },

  /**
   * 加载陪跑记录
   */
  loadRecords() {
    const records = wx.getStorageSync('companion_records') || [];
    // 按时间倒序排列
    records.sort((a, b) => new Date(b.completedTime) - new Date(a.completedTime));

    this.setData({
      records,
      filteredRecords: records
    });

    this.calculateStats(records);
  },

  /**
   * 计算统计数据
   */
  calculateStats(records) {
    let totalDistance = 0;
    let totalTime = 0;

    records.forEach(record => {
      totalDistance += parseFloat(record.distance || 0);
      totalTime += parseInt(record.duration || 0);
    });

    this.setData({
      stats: {
        total: records.length,
        totalDistance: totalDistance.toFixed(1),
        totalHours: (totalTime / 60).toFixed(1)
      }
    });
  },

  /**
   * 筛选记录
   */
  filterRecords(keyword, tab) {
    let filtered = this.data.records;

    // 按关键词搜索
    if (keyword) {
      const kw = keyword.toLowerCase();
      filtered = filtered.filter(record =>
        (record.volunteerName && record.volunteerName.toLowerCase().includes(kw)) ||
        (record.blindName && record.blindName.toLowerCase().includes(kw)) ||
        (record.location && record.location.includes(kw))
      );
    }

    this.setData({
      filteredRecords: filtered,
      searchKeyword: keyword,
      currentTab: tab
    });
  },

  /**
   * 输入搜索
   */
  onSearchInput(e) {
    this.filterRecords(e.detail.value, this.data.currentTab);
  },

  /**
   * 切换tab
   */
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.filterRecords(this.data.searchKeyword, tab);
  },

  /**
   * 查看记录详情
   */
  viewDetail(e) {
    const id = e.currentTarget.dataset.id;
    const record = this.data.records.find(r => r.id === id);
    if (record) {
      // 显示详情弹窗
      wx.showModal({
        title: '陪跑记录详情',
        content: this.formatRecordContent(record),
        showCancel: true,
        cancelText: '关闭',
        confirmText: '导出',
        success: (res) => {
          if (res.confirm) {
            this.exportRecord(record);
          }
        }
      });
    }
  },

  /**
   * 格式化记录内容
   */
  formatRecordContent(record) {
    return `
【基本信息】
志愿者：${record.volunteerName || '未记录'}
视障跑者：${record.blindName || '未记录'}
完成时间：${record.completedTime}

【陪跑信息】
目标里程：${record.targetDistance || '未记录'}
实际里程：${record.actualDistance || '--'} km
预计时间：${record.estimatedDuration || '未记录'}
实际用时：${record.duration ? `${Math.round(record.duration)}分钟` : '--'}

【评价】
志愿者评分：${this.renderStars(record.volunteerRate)}
盲人评分：${this.renderStars(record.blindRate)}

志愿者评论：${record.volunteerComment || '暂无'}
盲人评论：${record.blindComment || '暂无'}
    `.trim();
  },

  /**
   * 渲染星星
   */
  renderStars(rating) {
    if (!rating) return '暂无评分';
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  },

  /**
   * 导出记录
   */
  exportRecord(record) {
    const content = this.formatRecordContent(record);
    wx.setClipboardData({
      data: content,
      success: () => {
        wx.showToast({ title: '已复制到剪贴板', icon: 'success' });
      }
    });
  },

  /**
   * 删除记录
   */
  deleteRecord(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条陪跑记录吗？',
      success: (res) => {
        if (res.confirm) {
          const records = this.data.records.filter(r => r.id !== id);
          wx.setStorageSync('companion_records', records);
          this.setData({ records });
          this.filterRecords(this.data.searchKeyword, this.data.currentTab);
          wx.showToast({ title: '删除成功', icon: 'success' });
        }
      }
    });
  },

  /**
   * 清除所有记录
   */
  clearAllRecords() {
    wx.showModal({
      title: '警告',
      content: '确定要清除所有陪跑记录吗？此操作不可恢复！',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('companion_records');
          this.setData({ records: [], filteredRecords: [] });
          this.calculateStats([]);
          wx.showToast({ title: '已清除所有记录', icon: 'success' });
        }
      }
    });
  },

  /**
   * 导出全部记录
   */
  exportAllRecords() {
    if (this.data.records.length === 0) {
      wx.showToast({ title: '暂无记录', icon: 'none' });
      return;
    }

    let content = `【助盲跑陪跑记录导出】\n导出时间：${new Date().toLocaleString()}\n总记录数：${this.data.stats.total}\n\n`;

    this.data.records.forEach((record, index) => {
      content += `\n【记录 ${index + 1}】\n`;
      content += `志愿者：${record.volunteerName || '未记录'}\n`;
      content += `视障跑者：${record.blindName || '未记录'}\n`;
      content += `完成时间：${record.completedTime}\n`;
      content += `里程：${record.actualDistance || '--'} km\n`;
      content += `用时：${record.duration ? `${Math.round(record.duration)}分钟` : '--'}\n`;
    });

    wx.setClipboardData({
      data: content,
      success: () => {
        wx.showToast({ title: '已导出全部记录', icon: 'success' });
      }
    });
  },

  /**
   * 格式化时间显示
   */
  formatTime(timeStr) {
    if (!timeStr) return '--';
    const date = new Date(timeStr);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  },

  /**
   * 拨打电话（视障用户联系志愿者预约）
   */
  callVolunteer(e) {
    const id = e.currentTarget.dataset.id;
    const record = this.data.records.find(r => r.id === id);
    if (record && record.volunteerPhone) {
      wx.makePhoneCall({
        phoneNumber: record.volunteerPhone,
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
   * 查看志愿者详情
   */
  viewVolunteerDetail(e) {
    const id = e.currentTarget.dataset.id;
    const record = this.data.records.find(r => r.id === id);
    if (record) {
      wx.showModal({
        title: '志愿者信息',
        content: `姓名：${record.volunteerName || '未记录'}\n电话：${record.volunteerPhone || '未记录'}`,
        confirmText: record.volunteerPhone ? '拨打电话' : '我知道了',
        success: (res) => {
          if (res.confirm && record.volunteerPhone) {
            wx.makePhoneCall({
              phoneNumber: record.volunteerPhone
            });
          }
        }
      });
    }
  }
});
