// pages/certificate/certificate.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    userName: '',
    score: 0,
    examDate: '',
    certificateNo: '',
    isVolunteer: false,
    hasCertificate: false,
    hasIdCard: false,
    userToken: ''
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.loadCertificateInfo();
  },

  /**
   * 加载证书信息
   */
  loadCertificateInfo() {
    // 获取当前用户类型
    const currentUserType = wx.getStorageSync('currentUserType');
    const isVolunteer = currentUserType === 'volunteer';

    this.setData({ isVolunteer });

    // 如果是视障人士，不需要证书
    if (!isVolunteer) {
      this.setData({
        hasCertificate: false
      });
      return;
    }

    // 志愿者读取证书信息
    const userInfo = wx.getStorageSync('userInfo_volunteer') || {};
    const passed = wx.getStorageSync('exam_passed') || false;
    const score = wx.getStorageSync('exam_score') || 0;
    const examDate = wx.getStorageSync('exam_date') || '';
    const certificateNo = wx.getStorageSync('certificate_no') || '';

    // 检查是否已有数字身份牌
    const hasIdCard = wx.getStorageSync('hasIdCard_volunteer') || false;
    const userToken = userInfo.token || '';

    this.setData({
      hasCertificate: passed,
      userName: userInfo.name || '志愿者',
      score: score,
      examDate: examDate,
      certificateNo: certificateNo || 'BRC' + Date.now(),
      hasIdCard: hasIdCard,
      userToken: userToken
    });
  },

  /**
   * 领取数字身份牌
   */
  claimIdCard() {
    const userInfo = wx.getStorageSync('userInfo_volunteer') || {};

    if (!userInfo.token) {
      // 生成 token
      const token = 'QR_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      userInfo.token = token;
      wx.setStorageSync('userInfo_volunteer', userInfo);

      this.setData({
        userToken: token
      });
    }

    // 设置已领取状态
    wx.setStorageSync('hasIdCard_volunteer', true);

    this.setData({
      hasIdCard: true
    });

    wx.showToast({
      title: '领取成功！',
      icon: 'success',
      duration: 2000
    });

    // 跳转到数字身份牌展示页面
    setTimeout(() => {
      wx.navigateTo({
        url: '/pages/quick-login/quick-login'
      });
    }, 2000);
  },

  /**
   * 查看我的数字身份牌
   */
  viewIdCard() {
    wx.navigateTo({
      url: '/pages/quick-login/quick-login'
    });
  },

  /**
   * 进入主页
   */
  goToHome() {
    wx.reLaunch({
      url: '/pages/home/home'
    });
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    this.loadCertificateInfo();
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  }
})