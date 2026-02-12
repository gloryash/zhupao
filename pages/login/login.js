const app = getApp();

Page({
  data: {
    phone: '',
    verifyCode: '',
    countdown: 0,
    isSending: false,
    sentCode: '' // 模拟发送的验证码
  },

  onLoad() {
    this.checkLoginStatus();
  },

  onShow() {
    this.checkLoginStatus();
  },

  /**
   * 检查登录状态
   */
  checkLoginStatus() {
    const isLoggedIn = wx.getStorageSync('isLoggedIn');
    if (isLoggedIn) {
      wx.switchTab({
        url: '/pages/home/home'
      });
    }
  },

  /**
   * 手机号输入
   */
  onPhoneInput(e) {
    this.setData({
      phone: e.detail.value
    });
  },

  /**
   * 验证码输入
   */
  onCodeInput(e) {
    this.setData({
      verifyCode: e.detail.value
    });
  },

  /**
   * 获取验证码
   */
  getVerificationCode() {
    const { phone } = this.data;

    if (phone.length !== 11) {
      wx.showToast({
        title: '请输入正确的手机号',
        icon: 'none'
      });
      return;
    }

    this.setData({ isSending: true });

    // 模拟发送验证码（实际项目中应调用云函数发送真实短信）
    wx.showLoading({ title: '发送中...' });

    setTimeout(() => {
      wx.hideLoading();

      // 生成6位随机验证码
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      this.setData({ sentCode: code });

      console.log('验证码:', code); // 调试用，实际应删除

      wx.showToast({
        title: '验证码已发送',
        icon: 'success'
      });

      // 开始倒计时
      this.startCountdown();
      this.setData({ isSending: false });
    }, 1000);
  },

  /**
   * 开始倒计时
   */
  startCountdown() {
    let seconds = 60;
    this.setData({ countdown: seconds });

    this.countdownTimer = setInterval(() => {
      seconds--;
      if (seconds <= 0) {
        clearInterval(this.countdownTimer);
        this.setData({ countdown: 0 });
      } else {
        this.setData({ countdown: seconds });
      }
    }, 1000);
  },

  /**
   * 登录
   */
  handleLogin() {
    const { phone, verifyCode } = this.data;

    // 验证手机号
    if (!phone.trim()) {
      wx.showToast({
        title: '请输入手机号',
        icon: 'none'
      });
      return;
    }

    const phoneReg = /^1[3-9]\d{9}$/;
    if (!phoneReg.test(phone)) {
      wx.showToast({
        title: '请输入正确的手机号',
        icon: 'none'
      });
      return;
    }

    // 验证验证码
    if (!verifyCode.trim()) {
      wx.showToast({
        title: '请输入验证码',
        icon: 'none'
      });
      return;
    }

    if (verifyCode.length !== 6) {
      wx.showToast({
        title: '请输入6位验证码',
        icon: 'none'
      });
      return;
    }

    // 验证验证码是否正确
    if (verifyCode !== this.data.sentCode) {
      wx.showToast({
        title: '验证码错误',
        icon: 'none'
      });
      return;
    }

    // 验证通过，继续登录
    this.checkRegisteredUser(phone);
  },

  /**
   * 检查已注册用户
   */
  checkRegisteredUser(phone) {
    const disabledUserInfo = wx.getStorageSync('userInfo_disabled');
    const volunteerUserInfo = wx.getStorageSync('userInfo_volunteer');

    const hasDisabled = disabledUserInfo && disabledUserInfo.phone === phone;
    const hasVolunteer = volunteerUserInfo && volunteerUserInfo.phone === phone;

    if (hasDisabled && hasVolunteer) {
      // 手机号同时注册了两个账号，让用户选择
      wx.showActionSheet({
        itemList: ['我是视障人士', '我是志愿者'],
        itemColor: '#333333',
        success: (res) => {
          const userType = res.tapIndex === 0 ? 'disabled' : 'volunteer';
          this.doLogin(phone, userType);
        }
      });
    } else if (hasDisabled) {
      // 只有一个视障账号
      this.doLogin(phone, 'disabled');
    } else if (hasVolunteer) {
      // 只有一个志愿者账号
      this.doLogin(phone, 'volunteer');
    } else {
      // 新用户，让用户选择身份后去注册
      this.showUserTypeDialog(phone);
    }
  },

  /**
   * 显示用户类型选择对话框
   */
  showUserTypeDialog(phone) {
    wx.showActionSheet({
      itemList: ['我是视障人士', '我是志愿者'],
      itemColor: '#333333',
      success: (res) => {
        const userType = res.tapIndex === 0 ? 'disabled' : 'volunteer';
        // 跳转注册页，携带手机号和用户类型
        wx.navigateTo({
          url: `/pages/user-info/user-info?phone=${phone}&userType=${userType}`
        });
      }
    });
  },

  /**
   * 执行登录
   */
  doLogin(phone, userType) {
    wx.showLoading({ title: '登录中...' });

    setTimeout(() => {
      wx.hideLoading();

      // 生成 token
      const token = 'QR_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

      // 获取用户信息
      const userInfo = wx.getStorageSync(`userInfo_${userType}`);

      // 保存登录状态
      wx.setStorageSync('isLoggedIn', true);
      wx.setStorageSync('currentUserType', userType);

      // 更新全局数据
      app.globalData.isLoggedIn = true;
      app.globalData.userInfo = {
        ...userInfo,
        token: token
      };

      wx.showToast({
        title: '登录成功',
        icon: 'success',
        duration: 1500
      });

      // 跳转到首页
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/home/home'
        });
      }, 1500);
    }, 500);
  },

  onUnload() {
    // 页面卸载时清除倒计时
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
    }
  }
});
