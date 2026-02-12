const app = getApp();

Page({
  data: {
    userInfo: null,
    userType: '',
    qrCodeUrl: '',
    token: '',
    showEmergencyModal: false,
    isLoggedIn: false,

    // 手机验证码登录相关
    loginPhone: '',
    verifyCode: '',
    generatedCode: '',
    codeBtnText: '获取验证码',
    codeBtnDisabled: false,
    countdown: 60
  },

  onLoad() {
    // 自动跳转到新登录页
    wx.redirectTo({
      url: '/pages/login/login'
    });
  },

  onShow() {
    this.checkLoginStatus();
  },

  /**
   * 检查登录状态并显示相应内容
   */
  checkLoginStatus() {
    const currentUserType = wx.getStorageSync('currentUserType');
    const userInfo = currentUserType ? wx.getStorageSync(`userInfo_${currentUserType}`) : null;

    if (currentUserType && userInfo && userInfo.token) {
      // 已登录用户，生成个人二维码
      this.setData({
        userType: currentUserType,
        userInfo: userInfo,
        token: userInfo.token,
        isLoggedIn: true
      });

      // 生成二维码
      setTimeout(() => {
        this.generateQRCode();
      }, 100);
    } else {
      // 未登录，显示登录表单
      this.setData({
        userType: '',
        userInfo: null,
        token: '',
        isLoggedIn: false
      });
    }

    // 检查是否需要填写紧急联系人
    this.checkEmergencyContact();
  },

  /**
   * 微信一键登录
   */
  handleWechatLogin() {
    wx.showLoading({ title: '正在登录...' });

    // 调用微信登录接口
    wx.login({
      success: (loginRes) => {
        if (loginRes.code) {
          // 调用云函数验证登录
          wx.cloud.callFunction({
            name: 'wechatLogin',
            data: {
              code: loginRes.code
            },
            success: (res) => {
              wx.hideLoading();
              if (res.result && res.result.success) {
                if (res.result.isNewUser) {
                  // 新用户，引导填写完整信息
                  wx.showModal({
                    title: '提示',
                    content: '请先填写完整信息完成注册',
                    confirmText: '去填写',
                    success: (modalRes) => {
                      if (modalRes.confirm) {
                        this.showUserTypeDialog(res.result.openid);
                      }
                    }
                  });
                } else {
                  // 老用户，登录成功
                  this.handleLoginSuccess(res.result.userInfo, res.result.userType);
                }
              } else {
                wx.showToast({
                  title: res.result?.error || '登录失败',
                  icon: 'none'
                });
              }
            },
            fail: (err) => {
              wx.hideLoading();
              console.error('微信登录失败:', err);
              wx.showToast({
                title: '登录失败，请重试',
                icon: 'none'
              });
            }
          });
        } else {
          wx.hideLoading();
          wx.showToast({
            title: '微信登录失败',
            icon: 'none'
          });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({
          title: '微信登录失败',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 显示用户类型选择对话框
   */
  showUserTypeDialog(openid = null) {
    wx.showActionSheet({
      itemList: ['我是视障人士', '我是志愿者'],
      itemColor: '#333333',
      success: (res) => {
        const userType = res.tapIndex === 0 ? 'disabled' : 'volunteer';
        this.goToRegister(userType, openid);
      }
    });
  },

  /**
   * 跳转到完整信息注册页面
   */
  goToRegister(userType = null, openid = null) {
    let url = '/pages/user-info/user-info';
    let params = [];

    if (userType) {
      params.push(`userType=${userType}`);
    }
    if (openid) {
      params.push(`openid=${openid}`);
    }

    if (params.length > 0) {
      url += '?' + params.join('&');
    }

    wx.navigateTo({ url });
  },

  /**
   * 手机号登录
   */
  handlePhoneLogin() {
    const { loginPhone, verifyCode, generatedCode } = this.data;

    if (!loginPhone.trim()) {
      wx.showToast({
        title: '请输入手机号',
        icon: 'none'
      });
      return;
    }

    if (!verifyCode.trim()) {
      wx.showToast({
        title: '请输入验证码',
        icon: 'none'
      });
      return;
    }

    if (verifyCode !== generatedCode) {
      wx.showToast({
        title: '验证码错误',
        icon: 'none'
      });
      return;
    }

    // 验证码正确，检查是否已注册
    this.checkUserRegistered(loginPhone);
  },

  /**
   * 检查用户是否已注册
   */
  checkUserRegistered(phone) {
    // 检查两种用户类型是否已注册
    const disabledUserInfo = wx.getStorageSync('userInfo_disabled');
    const volunteerUserInfo = wx.getStorageSync('userInfo_volunteer');

    if (disabledUserInfo && disabledUserInfo.phone === phone) {
      this.handleLoginSuccess(disabledUserInfo, 'disabled');
    } else if (volunteerUserInfo && volunteerUserInfo.phone === phone) {
      this.handleLoginSuccess(volunteerUserInfo, 'volunteer');
    } else {
      // 未注册，引导填写完整信息
      wx.showModal({
        title: '提示',
        content: '该手机号未注册，请先填写完整信息完成注册',
        confirmText: '去注册',
        success: (res) => {
          if (res.confirm) {
            this.goToRegister();
          }
        }
      });
    }
  },

  /**
   * 处理登录成功
   */
  handleLoginSuccess(userInfo, userType) {
    // 保存登录状态
    wx.setStorageSync('currentUserType', userType);
    wx.setStorageSync('isLoggedIn', true);

    // 更新全局数据
    app.globalData.userInfo = userInfo;
    app.globalData.isLoggedIn = true;

    this.setData({
      userInfo: userInfo,
      userType: userType,
      token: userInfo.token,
      isLoggedIn: true
    });

    wx.showToast({
      title: '登录成功',
      icon: 'success'
    });

    // 生成二维码
    setTimeout(() => {
      this.generateQRCode();
    }, 100);
  },

  /**
   * 生成二维码
   */
  generateQRCode() {
    const token = this.data.token;
    if (!token) return;

    // 使用 canvas 绘制二维码
    setTimeout(() => {
      this.drawQRCode();
    }, 100);
  },

  /**
   * 绘制二维码
   */
  drawQRCode() {
    const token = this.data.token;
    if (!token) return;

    const ctx = wx.createCanvasContext('qrCodeCanvas', this);
    const size = 200;
    const padding = 20;

    // 清空画布
    ctx.clearRect(0, 0, size, size);

    // 背景
    ctx.setFillStyle('#ffffff');
    ctx.fillRect(0, 0, size, size);

    // 绘制模拟二维码点阵
    ctx.setFillStyle('#000000');
    const moduleSize = 6;
    const modules = 25;

    for (let i = 0; i < modules; i++) {
      for (let j = 0; j < modules; j++) {
        // 定位图案区域留白
        const isPositionPattern = (i < 7 && j < 7) || (i < 7 && j > modules - 8) || (i > modules - 8 && j < 7);

        if (!isPositionPattern) {
          // 使用 token 的字符来决定是否绘制点
          const charIndex = (i * modules + j) % token.length;
          const shouldDraw = token.charCodeAt(charIndex) % 2 === 0;

          if (shouldDraw) {
            ctx.fillRect(padding + j * moduleSize, padding + i * moduleSize, moduleSize - 1, moduleSize - 1);
          }
        }
      }
    }

    // 绘制定位图案（左上角）
    ctx.setFillStyle('#000000');
    ctx.fillRect(padding, padding, 49, 49);
    ctx.setFillStyle('#ffffff');
    ctx.fillRect(padding + 6, padding + 6, 37, 37);
    ctx.setFillStyle('#000000');
    ctx.fillRect(padding + 12, padding + 12, 25, 25);

    // 绘制定位图案（右上角）
    ctx.setFillStyle('#000000');
    ctx.fillRect(size - padding - 49, padding, 49, 49);
    ctx.setFillStyle('#ffffff');
    ctx.fillRect(size - padding - 43, padding + 6, 37, 37);
    ctx.setFillStyle('#000000');
    ctx.fillRect(size - padding - 37, padding + 12, 25, 25);

    // 绘制定位图案（左下角）
    ctx.setFillStyle('#000000');
    ctx.fillRect(padding, size - padding - 49, 49, 49);
    ctx.setFillStyle('#ffffff');
    ctx.fillRect(padding + 6, size - padding - 43, 37, 37);
    ctx.setFillStyle('#000000');
    ctx.fillRect(padding + 12, size - padding - 37, 25, 25);

    ctx.draw(false, () => {
      setTimeout(() => {
        this.saveQRCodeToImage();
      }, 100);
    });
  },

  /**
   * 保存二维码为图片
   */
  saveQRCodeToImage() {
    const that = this;
    wx.canvasToTempFilePath({
      canvasId: 'qrCodeCanvas',
      success: (res) => {
        that.setData({
          qrCodeUrl: res.tempFilePath
        });
      },
      fail: (err) => {
        console.log('二维码生成失败', err);
      }
    }, this);
  },

  /**
   * 检查紧急联系人是否已填写
   */
  checkEmergencyContact() {
    const currentUserType = wx.getStorageSync('currentUserType');
    if (!currentUserType) return;

    const emergencyContact = wx.getStorageSync(`emergencyContact_${currentUserType}`);
    if (currentUserType === 'disabled' && !emergencyContact) {
      this.setData({ showEmergencyModal: true });
    }
  },

  /**
   * 去填写紧急联系人
   */
  goToEmergencyContact() {
    wx.navigateTo({
      url: '/pages/emergency-contact/emergency-contact'
    });
  },

  /**
   * 关闭紧急联系人提示
   */
  closeEmergencyModal() {
    this.setData({ showEmergencyModal: false });
  },

  /**
   * 手机号输入
   */
  onPhoneInput(e) {
    this.setData({
      loginPhone: e.detail.value
    });
  },

  /**
   * 验证码输入
   */
  onVerifyCodeInput(e) {
    this.setData({
      verifyCode: e.detail.value
    });
  },

  /**
   * 发送验证码
   */
  handleSendCode() {
    const { loginPhone } = this.data;

    if (!loginPhone.trim()) {
      wx.showToast({
        title: '请输入手机号',
        icon: 'none'
      });
      return;
    }

    const phoneReg = /^1[3-9]\d{9}$/;
    if (!phoneReg.test(loginPhone)) {
      wx.showToast({
        title: '请输入正确的手机号',
        icon: 'none'
      });
      return;
    }

    // 生成4位随机验证码
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    this.setData({
      generatedCode: code,
      codeBtnDisabled: true
    });

    // 模拟发送验证码
    console.log('验证码已发送：', code);
    wx.showToast({
      title: `验证码：${code}`,
      icon: 'none',
      duration: 3000
    });

    // 开始倒计时
    this.startCountdown();
  },

  /**
   * 倒计时
   */
  startCountdown() {
    let countdown = 60;
    this.setData({
      codeBtnText: `${countdown}秒后重发`
    });

    const timer = setInterval(() => {
      countdown--;
      if (countdown > 0) {
        this.setData({
          codeBtnText: `${countdown}秒后重发`
        });
      } else {
        clearInterval(timer);
        this.setData({
          codeBtnText: '获取验证码',
          codeBtnDisabled: false
        });
      }
    }, 1000);
  },

  /**
   * 退出登录
   */
  handleLogout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出当前账号吗？',
      confirmText: '退出',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('isLoggedIn');
          wx.removeStorageSync('currentUserType');

          wx.showToast({ title: '已退出', icon: 'success' });

          setTimeout(() => {
            this.checkLoginStatus();
          }, 1000);
        }
      }
    });
  },

  /**
   * 刷新二维码
   */
  refreshQRCode() {
    const newToken = 'QR_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    if (this.data.userInfo) {
      const updatedUserInfo = { ...this.data.userInfo, token: newToken };
      wx.setStorageSync(`userInfo_${this.data.userType}`, updatedUserInfo);

      this.setData({
        userInfo: updatedUserInfo,
        token: newToken,
        qrCodeUrl: ''
      });

      // 重新生成二维码
      setTimeout(() => {
        this.generateQRCode();
      }, 100);
    }

    wx.showToast({ title: '二维码已刷新', icon: 'success' });
  },

  /**
   * 保存二维码到相册
   */
  saveQRCode() {
    if (!this.data.qrCodeUrl) {
      wx.showToast({ title: '二维码生成中...', icon: 'none' });
      return;
    }

    wx.saveImageToPhotosAlbum({
      filePath: this.data.qrCodeUrl,
      success: () => {
        wx.showToast({ title: '保存成功', icon: 'success' });
      },
      fail: (err) => {
        if (err.errMsg.includes('auth deny')) {
          wx.showModal({
            title: '提示',
            content: '需要您授权保存到相册',
            confirmText: '去设置',
            success: (res) => {
              if (res.confirm) {
                wx.openSetting();
              }
            }
          });
        }
      }
    });
  }
});
