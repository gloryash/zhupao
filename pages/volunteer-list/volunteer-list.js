const app = getApp();

Page({
  data: {
    // 预约信息
    bookingDate: '',
    bookingTime: '',
    remark: '',

    // 搜索和筛选
    searchKeyword: '',
    filterPace: '',
    filterFirstAid: '',

    // 志愿者列表（模拟数据）
    volunteers: [],

    // 选中志愿者
    selectedVolunteer: null
  },

  onLoad(options) {
    const { date, time, remark } = options;
    this.setData({
      bookingDate: date,
      bookingTime: time,
      remark: remark || ''
    });

    // 加载志愿者列表
    this.loadVolunteers();
  },

  onShow() {
    this.loadVolunteers();
  },

  /**
   * 从云端加载志愿者列表
   */
  loadVolunteers() {
    wx.showLoading({ title: '加载中...' });
    app.getVolunteers(1).then(res => {
      wx.hideLoading();
      if (res.success && res.volunteers.length > 0) {
        const volunteers = res.volunteers.map(v => ({
          id: v._id || v.openid,
          name: v.nickName || v.name || '志愿者',
          phone: v.phone || '',
          avatarUrl: v.avatarUrl || '',
          tierLevel: v.tierLevel || 1,
          tierName: v.tierName || '启明之星',
          totalRuns: v.totalRuns || 0,
          likes: v.likes || 0,
          rating: v.likes ? Math.min(5, 4 + v.likes / 100) : 4.5,
          pace: '',
          hasFirstAid: 'yes',
          hasCompanionExp: v.totalRuns > 0 ? 'yes' : 'no',
          hasMarathon: v.totalRuns > 10 ? 'yes' : 'no'
        }));
        this.setData({ volunteers });
      } else {
        this._loadLocalVolunteers();
      }
    }).catch(() => {
      wx.hideLoading();
      this._loadLocalVolunteers();
    });
  },

  /**
   * 本地降级加载志愿者
   */
  _loadLocalVolunteers() {
    let volunteers = [];
    const allVolunteers = wx.getStorageSync('userInfo_volunteer');
    if (allVolunteers && allVolunteers.name) {
      volunteers.push({
        ...allVolunteers, id: 'v1', pace: '5分30秒/公里',
        hasMarathon: 'yes', hasFirstAid: 'yes', hasCompanionExp: 'yes',
        totalRuns: 50, rating: 4.9
      });
    }
    const mockVolunteers = [
      { id: 'v2', name: '张跑跑', phone: '13800138002', pace: '5分00秒/公里', hasMarathon: 'yes', hasFirstAid: 'yes', hasCompanionExp: 'yes', totalRuns: 120, rating: 4.8 },
      { id: 'v3', name: '李爱心', phone: '13800138003', pace: '6分00秒/公里', hasMarathon: 'no', hasFirstAid: 'yes', hasCompanionExp: 'yes', totalRuns: 80, rating: 4.7 },
      { id: 'v4', name: '王健身', phone: '13800138004', pace: '4分30秒/公里', hasMarathon: 'yes', hasFirstAid: 'yes', hasCompanionExp: 'yes', totalRuns: 200, rating: 5.0 }
    ];
    volunteers = [...volunteers, ...mockVolunteers];
    this.setData({ volunteers });
  },

  /**
   * 搜索志愿者
   */
  onSearchInput(e) {
    this.setData({
      searchKeyword: e.detail.value
    });
  },

  /**
   * 筛选：是否有急救证
   */
  onFilterFirstAid(e) {
    this.setData({
      filterFirstAid: e.detail.value
    });
  },

  /**
   * 获取筛选后的志愿者列表
   */
  getFilteredVolunteers() {
    let { volunteers, searchKeyword, filterFirstAid } = this.data;

    // 搜索筛选
    if (searchKeyword) {
      const keyword = searchKeyword.toLowerCase();
      volunteers = volunteers.filter(v =>
        v.name.toLowerCase().includes(keyword) ||
        v.pace?.includes(keyword)
      );
    }

    // 急救证筛选
    if (filterFirstAid === 'yes') {
      volunteers = volunteers.filter(v => v.hasFirstAid === 'yes');
    }

    return volunteers;
  },

  /**
   * 选择志愿者
   */
  selectVolunteer(e) {
    const volunteer = e.currentTarget.dataset.volunteer;
    this.setData({ selectedVolunteer: volunteer });
  },

  /**
   * 确认预约（同步到云端）
   */
  confirmBooking() {
    if (!this.data.selectedVolunteer) {
      wx.showToast({ title: '请选择志愿者', icon: 'none' });
      return;
    }

    const { bookingDate, bookingTime, selectedVolunteer, remark } = this.data;

    wx.showLoading({ title: '预约中...' });

    // 云端创建预约
    app.createAppointment({
      volunteerOpenid: selectedVolunteer.openid || '',
      volunteerName: selectedVolunteer.name,
      volunteerAvatar: selectedVolunteer.avatarUrl || '',
      appointmentDate: bookingDate,
      appointmentTime: bookingTime,
      note: remark
    }).then(res => {
      wx.hideLoading();
      if (res.success) {
        // 同步到本地缓存
        const appointments = wx.getStorageSync('appointments') || [];
        appointments.push({
          id: res.appointmentId,
          date: bookingDate,
          timeSlot: bookingTime,
          volunteerName: selectedVolunteer.name,
          volunteerPhone: selectedVolunteer.phone,
          volunteerId: selectedVolunteer.id,
          remark: remark,
          status: 'pending',
          createdAt: new Date().toLocaleString()
        });
        wx.setStorageSync('appointments', appointments);

        wx.showToast({ title: '预约成功！', icon: 'success', duration: 2000 });
        setTimeout(() => { wx.navigateBack(); }, 2000);
      }
    }).catch(() => {
      wx.hideLoading();
      // 降级到本地保存
      const appointment = {
        id: 'apt_' + Date.now(),
        date: bookingDate, timeSlot: bookingTime,
        volunteerName: selectedVolunteer.name,
        volunteerPhone: selectedVolunteer.phone,
        volunteerId: selectedVolunteer.id,
        remark: remark, status: 'pending',
        createdAt: new Date().toLocaleString()
      };
      const appointments = wx.getStorageSync('appointments') || [];
      appointments.push(appointment);
      wx.setStorageSync('appointments', appointments);
      wx.showToast({ title: '预约成功！', icon: 'success', duration: 2000 });
      setTimeout(() => { wx.navigateBack(); }, 2000);
    });
  },

  /**
   * 拨打电话
   */
  makePhoneCall(e) {
    const phone = e.currentTarget.dataset.phone;
    if (phone) {
      wx.makePhoneCall({
        phoneNumber: phone,
        fail: () => {
          wx.showToast({ title: '拨打电话失败', icon: 'none' });
        }
      });
    }
  }
});
