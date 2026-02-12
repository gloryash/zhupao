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
   * 加载志愿者列表
   */
  loadVolunteers() {
    // 从本地存储获取志愿者
    const allVolunteers = wx.getStorageSync('userInfo_volunteer');

    // 模拟更多志愿者数据（开发测试用）
    let volunteers = [];

    if (allVolunteers && allVolunteers.name) {
      volunteers.push({
        ...allVolunteers,
        id: 'v1',
        pace: '5分30秒/公里',
        hasMarathon: 'yes',
        hasFirstAid: 'yes',
        hasCompanionExp: 'yes',
        totalRuns: 50,
        rating: 4.9
      });
    }

    // 添加模拟志愿者数据用于测试
    const mockVolunteers = [
      {
        id: 'v2',
        name: '张跑跑',
        phone: '13800138002',
        gender: 'male',
        runningYears: '5',
        pace: '5分00秒/公里',
        hasMarathon: 'yes',
        hasFirstAid: 'yes',
        hasCompanionExp: 'yes',
        totalRuns: 120,
        rating: 4.8,
        avatar: 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lxia07jQodd2SJPG10LskbL6ic4rBlePJqN8hntu4LD42D55V2ibJ9XICKria0E5m2dQ/0'
      },
      {
        id: 'v3',
        name: '李爱心',
        phone: '13800138003',
        gender: 'female',
        runningYears: '3',
        pace: '6分00秒/公里',
        hasMarathon: 'no',
        hasFirstAid: 'yes',
        hasCompanionExp: 'yes',
        totalRuns: 80,
        rating: 4.7,
        avatar: 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lxia07jQodd2SJPG10LskbL6ic4rBlePJqN8hntu4LD42D55V2ibJ9XICKria0E5m2dQ/0'
      },
      {
        id: 'v4',
        name: '王健身',
        phone: '13800138004',
        gender: 'male',
        runningYears: '7',
        pace: '4分30秒/公里',
        hasMarathon: 'yes',
        hasFirstAid: 'yes',
        hasCompanionExp: 'yes',
        totalRuns: 200,
        rating: 5.0,
        avatar: 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lxia07jQodd2SJPG10LskbL6ic4rBlePJqN8hntu4LD42D55V2ibJ9XICKria0E5m2dQ/0'
      }
    ];

    // 添加模拟志愿者
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
   * 确认预约
   */
  confirmBooking() {
    if (!this.data.selectedVolunteer) {
      wx.showToast({ title: '请选择志愿者', icon: 'none' });
      return;
    }

    const { bookingDate, bookingTime, selectedVolunteer, remark } = this.data;

    // 创建预约
    const appointment = {
      id: 'apt_' + Date.now(),
      date: bookingDate,
      timeSlot: bookingTime,
      volunteerName: selectedVolunteer.name,
      volunteerPhone: selectedVolunteer.phone,
      volunteerId: selectedVolunteer.id,
      blindName: wx.getStorageSync('userInfo_disabled')?.name || '用户',
      blindPhone: wx.getStorageSync('userInfo_disabled')?.phone || '',
      blindOpenid: wx.getStorageSync('userInfo_disabled')?.token || '',
      remark: remark,
      status: 'pending',
      createdAt: new Date().toLocaleString()
    };

    // 保存预约
    const appointments = wx.getStorageSync('appointments') || [];
    appointments.push(appointment);
    wx.setStorageSync('appointments', appointments);

    wx.showToast({
      title: '预约成功！',
      icon: 'success',
      duration: 2000
    });

    // 返回日历页面
    setTimeout(() => {
      wx.navigateBack();
    }, 2000);
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
