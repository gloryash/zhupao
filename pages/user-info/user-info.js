const app = getApp();

Page({
  data: {
    userType: 'disabled', // 默认为视障人士
    userTypes: [
      { label: '视障人士', value: 'disabled' },
      { label: '志愿者', value: 'volunteer' }
    ],
    gender: '', // 性别：male-男, female-女
    genderOptions: [
      { label: '男', value: 'male' },
      { label: '女', value: 'female' }
    ],
    name: '',
    idCard: '', // 身份证号
    phone: '', // 手机号（从登录页传递）
    phoneFromLogin: '', // 临时存储从登录页传递的手机号
    resume: '',
    // 视障人士专属字段
    emergencyPhone: '',
    runningLocation: '',
    // 志愿者专属字段
    runningYears: '',
    pace: '',
    hasMarathon: 'no',
    hasFirstAid: 'no',
    hasCompanionExp: 'no'
  },

  onLoad(options) {
    // 接收角色参数（URL参数优先级更高）
    if (options.userType) {
      this.setData({
        userType: options.userType
      });
    }

    // 接收手机号参数
    if (options.phone) {
      this.setData({
        phoneFromLogin: options.phone
      });
    }

    // 然后加载对应类型的已保存信息
    this.loadUserInfo();
  },

  /**
   * 加载用户信息
   */
  loadUserInfo() {
    // 根据用户类型加载对应的信息
    const userType = this.data.userType;
    const draftKey = `userInfo_${userType}_draft`;
    const storageKey = `userInfo_${userType}`;

    // 优先读取草稿数据（用户正在填写但未提交的数据）
    let userInfo = wx.getStorageSync(draftKey);

    // 如果没有草稿，则读取已提交的数据
    if (!userInfo) {
      userInfo = wx.getStorageSync(storageKey);
    }

    if (userInfo) {
      this.setData({
        name: userInfo.name || '',
        gender: userInfo.gender || '',
        idCard: userInfo.idCard || '',
        phone: userInfo.phone || this.data.phoneFromLogin || '',
        resume: userInfo.resume || '',
        // 视障人士专属字段
        emergencyPhone: userInfo.emergencyPhone || '',
        runningLocation: userInfo.runningLocation || '',
        // 志愿者专属字段
        runningYears: userInfo.runningYears || '',
        pace: userInfo.pace || '',
        hasMarathon: userInfo.hasMarathon || 'no',
        hasFirstAid: userInfo.hasFirstAid || 'no',
        hasCompanionExp: userInfo.hasCompanionExp || 'no'
      });
    } else if (this.data.phoneFromLogin) {
      // 如果没有保存的信息，但有从登录页传递的手机号
      this.setData({
        phone: this.data.phoneFromLogin
      });
    }
  },

  /**
   * 保存草稿（实时保存用户输入）
   */
  saveDraft() {
    const { userType, name, gender, idCard, resume,
            emergencyPhone, runningLocation, runningYears, pace,
            hasMarathon, hasFirstAid, hasCompanionExp } = this.data;
    const draftKey = `userInfo_${userType}_draft`;

    const draftData = {
      userType,
      name,
      gender,
      idCard,
      resume,
      emergencyPhone,
      runningLocation,
      runningYears,
      pace,
      hasMarathon,
      hasFirstAid,
      hasCompanionExp
    };

    wx.setStorageSync(draftKey, draftData);
  },

  /**
   * 用户类型切换
   */
  onUserTypeChange(e) {
    // 先保存当前类型的草稿
    this.saveDraft();

    // 切换用户类型
    this.setData({
      userType: e.currentTarget.dataset.value
    });

    // 加载新类型的数据
    this.loadUserInfo();
  },

  /**
   * 性别选择
   */
  onGenderChange(e) {
    this.setData({
      gender: e.currentTarget.dataset.value
    });
    this.saveDraft();
  },

  /**
   * 姓名输入
   */
  onNameInput(e) {
    this.setData({
      name: e.detail.value
    });
    this.saveDraft();
  },

  /**
   * 身份证号输入
   */
  onIdCardInput(e) {
    this.setData({
      idCard: e.detail.value
    });
    this.saveDraft();
  },

  /**
   * 手机号输入
   */
  onPhoneInput(e) {
    this.setData({
      phone: e.detail.value
    });
    this.saveDraft();
  },

  /**
   * 简历输入
   */
  onResumeInput(e) {
    this.setData({
      resume: e.detail.value
    });
    this.saveDraft();
  },

  /**
   * 紧急联系人电话输入（视障人士）
   */
  onEmergencyPhoneInput(e) {
    this.setData({
      emergencyPhone: e.detail.value
    });
    this.saveDraft();
  },

  /**
   * 常用跑步地点输入（视障人士）
   */
  onRunningLocationInput(e) {
    this.setData({
      runningLocation: e.detail.value
    });
    this.saveDraft();
  },

  /**
   * 跑龄输入（志愿者）
   */
  onRunningYearsInput(e) {
    this.setData({
      runningYears: e.detail.value
    });
    this.saveDraft();
  },

  /**
   * 配速输入（志愿者）
   */
  onPaceInput(e) {
    this.setData({
      pace: e.detail.value
    });
    this.saveDraft();
  },

  /**
   * 马拉松经历选择（志愿者）
   */
  onMarathonChange(e) {
    this.setData({
      hasMarathon: e.detail.value
    });
    this.saveDraft();
  },

  /**
   * 急救证选择（志愿者）
   */
  onFirstAidChange(e) {
    this.setData({
      hasFirstAid: e.detail.value
    });
    this.saveDraft();
  },

  /**
   * 陪跑经验选择（志愿者）
   */
  onCompanionExpChange(e) {
    this.setData({
      hasCompanionExp: e.detail.value
    });
    this.saveDraft();
  },

  /**
   * 表单验证
   */
  validateForm() {
    const { userType, name, gender, idCard,
            emergencyPhone, runningLocation, runningYears, pace } = this.data;

    if (!name.trim()) {
      wx.showToast({
        title: '请输入姓名',
        icon: 'none'
      });
      return false;
    }

    if (!gender) {
      wx.showToast({
        title: '请选择性别',
        icon: 'none'
      });
      return false;
    }

    // 验证身份证号（18位）
    if (idCard && idCard.length > 0) {
      const idCardReg = /(^\d{15}$)|(^\d{18}$)|(^\d{17}(\d|X|x)$)/;
      if (!idCardReg.test(idCard)) {
        wx.showToast({
          title: '请输入正确的身份证号',
          icon: 'none'
        });
        return false;
      }
    }

    // 视障人士专属验证
    if (userType === 'disabled') {
      if (!emergencyPhone.trim()) {
        wx.showToast({
          title: '请输入紧急联系人电话',
          icon: 'none'
        });
        return false;
      }

      // 验证紧急联系人手机号格式
      const phoneReg = /^1[3-9]\d{9}$/;
      if (!phoneReg.test(emergencyPhone)) {
        wx.showToast({
          title: '请输入正确的紧急联系人手机号',
          icon: 'none'
        });
        return false;
      }

      if (!runningLocation.trim()) {
        wx.showToast({
          title: '请输入常用跑步地点',
          icon: 'none'
        });
        return false;
      }
    }

    // 志愿者专属验证
    if (userType === 'volunteer') {
      if (!runningYears.trim()) {
        wx.showToast({
          title: '请输入跑龄',
          icon: 'none'
        });
        return false;
      }

      if (!pace.trim()) {
        wx.showToast({
          title: '请输入配速',
          icon: 'none'
        });
        return false;
      }
    }

    return true;
  },

  /**
   * 提交表单
   */
  handleSubmit() {
    if (!this.validateForm()) {
      return;
    }

    const { userType, name, gender, idCard, phone, resume,
            emergencyPhone, runningLocation, runningYears, pace,
            hasMarathon, hasFirstAid, hasCompanionExp } = this.data;

    // 生成唯一的登录 token
    const token = 'QR_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    // 根据用户类型保存到不同的存储键
    const userInfo = {
      userType,
      name,
      gender,
      idCard,
      phone: phone || this.data.phoneFromLogin,
      resume,
      emergencyPhone,
      runningLocation,
      runningYears,
      pace,
      hasMarathon,
      hasFirstAid,
      hasCompanionExp,
      token: token,
      createdAt: new Date().toLocaleString()
    };

    const storageKey = `userInfo_${userType}`;
    wx.setStorageSync(storageKey, userInfo);

    // 清空草稿（提交成功后不再需要草稿）
    const draftKey = `userInfo_${userType}_draft`;
    wx.removeStorageSync(draftKey);

    // 保存当前用户类型和登录状态
    wx.setStorageSync('currentUserType', userType);
    wx.setStorageSync('isRegistered', true);
    wx.setStorageSync('isLoggedIn', true);

    // 清除另一种用户类型的数据（防止数据混淆）
    const otherUserType = userType === 'volunteer' ? 'disabled' : 'volunteer';
    wx.removeStorageSync(`userInfo_${otherUserType}`);
    wx.removeStorageSync(`userInfo_${otherUserType}_draft`);

    // 同时保存到全局变量
    app.globalData.userInfo = userInfo;

    wx.showToast({
      title: '注册成功',
      icon: 'success',
      duration: 1500
    });

    console.log(`${userType === 'disabled' ? '视障人士' : '志愿者'}信息已保存：`, userInfo);

    // 延迟跳转，确保数据保存完成
    setTimeout(() => {
      this.navigateToPage(userType);
    }, 1500);
  },

  /**
   * 跳转到相应页面
   */
  navigateToPage(userType) {
    // 志愿者和视障人士都直接进入首页
    wx.reLaunch({
      url: '/pages/home/home'
    });
  }
})
