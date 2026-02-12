// pages/exam/exam.js
const app = getApp();

Page({

  /**
   * 页面的初始数据
   */
  data: {
    exam: null,
    questions: [],
    userAnswers: [],
    currentIndex: 0,
    showResult: false,
    score: 0,
    passed: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.loadExam();
  },

  /**
   * 从云端加载考试题目
   */
  loadExam() {
    wx.showLoading({ title: '加载题目...' });
    app.getExamQuestions().then(res => {
      wx.hideLoading();
      if (res.success && res.questions.length > 0) {
        const userAnswers = new Array(res.questions.length).fill(-1);
        this.setData({
          exam: { passScore: res.passScore || 80, title: '志愿者陪跑资格考试' },
          questions: res.questions,
          userAnswers: userAnswers
        });
      } else {
        wx.showModal({
          title: '提示',
          content: '暂无可用考试',
          showCancel: false,
          success: () => { wx.navigateBack(); }
        });
      }
    }).catch(() => {
      wx.hideLoading();
      // 降级到本地
      this._loadLocalExam();
    });
  },

  /**
   * 本地降级加载考试
   */
  _loadLocalExam() {
    const exams = wx.getStorageSync('training_exams') || [];
    if (exams.length === 0) {
      wx.showModal({
        title: '提示', content: '暂无可用考试', showCancel: false,
        success: () => { wx.navigateBack(); }
      });
      return;
    }
    const exam = exams[0];
    const userAnswers = new Array(exam.questions.length).fill(-1);
    this.setData({ exam: exam, questions: exam.questions, userAnswers: userAnswers });
  },

  /**
   * 选择答案
   */
  selectAnswer(e) {
    const { qindex, oindex } = e.currentTarget.dataset;
    const userAnswers = this.data.userAnswers;
    userAnswers[qindex] = oindex;
    this.setData({ userAnswers });
  },

  /**
   * 提交考试（云端评分）
   */
  submitExam() {
    const { userAnswers, questions } = this.data;

    if (userAnswers.includes(-1)) {
      wx.showToast({ title: '请完成所有题目', icon: 'none' });
      return;
    }

    // 构建答案数组
    const answers = questions.map((q, index) => ({
      questionId: q._id,
      selectedIndex: userAnswers[index]
    }));

    wx.showLoading({ title: '提交中...' });
    app.submitExam(answers).then(res => {
      wx.hideLoading();
      if (res.success) {
        this.setData({
          showResult: true,
          score: res.score,
          passed: res.passed
        });

        if (res.passed) {
          // 同步到本地缓存
          wx.setStorageSync('exam_passed', true);
          wx.setStorageSync('exam_score', res.score);
          wx.setStorageSync('exam_date', res.examDate);
          wx.setStorageSync('certificate_no', res.certificateNo);
          wx.setStorageSync('isRegistered', true);
        }
      }
    }).catch(() => {
      wx.hideLoading();
      // 降级到本地评分
      this._localSubmitExam();
    });
  },

  /**
   * 本地降级评分
   */
  _localSubmitExam() {
    const { userAnswers, questions, exam } = this.data;
    let correctCount = 0;
    questions.forEach((q, index) => {
      if (userAnswers[index] === (q.correctAnswer || q.answer)) correctCount++;
    });
    const score = Math.round((correctCount / questions.length) * 100);
    const passed = score >= (exam.passScore || 80);
    this.setData({ showResult: true, score: score, passed: passed });
    if (passed) {
      const examDate = new Date().toLocaleString();
      const certificateNo = 'BRC' + Date.now();
      wx.setStorageSync('exam_passed', true);
      wx.setStorageSync('exam_score', score);
      wx.setStorageSync('exam_date', examDate);
      wx.setStorageSync('certificate_no', certificateNo);
      wx.setStorageSync('isRegistered', true);
    }
  },

  /**
   * 前往证书页面
   */
  goToCertificate() {
    wx.redirectTo({
      url: '/pages/certificate/certificate'
    });
  },

  /**
   * 重新考试
   */
  retakeExam() {
    const userAnswers = new Array(this.data.questions.length).fill(-1);
    this.setData({
      userAnswers: userAnswers,
      showResult: false,
      score: 0,
      passed: false
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