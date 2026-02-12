Page({
  data: {
    examTitle: '',
    passScore: 60,
    questions: []
  },

  onLoad() {
    // 初始化一个空题目
    this.addQuestion();
  },

  /**
   * 考试标题输入
   */
  onTitleInput(e) {
    this.setData({
      examTitle: e.detail.value
    });
  },

  /**
   * 及格分数输入
   */
  onPassScoreInput(e) {
    this.setData({
      passScore: parseInt(e.detail.value) || 60
    });
  },

  /**
   * 添加题目
   */
  addQuestion() {
    const questions = this.data.questions;
    questions.push({
      id: Date.now(),
      question: '',
      options: ['', '', '', ''],
      correctAnswer: 0
    });
    this.setData({ questions });
  },

  /**
   * 删除题目
   */
  deleteQuestion(e) {
    const index = e.currentTarget.dataset.index;
    const questions = this.data.questions;
    questions.splice(index, 1);
    this.setData({ questions });
  },

  /**
   * 题目内容输入
   */
  onQuestionInput(e) {
    const index = e.currentTarget.dataset.index;
    const questions = this.data.questions;
    questions[index].question = e.detail.value;
    this.setData({ questions });
  },

  /**
   * 选项内容输入
   */
  onOptionInput(e) {
    const { qindex, oindex } = e.currentTarget.dataset;
    const questions = this.data.questions;
    questions[qindex].options[oindex] = e.detail.value;
    this.setData({ questions });
  },

  /**
   * 设置正确答案
   */
  setCorrectAnswer(e) {
    const { qindex, oindex } = e.currentTarget.dataset;
    const questions = this.data.questions;
    questions[qindex].correctAnswer = oindex;
    this.setData({ questions });
  },

  /**
   * 验证表单
   */
  validateForm() {
    const { examTitle, questions } = this.data;

    if (!examTitle.trim()) {
      wx.showToast({
        title: '请输入考试标题',
        icon: 'none'
      });
      return false;
    }

    if (questions.length === 0) {
      wx.showToast({
        title: '请至少添加一道题目',
        icon: 'none'
      });
      return false;
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question.trim()) {
        wx.showToast({
          title: `第${i + 1}题题目不能为空`,
          icon: 'none'
        });
        return false;
      }

      for (let j = 0; j < q.options.length; j++) {
        if (!q.options[j].trim()) {
          wx.showToast({
            title: `第${i + 1}题选项${String.fromCharCode(65 + j)}不能为空`,
            icon: 'none'
          });
          return false;
        }
      }
    }

    return true;
  },

  /**
   * 保存考试
   */
  saveExam() {
    if (!this.validateForm()) {
      return;
    }

    const { examTitle, passScore, questions } = this.data;
    const examInfo = {
      id: Date.now(),
      title: examTitle,
      passScore: passScore,
      questionCount: questions.length,
      questions: questions,
      createTime: new Date().toLocaleString()
    };

    // 保存到存储
    const exams = wx.getStorageSync('training_exams') || [];
    exams.unshift(examInfo);
    wx.setStorageSync('training_exams', exams);

    wx.showToast({
      title: '创建成功',
      icon: 'success',
      duration: 1500
    });

    setTimeout(() => {
      wx.navigateBack();
    }, 1500);
  }
})
