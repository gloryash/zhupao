// pages/training-course/training-course.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    courses: [],        // 教程列表
    completedCourses: [], // 已完成的教程
    canTakeExam: false  // 是否可以参加考试
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.loadCourses();
    this.checkProgress();
  },

  /**
   * 加载教程列表
   */
  loadCourses() {
    const courses = wx.getStorageSync('training_courses') || [];
    this.setData({ courses });
  },

  /**
   * 检查学习进度
   */
  checkProgress() {
    const completedCourses = wx.getStorageSync('completed_courses') || [];
    // 开发测试模式：始终允许参加考试
    const canTakeExam = true; // 正式环境改为: completedCourses.length >= this.data.courses.length && this.data.courses.length > 0
    this.setData({ completedCourses, canTakeExam });
  },

  /**
   * 查看教程
   */
  viewCourse(e) {
    const courseId = e.currentTarget.dataset.id;
    const course = this.data.courses.find(c => c.id === courseId);

    if (!course) return;

    if (course.type === 'video') {
      // 播放视频
      wx.showModal({
        title: course.title,
        content: '视频播放功能需要集成视频播放器',
        showCancel: false
      });
    } else {
      // 查看文档
      wx.showModal({
        title: course.title,
        content: '文档查看功能需要集成文档阅读器',
        showCancel: false
      });
    }

    // 标记为已完成
    this.markAsCompleted(courseId);
  },

  /**
   * 标记教程为已完成
   */
  markAsCompleted(courseId) {
    let completedCourses = wx.getStorageSync('completed_courses') || [];
    if (!completedCourses.includes(courseId)) {
      completedCourses.push(courseId);
      wx.setStorageSync('completed_courses', completedCourses);
      this.checkProgress();
      wx.showToast({ title: '已完成学习', icon: 'success' });
    }
  },

  /**
   * 参加考试
   */
  goToExam() {
    if (!this.data.canTakeExam) {
      wx.showToast({
        title: '请先完成所有教程',
        icon: 'none'
      });
      return;
    }

    wx.navigateTo({
      url: '/pages/exam/exam'
    });
  },

  /**
   * 跳过培训，直接进入主页
   */
  skipToHome() {
    wx.redirectTo({
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