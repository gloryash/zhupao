// pages/training-flow/training-flow.js
const app = getApp();

Page({
  data: {
    // 当前步骤：1=观看视频，2=参加考试，3=领取证书
    currentStep: 1,

    // 视频相关
    // 培训视频地址（云存储）— 请将文件名替换为你实际上传的视频文件名
    videoUrl: 'cloud://cloudbase-4gujmrr46d949513.636c-cloudbase-4gujmrr46d949513-1330514838/training-video.mp4',
    videoCompleted: false,

    // 考试相关
    questions: [],
    allAnswered: false,
    correctCount: 0,
    score: 0,
    passed: false,
    showExamResult: false,

    // 证书相关
    examDate: '',
    userName: ''
  },

  onLoad(options) {
    // 加载用户信息
    const userInfo = wx.getStorageSync('userInfo_volunteer') || {};
    this.setData({
      userName: userInfo.name || '志愿者'
    });

    // 检查培训状态
    this.checkTrainingStatus();
  },

  /**
   * 检查培训状态（云端优先）
   */
  checkTrainingStatus() {
    // 先从本地快速判断
    const examPassed = wx.getStorageSync('exam_passed');
    const videoWatched = wx.getStorageSync('volunteer_video_watched');

    if (examPassed) {
      const examDate = wx.getStorageSync('exam_date') || new Date().toLocaleString();
      this.setData({ currentStep: 3, examDate: examDate, examPassed: true });
    } else if (videoWatched) {
      this.loadExamQuestions();
      this.setData({ currentStep: 2, videoCompleted: true });
    } else {
      this.setData({ currentStep: 1, videoCompleted: false });
    }

    // 云端同步培训状态
    app.getTrainingStatus().then(res => {
      if (res.success) {
        const status = res.status;
        if (status.examPassed) {
          wx.setStorageSync('exam_passed', true);
          wx.setStorageSync('exam_score', status.examScore);
          wx.setStorageSync('exam_date', status.examDate);
          wx.setStorageSync('certificate_no', status.certificateNo);
          this.setData({ currentStep: 3, examDate: status.examDate, examPassed: true });
        } else if (status.videoWatched) {
          wx.setStorageSync('volunteer_video_watched', true);
          if (this.data.currentStep < 2) {
            this.loadExamQuestions();
            this.setData({ currentStep: 2, videoCompleted: true });
          }
        }
      }
    }).catch(() => {});
  },

  /**
   * 从云端加载考试题目
   */
  loadExamQuestions() {
    // 云端获取题目
    app.getExamQuestions().then(res => {
      if (res.success && res.questions.length > 0) {
        const questions = res.questions.map(q => ({
          ...q,
          // 云端返回 options 数组，映射为 optionA/B/C/D 供 WXML 使用
          optionA: q.options ? q.options[0] : q.optionA,
          optionB: q.options ? q.options[1] : q.optionB,
          optionC: q.options ? q.options[2] : q.optionC,
          optionD: q.options ? q.options[3] : q.optionD,
          correctAnswer: q.answer !== undefined ? q.answer : -1,
          userAnswer: -1,
          answered: false,
          correct: false
        }));
        this.setData({ questions });
      } else {
        this._loadLocalQuestions();
      }
    }).catch(() => {
      this._loadLocalQuestions();
    });
  },

  /**
   * 本地降级加载题目
   */
  _loadLocalQuestions() {
    const exams = wx.getStorageSync('training_exams') || [];
    if (exams.length > 0) {
      const exam = exams[0];
      const questions = exam.questions.map(q => ({
        ...q,
        userAnswer: -1,
        answered: false,
        correct: false
      }));
      this.setData({ questions });
    }
  },

  /**
   * 视频播放完成
   */
  onVideoEnded() {
    this.setData({ videoCompleted: true });
    wx.setStorageSync('volunteer_video_watched', true);
    // 同步到云端
    app.updateVideoWatched().catch(() => {});
    wx.showToast({ title: '视频学习完成！', icon: 'success' });
  },

  /**
   * 开发测试：跳过视频
   */
  skipVideo() {
    this.setData({
      videoCompleted: true
    });
    wx.setStorageSync('volunteer_video_watched', true);
    wx.showToast({
      title: '已跳过视频',
      icon: 'none'
    });
  },

  /**
   * 重新观看视频
   */
  rewatchVideo() {
    this.setData({
      videoCompleted: false
    });
  },

  /**
   * 视频播放错误
   */
  onVideoError(e) {
    console.error('视频播放错误：', e);
    wx.showModal({
      title: '提示',
      content: '视频加载失败，请确保网络连接正常后重试',
      showCancel: false
    });
  },

  /**
   * 前往考试
   */
  goToExam() {
    if (!this.data.videoCompleted) {
      wx.showToast({
        title: '请先完整观看视频',
        icon: 'none'
      });
      return;
    }
    this.loadExamQuestions();
    this.setData({
      currentStep: 2,
      showExamResult: false
    });
  },

  /**
   * 答案选择（实时反馈）
   */
  onAnswerChange(e) {
    const questionIndex = e.currentTarget.dataset.index;
    const userAnswer = parseInt(e.detail.value);
    const questions = this.data.questions;
    const question = questions[questionIndex];

    // 如果已经回答过，不允许修改
    if (question.answered) {
      return;
    }

    // 记录用户答案
    question.userAnswer = userAnswer;
    question.answered = true;
    question.correct = userAnswer === question.correctAnswer;

    // 更新数据
    this.setData({
      questions: questions
    });

    // 实时反馈
    if (question.correct) {
      wx.showToast({
        title: '回答正确！',
        icon: 'success',
        duration: 1500
      });
    } else {
      wx.showToast({
        title: '回答错误',
        icon: 'none',
        duration: 2000
      });
    }

    // 检查是否所有题目都已回答
    this.checkExamComplete();
  },

  /**
   * 检查考试是否完成
   */
  checkExamComplete() {
    const questions = this.data.questions;
    const allAnswered = questions.every(q => q.answered);

    if (allAnswered) {
      const correctCount = questions.filter(q => q.correct).length;
      const totalCount = questions.length;
      const score = Math.round((correctCount / totalCount) * 100);
      const passed = score >= 80; // 80%及格，与云端一致

      this.setData({
        allAnswered: true,
        correctCount: correctCount,
        score: score,
        passed: passed,
        showExamResult: true
      });

      if (passed) {
        // 通过考试
        const examDate = new Date().toLocaleDateString('zh-CN');
        wx.setStorageSync('exam_passed', true);
        wx.setStorageSync('exam_score', score);
        wx.setStorageSync('exam_date', examDate);
        wx.setStorageSync('isRegistered', true);

        this.setData({
          examPassed: true,
          examDate: examDate
        });

        // 提交考试结果到云端
        const answers = questions.map(q => ({
          questionId: q._id,
          selectedIndex: q.userAnswer
        }));
        app.submitExam(answers).then(res => {
          if (res.success && res.certificateNo) {
            wx.setStorageSync('certificate_no', res.certificateNo);
          }
        }).catch(err => {
          console.error('云端提交考试失败:', err);
        });

        // 延迟显示证书页面
        setTimeout(() => {
          wx.showModal({
            title: '🎉 恭喜通过考试！',
            content: `您答对了 ${correctCount}/${totalCount} 题，获得培训证书！`,
            showCancel: false,
            success: () => {
              this.setData({ currentStep: 3 });
            }
          });
        }, 500);
      }
    }
  },

  /**
   * 演示模式：跳过考试
   */
  skipExam() {
    const examDate = new Date().toLocaleDateString('zh-CN');
    wx.setStorageSync('exam_passed', true);
    wx.setStorageSync('exam_score', 100);
    wx.setStorageSync('exam_date', examDate);
    wx.setStorageSync('isRegistered', true);
    this.setData({
      currentStep: 3,
      examPassed: true,
      examDate: examDate
    });
    wx.showToast({ title: '已跳过考试', icon: 'none' });
  },

  /**
   * 重新考试
   */
  retryExam() {
    // 重置题目状态
    const questions = this.data.questions.map(q => ({
      ...q,
      userAnswer: -1,
      answered: false,
      correct: false
    }));

    this.setData({
      questions: questions,
      allAnswered: false,
      correctCount: 0,
      score: 0,
      passed: false,
      showExamResult: false
    });

    // 询问是否想重新观看视频
    wx.showModal({
      title: '温馨提示',
      content: '是否需要重新观看培训视频？',
      confirmText: '观看视频',
      cancelText: '直接重考',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            currentStep: 1,
            videoCompleted: false
          });
        }
      }
    });
  },

  /**
   * 开始接单服务
   */
  startService() {
    wx.showModal({
      title: '开始服务',
      content: '您现在可以开始接单服务了！',
      confirmText: '去接单',
      success: (res) => {
        if (res.confirm) {
          wx.switchTab({
            url: '/pages/home/home'
          });
        }
      }
    });
  },

  /**
   * 返回首页
   */
  goHome() {
    wx.switchTab({
      url: '/pages/home/home'
    });
  }
})
