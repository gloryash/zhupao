Page({
  data: {
    courses: [], // 教程列表
    exams: []    // 考试列表
  },

  onLoad() {
    this.loadData();
  },

  /**
   * 加载已保存的数据
   */
  loadData() {
    const courses = wx.getStorageSync('training_courses') || [];
    const exams = wx.getStorageSync('training_exams') || [];
    this.setData({ courses, exams });
  },

  /**
   * 上传教程视频
   */
  uploadCourseVideo() {
    wx.chooseVideo({
      sourceType: ['album', 'camera'],
      maxDuration: 600, // 最长10分钟
      camera: 'back',
      success: (res) => {
        const videoInfo = {
          id: Date.now(),
          type: 'video',
          title: '',
          path: res.tempFilePath,
          duration: res.duration,
          size: res.size,
          createTime: new Date().toLocaleString()
        };

        // 提示输入标题
        wx.showModal({
          title: '输入视频标题',
          editable: true,
          placeholderText: '请输入教程标题',
          success: (modalRes) => {
            if (modalRes.confirm && modalRes.content) {
              videoInfo.title = modalRes.content;
              this.saveCourse(videoInfo);
            }
          }
        });
      }
    });
  },

  /**
   * 上传教程文档
   */
  uploadCourseDoc() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      success: (res) => {
        const file = res.tempFiles[0];
        const docInfo = {
          id: Date.now(),
          type: 'doc',
          title: '',
          path: file.path,
          name: file.name,
          size: file.size,
          createTime: new Date().toLocaleString()
        };

        // 提示输入标题
        wx.showModal({
          title: '输入文档标题',
          editable: true,
          placeholderText: '请输入教程标题',
          success: (modalRes) => {
            if (modalRes.confirm && modalRes.content) {
              docInfo.title = modalRes.content;
              this.saveCourse(docInfo);
            }
          }
        });
      }
    });
  },

  /**
   * 保存教程
   */
  saveCourse(courseInfo) {
    const courses = this.data.courses;
    courses.unshift(courseInfo);
    wx.setStorageSync('training_courses', courses);
    this.setData({ courses });

    wx.showToast({
      title: '添加成功',
      icon: 'success'
    });
  },

  /**
   * 删除教程
   */
  deleteCourse(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个教程吗？',
      success: (res) => {
        if (res.confirm) {
          const courses = this.data.courses.filter(item => item.id !== id);
          wx.setStorageSync('training_courses', courses);
          this.setData({ courses });
          wx.showToast({ title: '删除成功', icon: 'success' });
        }
      }
    });
  },

  /**
   * 创建考试
   */
  createExam() {
    wx.navigateTo({
      url: '/pages/exam-edit/exam-edit'
    });
  },

  /**
   * 删除考试
   */
  deleteExam(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个考试吗？',
      success: (res) => {
        if (res.confirm) {
          const exams = this.data.exams.filter(item => item.id !== id);
          wx.setStorageSync('training_exams', exams);
          this.setData({ exams });
          wx.showToast({ title: '删除成功', icon: 'success' });
        }
      }
    });
  },

  /**
   * 查看陪跑记录
   */
  viewRecords() {
    wx.navigateTo({
      url: '/pages/records-manage/records-manage'
    });
  }
})
