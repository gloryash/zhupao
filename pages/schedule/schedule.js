const app = getApp();

Page({
  data: {
    currentDate: new Date(),
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth() + 1,
    selectedDate: '',
    selectedAppointments: [],
    weekDays: ['日', '一', '二', '三', '四', '五', '六'],

    // 当前用户类型
    userType: 'disabled', // disabled-视障, volunteer-志愿者

    // 模拟预约数据
    appointments: [],

    // 预约表单
    showBookingModal: false,
    bookingDate: '',
    bookingTime: '',
    targetVolunteer: null,

    // 可选时间
    timeSlots: [
      '06:00-07:00',
      '07:00-08:00',
      '08:00-09:00',
      '17:00-18:00',
      '18:00-19:00',
      '19:00-20:00'
    ],
    selectedTimeSlot: '',

    // 备注
    remark: ''
  },

  onLoad(options) {
    // 加载用户类型
    const userType = wx.getStorageSync('currentUserType') || 'disabled';
    this.setData({ userType });

    // 加载预约数据
    this.loadAppointments();

    // 设置当前选中日期
    const today = this.formatDate(new Date());
    this.setData({
      selectedDate: today,
      currentYear: new Date().getFullYear(),
      currentMonth: new Date().getMonth() + 1
    });

    this.updateSelectedAppointments();
  },

  onShow() {
    // 每次显示时刷新数据
    this.loadAppointments();
    this.updateSelectedAppointments();
  },

  /**
   * 从云端加载预约数据
   */
  loadAppointments() {
    // 先从本地快速显示
    const localAppointments = wx.getStorageSync('appointments') || [];
    this.setData({ appointments: localAppointments });

    // 从云端获取最新数据
    app.getAppointments().then(res => {
      if (res.success) {
        const appointments = (res.appointments || []).map(apt => ({
          id: apt._id,
          date: apt.appointmentDate,
          timeSlot: apt.appointmentTime,
          volunteerName: apt.volunteerName || '',
          volunteerPhone: '',
          blindName: apt.blindName || '',
          blindPhone: '',
          blindOpenid: apt.blindOpenid || '',
          remark: apt.note || '',
          status: apt.status || 'pending',
          createdAt: apt.createdAt ? new Date(apt.createdAt).toLocaleString() : ''
        }));
        this.setData({ appointments });
        // 同步到本地缓存
        wx.setStorageSync('appointments', appointments);
      }
    }).catch(() => {});
  },

  /**
   * 保存预约数据（本地缓存）
   */
  saveAppointments() {
    wx.setStorageSync('appointments', this.data.appointments);
  },

  /**
   * 获取月份天数
   */
  getMonthDays(year, month) {
    return new Date(year, month, 0).getDate();
  },

  /**
   * 获取月份第一天是星期几
   */
  getFirstDayOfWeek(year, month) {
    return new Date(year, month - 1, 1).getDay();
  },

  /**
   * 格式化日期为 YYYY-MM-DD
   */
  formatDate(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * 生成日历数据
   */
  generateCalendarDays() {
    const { currentYear, currentMonth, appointments, userType } = this.data;
    const daysInMonth = this.getMonthDays(currentYear, currentMonth);
    const firstDay = this.getFirstDayOfWeek(currentYear, currentMonth);

    const days = [];

    // 添加空白天数
    for (let i = 0; i < firstDay; i++) {
      days.push({ day: '', hasAppointment: false, appointments: [], isToday: false, isSelected: false });
    }

    // 添加日期
    const today = this.formatDate(new Date());

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      // 获取该日期的预约
      let filteredAppts = appointments.filter(apt => apt.date === dateStr);

      if (userType === 'disabled') {
        filteredAppts = filteredAppts.filter(apt =>
          apt.blindOpenid === wx.getStorageSync('userInfo_disabled')?.token ||
          apt.blindPhone === wx.getStorageSync('userInfo_disabled')?.phone
        );
      } else {
        filteredAppts = filteredAppts.filter(apt =>
          apt.volunteerPhone === wx.getStorageSync('userInfo_volunteer')?.phone
        );
      }

      const hasAppointment = filteredAppts.length > 0;

      days.push({
        day,
        dateStr,
        appointments: filteredAppts,
        hasAppointment,
        isToday: dateStr === today,
        isSelected: dateStr === this.data.selectedDate
      });
    }

    return days;
  },

  /**
   * 检查日期是否有预约
   */
  checkDateHasAppointment(dateStr) {
    return this.data.appointments.some(apt => apt.date === dateStr);
  },

  /**
   * 更新选中日期的预约
   */
  updateSelectedAppointments() {
    const { selectedDate, appointments, userType } = this.data;

    let filteredAppts = appointments.filter(apt => apt.date === selectedDate);

    // 根据用户类型过滤
    if (userType === 'disabled') {
      // 视障用户看自己的预约
      filteredAppts = filteredAppts.filter(apt =>
        apt.blindOpenid === wx.getStorageSync('userInfo_disabled')?.token ||
        apt.blindPhone === wx.getStorageSync('userInfo_disabled')?.phone
      );
    } else {
      // 志愿者看分配给自己的预约
      filteredAppts = filteredAppts.filter(apt =>
        apt.volunteerPhone === wx.getStorageSync('userInfo_volunteer')?.phone
      );
    }

    this.setData({
      selectedAppointments: filteredAppts
    });
  },

  /**
   * 选择日期
   */
  onSelectDate(e) {
    const dateStr = e.currentTarget.dataset.date;
    this.setData({ selectedDate: dateStr });
    this.updateSelectedAppointments();
  },

  /**
   * 上个月
   */
  prevMonth() {
    let { currentYear, currentMonth } = this.data;
    if (currentMonth === 1) {
      currentYear--;
      currentMonth = 12;
    } else {
      currentMonth--;
    }
    this.setData({
      currentYear,
      currentMonth
    });
  },

  /**
   * 下个月
   */
  nextMonth() {
    let { currentYear, currentMonth } = this.data;
    if (currentMonth === 12) {
      currentYear++;
      currentMonth = 1;
    } else {
      currentMonth++;
    }
    this.setData({
      currentYear,
      currentMonth
    });
  },

  /**
   * 跳转到今天
   */
  goToToday() {
    const now = new Date();
    this.setData({
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth() + 1,
      selectedDate: this.formatDate(now)
    });
    this.updateSelectedAppointments();
  },

  /**
   * 显示预约弹窗
   */
  showBookingModal() {
    if (this.data.userType !== 'disabled') {
      wx.showToast({ title: '仅视障用户可预约', icon: 'none' });
      return;
    }

    this.setData({
      showBookingModal: true,
      bookingDate: this.data.selectedDate,
      selectedTimeSlot: ''
    });
  },

  /**
   * 关闭预约弹窗
   */
  closeBookingModal() {
    this.setData({
      showBookingModal: false,
      selectedTimeSlot: '',
      remark: ''
    });
  },

  /**
   * 选择时间段
   */
  onSelectTimeSlot(e) {
    const timeSlot = e.currentTarget.dataset.time;
    this.setData({ selectedTimeSlot: timeSlot });
  },

  /**
   * 备注输入
   */
  onRemarkInput(e) {
    this.setData({ remark: e.detail.value });
  },

  /**
   * 确认预约 - 选择志愿者
   */
  confirmBooking() {
    const { bookingDate, selectedTimeSlot } = this.data;

    if (!selectedTimeSlot) {
      wx.showToast({ title: '请选择时间段', icon: 'none' });
      return;
    }

    // 跳转到选择志愿者页面
    wx.navigateTo({
      url: `/pages/volunteer-list/volunteer-list?date=${bookingDate}&time=${selectedTimeSlot}&remark=${this.data.remark}`
    });

    this.closeBookingModal();
  },

  /**
   * 取消预约（同步云端）
   */
  cancelAppointment(e) {
    const appointmentId = e.currentTarget.dataset.id;

    wx.showModal({
      title: '确认取消',
      content: '确定要取消这次预约吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '取消中...' });

          app.cancelAppointment(appointmentId).then(() => {
            wx.hideLoading();
            const appointments = this.data.appointments.filter(
              apt => apt.id !== appointmentId
            );
            this.setData({ appointments });
            this.saveAppointments();
            this.updateSelectedAppointments();
            wx.showToast({ title: '已取消', icon: 'success' });
          }).catch(() => {
            wx.hideLoading();
            // 云端失败，降级本地删除
            const appointments = this.data.appointments.filter(
              apt => apt.id !== appointmentId
            );
            this.setData({ appointments });
            this.saveAppointments();
            this.updateSelectedAppointments();
            wx.showToast({ title: '已取消', icon: 'success' });
          });
        }
      }
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
  },

  /**
   * 完成预约（志愿者操作，同步云端）
   */
  completeAppointment(e) {
    const appointmentId = e.currentTarget.dataset.id;

    wx.showModal({
      title: '确认完成',
      content: '确认完成这次陪跑服务吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '提交中...' });

          app.completeAppointment(appointmentId).then(() => {
            wx.hideLoading();
            const appointments = this.data.appointments.map(apt => {
              if (apt.id === appointmentId) {
                return { ...apt, status: 'completed' };
              }
              return apt;
            });
            this.setData({ appointments });
            this.saveAppointments();
            this.updateSelectedAppointments();
            wx.showToast({ title: '已完成', icon: 'success' });
          }).catch(() => {
            wx.hideLoading();
            // 云端失败，降级本地更新
            const appointments = this.data.appointments.map(apt => {
              if (apt.id === appointmentId) {
                return { ...apt, status: 'completed' };
              }
              return apt;
            });
            this.setData({ appointments });
            this.saveAppointments();
            this.updateSelectedAppointments();
            wx.showToast({ title: '已完成', icon: 'success' });
          });
        }
      }
    });
  }
});
