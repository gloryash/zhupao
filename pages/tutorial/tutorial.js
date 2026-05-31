Page({
  data: {
    currentStep: 0,
    neverShowAgain: false,
    steps: [
      {
        icon: '👋',
        title: '欢迎使用助盲跑',
        description: '助盲跑帮助视障跑者找到志愿者陪跑伙伴，让您安全、自由地享受奔跑。接下来为您介绍主要功能。',
        tip: '左右滑动或点击下方按钮切换步骤'
      },
      {
        icon: '📅',
        title: '每日打卡',
        description: '每天打卡可获得5经验值，连续打卡3天额外获得50经验。经验值可提升您的段位等级。',
        tip: '在首页点击"每日打卡 +5经验"按钮'
      },
      {
        icon: '🔍',
        title: '寻找志愿者',
        description: '查看正在接单的志愿者列表，可以看到志愿者的距离、跑龄等信息，点击即可邀请陪跑。',
        tip: '在首页底部点击"发现志愿者"'
      },
      {
        icon: '🌟',
        title: '发布陪跑需求',
        description: '点亮您的位置，设置目标里程和预计时间，周边志愿者会看到您的需求并前来陪跑。',
        tip: '在首页点击"发布需求"按钮'
      },
      {
        icon: '📋',
        title: '日程与记录',
        description: '在"我的日程"中管理预约，在"跑步历史"中查看过去的陪跑记录和运动数据。',
        tip: '在首页"功能操作"区域找到对应入口'
      },
      {
        icon: '🚨',
        title: '紧急联系人',
        description: '设置紧急联系人号码，陪跑过程中可一键拨打紧急联系人或报警，保障您的安全。',
        tip: '在首页"功能操作"中点击"紧急联系人"设置'
      }
    ]
  },

  onLoad(options) {
    const neverShow = wx.getStorageSync('tutorial_never_show');
    if (neverShow && !options.force) {
      wx.navigateBack();
    }
  },

  onSwiperChange(e) {
    this.setData({ currentStep: e.detail.current });
  },

  nextStep() {
    const { currentStep, steps } = this.data;
    if (currentStep < steps.length - 1) {
      this.setData({ currentStep: currentStep + 1 });
    } else {
      this.finishTutorial();
    }
  },

  prevStep() {
    if (this.data.currentStep > 0) {
      this.setData({ currentStep: this.data.currentStep - 1 });
    }
  },

  skipTutorial() {
    this.finishTutorial();
  },

  toggleNeverShow() {
    this.setData({ neverShowAgain: !this.data.neverShowAgain });
  },

  finishTutorial() {
    if (this.data.neverShowAgain) {
      wx.setStorageSync('tutorial_never_show', true);
    }
    wx.navigateBack();
  }
})
