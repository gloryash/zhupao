const app = getApp();

Page({
  data: {
    userType: '',
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
    btnDisabled: false
  },

  onLoad() {
    this.loadUserType();
  },

  /**
   * 加载用户类型
   */
  loadUserType() {
    const userType = wx.getStorageSync('currentUserType') || 'disabled';
    this.setData({ userType });
  },

  /**
   * 旧密码输入
   */
  onOldPasswordInput(e) {
    this.setData({
      oldPassword: e.detail.value
    });
  },

  /**
   * 新密码输入
   */
  onNewPasswordInput(e) {
    this.setData({
      newPassword: e.detail.value
    });
  },

  /**
   * 确认密码输入
   */
  onConfirmPasswordInput(e) {
    this.setData({
      confirmPassword: e.detail.value
    });
  },

  /**
   * 提交修改
   */
  handleSubmit() {
    const { userType, oldPassword, newPassword, confirmPassword } = this.data;

    // 验证旧密码
    if (!oldPassword) {
      wx.showToast({
        title: '请输入旧密码',
        icon: 'none'
      });
      return;
    }

    const savedPassword = wx.getStorageSync(`password_${userType}`);
    if (oldPassword !== savedPassword) {
      wx.showToast({
        title: '旧密码错误',
        icon: 'none'
      });
      return;
    }

    // 验证新密码
    if (!newPassword || newPassword.length < 4 || newPassword.length > 6) {
      wx.showToast({
        title: '新密码需4-6位数字',
        icon: 'none'
      });
      return;
    }

    if (!/^\d+$/.test(newPassword)) {
      wx.showToast({
        title: '新密码必须是数字',
        icon: 'none'
      });
      return;
    }

    // 验证确认密码
    if (newPassword !== confirmPassword) {
      wx.showToast({
        title: '两次密码不一致',
        icon: 'none'
      });
      return;
    }

    // 保存新密码
    wx.setStorageSync(`password_${userType}`, newPassword);

    wx.showToast({
      title: '密码修改成功',
      icon: 'success'
    });

    setTimeout(() => {
      wx.navigateBack();
    }, 1500);
  }
})
